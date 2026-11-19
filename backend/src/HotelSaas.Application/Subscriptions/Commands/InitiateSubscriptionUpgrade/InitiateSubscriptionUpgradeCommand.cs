using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Subscriptions.Common;
using HotelSaas.Application.Subscriptions.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Subscriptions.Commands.InitiateSubscriptionUpgrade;

public sealed record InitiateSubscriptionUpgradeCommand(
    int TargetTier,
    BillingCycle BillingCycle = BillingCycle.Monthly,
    string? ClientIp = null,
    string? ReturnUrl = null
) : IRequest<SubscriptionUpgradeInitiationDto>;

public sealed class InitiateSubscriptionUpgradeCommandValidator
    : AbstractValidator<InitiateSubscriptionUpgradeCommand>
{
    public InitiateSubscriptionUpgradeCommandValidator()
    {
        RuleFor(x => x.TargetTier)
            .Must(v => Enum.IsDefined(typeof(SubscriptionTier), v))
            .WithMessage("Gói cước nâng cấp không hợp lệ.");

        RuleFor(x => x.BillingCycle)
            .IsInEnum().WithMessage("Chu kỳ thanh toán không hợp lệ.");

        RuleFor(x => x.ReturnUrl)
            .MaximumLength(500).WithMessage("URL quay lại không được vượt quá 500 ký tự.")
            .Must(url => string.IsNullOrWhiteSpace(url) ||
                         Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
                         (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
            .WithMessage("URL quay lại VNPay phải là địa chỉ HTTP/HTTPS hợp lệ.");
    }
}

public sealed class InitiateSubscriptionUpgradeCommandHandler
    : IRequestHandler<InitiateSubscriptionUpgradeCommand, SubscriptionUpgradeInitiationDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _currentUser;
    private readonly IVnpayPaymentService? _vnpayPaymentService;

    public InitiateSubscriptionUpgradeCommandHandler(
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

    public async Task<SubscriptionUpgradeInitiationDto> Handle(
        InitiateSubscriptionUpgradeCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = _tenantService.TenantId ?? _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_TENANT_REQUIRED", "Yêu cầu ngữ cảnh doanh nghiệp hợp lệ.");
        }

        var targetTier = (SubscriptionTier)request.TargetTier;
        var catalog = await SubscriptionCatalogHelper.LoadCatalogAsync(_context, activeOnly: false, cancellationToken);
        var targetPlan = SubscriptionCatalogHelper.ResolvePlanForTier(catalog, targetTier);

        var now = DateTime.UtcNow;
        var subscription = await _context.Subscriptions
            .IgnoreQueryFilters()
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        if (subscription == null)
        {
            var basePlan = SubscriptionCatalogHelper.ResolvePlanForTier(catalog, SubscriptionTier.Basic);
            subscription = new Subscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId.Value,
                Tier = SubscriptionTier.Basic,
                BillingCycle = BillingCycle.Monthly,
                Status = SubscriptionStatus.Active,
                PricePerCycle = basePlan.MonthlyPrice,
                Currency = "VND",
                CurrentPeriodStartUtc = now,
                CurrentPeriodEndUtc = now.AddMonths(1),
                AutoRenew = true,
                CreatedAtUtc = now,
                UpdatedAtUtc = now
            };
            _context.Subscriptions.Add(subscription);
        }

        var amount = request.BillingCycle == BillingCycle.Annual
            ? targetPlan.AnnualPrice
            : targetPlan.MonthlyPrice;

        if (amount <= 0m)
        {
            amount = targetTier switch
            {
                SubscriptionTier.Enterprise => request.BillingCycle == BillingCycle.Annual ? 14990000m : 1499000m,
                SubscriptionTier.Pro => request.BillingCycle == BillingCycle.Annual ? 6990000m : 699000m,
                _ => request.BillingCycle == BillingCycle.Annual ? 2990000m : 299000m
            };
        }

        var shortSuffix = Guid.NewGuid().ToString("N")[..10].ToUpperInvariant();
        var transactionRef = $"SUB_{(int)targetTier}_{(int)request.BillingCycle}_{shortSuffix}";
        var invoiceNumber = $"INV-SUB-{now:yyyyMMdd}-{(int)targetTier}-{(int)request.BillingCycle}-{shortSuffix[..6]}";

        var pendingPayment = new SubscriptionPayment
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId.Value,
            SubscriptionId = subscription.Id,
            Amount = amount,
            Method = PaymentMethod.VNPay,
            Status = PaymentStatus.Pending,
            TransactionRef = transactionRef,
            InvoiceNumber = invoiceNumber,
            PaidAtUtc = null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        _context.SubscriptionPayments.Add(pendingPayment);
        await _context.SaveChangesAsync(cancellationToken);

        string? paymentUrl = null;
        if (_vnpayPaymentService != null)
        {
            try
            {
                var clientIp = string.IsNullOrWhiteSpace(request.ClientIp)
                    ? (_currentUser.IpAddress ?? "127.0.0.1")
                    : request.ClientIp;
                var orderInfo = $"Nang cap goi {targetPlan.Name} ({request.BillingCycle}) - {invoiceNumber}";
                var urlResult = _vnpayPaymentService.CreatePaymentUrl(
                    subscription.Id,
                    transactionRef,
                    amount,
                    orderInfo,
                    clientIp,
                    request.ReturnUrl);
                paymentUrl = urlResult.PaymentUrl;
            }
            catch (InvalidOperationException)
            {
                // VNPay gateway credentials may be unset in offline/test environments; pending payment remains created for verification.
                paymentUrl = null;
            }
        }

        return new SubscriptionUpgradeInitiationDto(
            PaymentId: pendingPayment.Id,
            SubscriptionId: subscription.Id,
            TenantId: tenantId.Value,
            TargetTier: (int)targetTier,
            TargetTierName: targetPlan.Name,
            BillingCycle: request.BillingCycle.ToString(),
            Amount: amount,
            Currency: subscription.Currency,
            PaymentStatus: pendingPayment.Status.ToString(),
            TransactionRef: transactionRef,
            InvoiceNumber: invoiceNumber,
            PaymentUrl: paymentUrl,
            IsImmediateActivation: false,
            Message: "Đã tạo hóa đơn thanh toán nâng cấp gói cước ở trạng thái Chờ xác nhận. Gói dịch vụ sẽ tự động nâng cấp sau khi giao dịch VNPay hoàn tất."
        );
    }
}
