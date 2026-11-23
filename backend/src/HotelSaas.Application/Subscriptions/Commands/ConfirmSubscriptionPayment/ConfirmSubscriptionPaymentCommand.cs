using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Payments.Commands.ProcessVnpayIpn;
using HotelSaas.Application.Subscriptions.Common;
using HotelSaas.Application.Subscriptions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Subscriptions.Commands.ConfirmSubscriptionPayment;

public sealed record ConfirmSubscriptionPaymentCommand(
    Guid? PaymentId = null,
    IDictionary<string, string>? VnpayParams = null,
    string? GatewayTransactionNo = null
) : IRequest<ConfirmSubscriptionPaymentResultDto>;

public sealed class ConfirmSubscriptionPaymentCommandValidator
    : AbstractValidator<ConfirmSubscriptionPaymentCommand>
{
    public ConfirmSubscriptionPaymentCommandValidator()
    {
        RuleFor(x => x)
            .Must(x => (x.PaymentId.HasValue && x.PaymentId.Value != Guid.Empty) ||
                       (x.VnpayParams != null && x.VnpayParams.Count > 0))
            .WithMessage("Cần cung cấp mã giao dịch thanh toán (PaymentId) hoặc dữ liệu xác thực VNPay.");
    }
}

public sealed class ConfirmSubscriptionPaymentCommandHandler
    : IRequestHandler<ConfirmSubscriptionPaymentCommand, ConfirmSubscriptionPaymentResultDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;
    private readonly IVnpayPaymentService? _vnpayPaymentService;

    public ConfirmSubscriptionPaymentCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext currentUser,
        IVnpayPaymentService? vnpayPaymentService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _vnpayPaymentService = vnpayPaymentService;
    }

    public async Task<ConfirmSubscriptionPaymentResultDto> Handle(
        ConfirmSubscriptionPaymentCommand request,
        CancellationToken cancellationToken)
    {
        SubscriptionPayment? payment = null;
        string? externalTxnNo = request.GatewayTransactionNo;

        if (request.VnpayParams != null && request.VnpayParams.Count > 0)
        {
            if (_vnpayPaymentService == null)
            {
                throw new BadRequestException("ERR_VNPAY_UNAVAILABLE", "Dịch vụ xác thực chữ ký VNPay chưa được cấu hình.");
            }

            var verify = _vnpayPaymentService.VerifyCallback(request.VnpayParams);
            if (!verify.IsSignatureValid || verify.ResponseCode == "97")
            {
                throw new BadRequestException("ERR_VNPAY_INVALID_SIGNATURE", verify.Message ?? "Chữ ký VNPay (SecureHash) không hợp lệ.");
            }

            if (!verify.IsSuccess)
            {
                throw new BadRequestException("ERR_VNPAY_FAILED", verify.Message ?? "Giao dịch VNPay không thành công.");
            }

            if (string.IsNullOrWhiteSpace(verify.TxnRef))
            {
                throw new NotFoundException("Không tìm thấy mã tham chiếu giao dịch VNPay.");
            }

            payment = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(p => p.TransactionRef == verify.TxnRef, cancellationToken);

            if (payment == null)
            {
                throw new NotFoundException(nameof(SubscriptionPayment), verify.TxnRef);
            }

            if (_currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
            {
                var callerTenantId = _tenantService.TenantId ?? _currentUser.TenantId;
                if (callerTenantId.HasValue && callerTenantId.Value != Guid.Empty && payment.TenantId != callerTenantId.Value)
                {
                    throw new ForbiddenException("ERR_TENANT_MISMATCH", "Giao dịch thanh toán không thuộc doanh nghiệp hiện tại.");
                }
            }

            if (verify.Amount > 0m && Math.Abs(payment.Amount - verify.Amount) > 100m)
            {
                throw new BadRequestException("ERR_AMOUNT_MISMATCH", "Số tiền thanh toán VNPay không khớp với hóa đơn nâng cấp.");
            }

            externalTxnNo ??= verify.TransactionNo;
        }
        else if (request.PaymentId.HasValue)
        {
            var isSuperAdmin = _currentUser.GlobalRole == GlobalUserRole.SuperAdmin;
            var tenantId = _tenantService.TenantId ?? _currentUser.TenantId;
            if (!isSuperAdmin && (!tenantId.HasValue || tenantId.Value == Guid.Empty))
            {
                throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
            }

            payment = await _context.SubscriptionPayments
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(
                    p => p.Id == request.PaymentId.Value &&
                         (isSuperAdmin || p.TenantId == tenantId!.Value),
                    cancellationToken);

            if (payment == null)
            {
                throw new NotFoundException(nameof(SubscriptionPayment), request.PaymentId.Value);
            }

            if (payment.Status != PaymentStatus.Completed && !isSuperAdmin)
            {
                throw new ForbiddenException(
                    "ERR_VNPAY_SIGNATURE_REQUIRED",
                    "Không thể tự kích hoạt gói cước khi giao dịch VNPay chưa hoàn tất hoặc thiếu xác thực từ Quản trị Nền tảng.");
            }
        }

        if (payment == null)
        {
            throw new NotFoundException("Không tìm thấy giao dịch thanh toán gói cước.");
        }

        return await ActivatePaymentAndUpgradeAsync(
            _context,
            _tenantService,
            _currentUser.UserId != Guid.Empty ? _currentUser.UserId : null,
            _currentUser.IpAddress,
            payment,
            externalTxnNo,
            cancellationToken);
    }

    internal static async Task<ConfirmSubscriptionPaymentResultDto> ActivatePaymentAndUpgradeAsync(
        IApplicationDbContext context,
        ICurrentTenantService? tenantService,
        Guid? actorUserId,
        string? ipAddress,
        SubscriptionPayment payment,
        string? externalTxnNo,
        CancellationToken cancellationToken)
    {
        if (tenantService != null)
        {
            tenantService.TenantId = payment.TenantId;
        }

        var subscription = await context.Subscriptions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(s => s.Id == payment.SubscriptionId && s.TenantId == payment.TenantId, cancellationToken);

        if (subscription == null)
        {
            throw new NotFoundException(nameof(Subscription), payment.SubscriptionId);
        }

        var catalog = await SubscriptionCatalogHelper.LoadCatalogAsync(context, activeOnly: false, cancellationToken);
        var (parsedTier, parsedCycle) = SubscriptionCatalogHelper.ParseUpgradeMetadata(
            payment.TransactionRef,
            payment.InvoiceNumber);

        var targetTier = parsedTier ?? subscription.Tier;
        var billingCycle = parsedCycle ?? subscription.BillingCycle;
        var targetPlan = SubscriptionCatalogHelper.ResolvePlanForTier(catalog, targetTier);

        if (payment.Status == PaymentStatus.Completed)
        {
            return new ConfirmSubscriptionPaymentResultDto(
                PaymentId: payment.Id,
                SubscriptionId: subscription.Id,
                TenantId: payment.TenantId,
                PaymentStatus: payment.Status.ToString(),
                AlreadyConfirmed: true,
                TransactionRef: payment.TransactionRef ?? string.Empty,
                NewTier: (int)subscription.Tier,
                NewTierName: SubscriptionCatalogHelper.ResolvePlanForTier(catalog, subscription.Tier).Name,
                BillingCycle: subscription.BillingCycle.ToString(),
                CurrentPeriodStartUtc: subscription.CurrentPeriodStartUtc,
                CurrentPeriodEndUtc: subscription.CurrentPeriodEndUtc,
                Message: "Giao dịch nâng cấp đã được xác nhận trước đó."
            );
        }

        if (payment.Status != PaymentStatus.Pending)
        {
            throw new ConflictException("ERR_PAYMENT_INVALID_STATE", "Giao dịch không ở trạng thái chờ thanh toán.");
        }

        var now = DateTime.UtcNow;
        var previousTier = subscription.Tier;

        payment.Status = PaymentStatus.Completed;
        payment.PaidAtUtc = now;
        payment.UpdatedAtUtc = now;

        subscription.Tier = targetTier;
        subscription.BillingCycle = billingCycle;
        subscription.Status = SubscriptionStatus.Active;
        subscription.PricePerCycle = payment.Amount;
        subscription.CurrentPeriodStartUtc = now;
        subscription.CurrentPeriodEndUtc = billingCycle == BillingCycle.Annual
            ? now.AddYears(1)
            : now.AddMonths(1);
        subscription.UpdatedAtUtc = now;

        var tenant = await context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == payment.TenantId, cancellationToken);

        if (tenant != null)
        {
            tenant.SubscriptionTier = targetTier;
            tenant.UpdatedAtUtc = now;
        }

        try
        {
            context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = payment.TenantId,
                PropertyId = null,
                UserId = actorUserId,
                Action = AuditActions.Upgrade,
                EntityName = "SubscriptionUpgrade",
                EntityId = subscription.Id,
                OldValues = JsonSerializer.Serialize(new { Tier = previousTier.ToString() }),
                NewValues = JsonSerializer.Serialize(new
                {
                    Tier = targetTier.ToString(),
                    BillingCycle = billingCycle.ToString(),
                    PaymentId = payment.Id,
                    Amount = payment.Amount,
                    GatewayTransactionNo = externalTxnNo
                }),
                IpAddress = ipAddress,
                CreatedAtUtc = now
            });
        }
        catch (NotImplementedException)
        {
            // Optional DbSet in legacy unit test fakes
        }

        await context.SaveChangesAsync(cancellationToken);

        return new ConfirmSubscriptionPaymentResultDto(
            PaymentId: payment.Id,
            SubscriptionId: subscription.Id,
            TenantId: payment.TenantId,
            PaymentStatus: payment.Status.ToString(),
            AlreadyConfirmed: false,
            TransactionRef: payment.TransactionRef ?? string.Empty,
            NewTier: (int)targetTier,
            NewTierName: targetPlan.Name,
            BillingCycle: billingCycle.ToString(),
            CurrentPeriodStartUtc: subscription.CurrentPeriodStartUtc,
            CurrentPeriodEndUtc: subscription.CurrentPeriodEndUtc,
            Message: $"Thanh toán hoàn tất. Gói dịch vụ đã được nâng cấp lên {targetPlan.Name}."
        );
    }
}

public sealed record ProcessSubscriptionVnpayIpnCommand(IDictionary<string, string> QueryParams)
    : IRequest<VnpayIpnResponseDto>;

public sealed class ProcessSubscriptionVnpayIpnCommandHandler
    : IRequestHandler<ProcessSubscriptionVnpayIpnCommand, VnpayIpnResponseDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IVnpayPaymentService _vnpayService;
    private readonly ICurrentTenantService? _tenantService;

    public ProcessSubscriptionVnpayIpnCommandHandler(
        IApplicationDbContext context,
        IVnpayPaymentService vnpayService,
        ICurrentTenantService? tenantService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _vnpayService = vnpayService ?? throw new ArgumentNullException(nameof(vnpayService));
        _tenantService = tenantService;
    }

    public async Task<VnpayIpnResponseDto> Handle(
        ProcessSubscriptionVnpayIpnCommand request,
        CancellationToken cancellationToken)
    {
        var verify = _vnpayService.VerifyCallback(request.QueryParams);
        if (!verify.IsSignatureValid || verify.ResponseCode == "97")
        {
            return new VnpayIpnResponseDto("97", "Invalid Checksum");
        }

        if (string.IsNullOrWhiteSpace(verify.TxnRef))
        {
            return new VnpayIpnResponseDto("01", "Order not found");
        }

        var payment = await _context.SubscriptionPayments
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(p => p.TransactionRef == verify.TxnRef, cancellationToken);

        if (payment == null)
        {
            return new VnpayIpnResponseDto("01", "Order not found");
        }

        if (verify.Amount > 0m && Math.Abs(payment.Amount - verify.Amount) > 100m)
        {
            return new VnpayIpnResponseDto("04", "Invalid amount");
        }

        if (payment.Status == PaymentStatus.Completed)
        {
            return new VnpayIpnResponseDto("02", "Order already confirmed");
        }

        if (!verify.IsSuccess)
        {
            payment.Status = PaymentStatus.Failed;
            payment.UpdatedAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return new VnpayIpnResponseDto("00", "Confirm Failed Transaction");
        }

        await ConfirmSubscriptionPaymentCommandHandler.ActivatePaymentAndUpgradeAsync(
            _context,
            _tenantService,
            actorUserId: null,
            ipAddress: null,
            payment,
            verify.TransactionNo,
            cancellationToken);

        return new VnpayIpnResponseDto("00", "Confirm Success");
    }
}
