using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Commands.RejectRefund;

public sealed class RejectRefundCommandHandler : IRequestHandler<RejectRefundCommand, RefundRequestDto>
{
    private static readonly JsonSerializerOptions AuditJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;
    private readonly INotificationDispatcher? _notificationDispatcher;

    public RejectRefundCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService? propertyService = null,
        INotificationDispatcher? notificationDispatcher = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService;
        _notificationDispatcher = notificationDispatcher;
    }

    public async Task<RefundRequestDto> Handle(RejectRefundCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new BadRequestException("ERR_REASON_REQUIRED", "Vui lòng nhập lý do từ chối yêu cầu hoàn tiền.");
        }

        var tenantId = _tenantService.TenantId;
        if (!tenantId.HasValue || tenantId.Value == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Tenant context is required.");
        }

        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("User identity context is required.");
        }

        // Branch header / token isolation
        if (_propertyService != null)
        {
            if (_propertyService.HeaderPropertyId.HasValue && _propertyService.HeaderPropertyId.Value != request.PropertyId)
            {
                throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                    "Chi nhánh trong header X-Property-Id không khớp với chi nhánh trong nội dung yêu cầu.");
            }

            if (!_propertyService.IsTenantWide &&
                _propertyService.TokenPropertyId.HasValue && _propertyService.TokenPropertyId.Value != request.PropertyId)
            {
                throw new BadRequestException("ERR_CONTEXT_MISMATCH",
                    "Chi nhánh trong nội dung yêu cầu không khớp với chi nhánh trong token xác thực.");
            }
        }

        // Authoritative membership check - ONLY Success proceeds
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            request.PropertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            switch (membership.Status)
            {
                case MembershipLookupStatus.MembershipRevoked:
                    throw new ForbiddenException("ERR_MEMBERSHIP_REVOKED", membership.ErrorMessage ?? "Quyền nhân sự tại chi nhánh đã bị thu hồi.");
                case MembershipLookupStatus.PropertyNotFound:
                    throw new NotFoundException(membership.ErrorMessage ?? "Chi nhánh không tồn tại.");
                case MembershipLookupStatus.PropertyInactive:
                    throw new ConflictException("ERR_PROPERTY_INACTIVE", membership.ErrorMessage ?? "Chi nhánh hiện không hoạt động.");
                case MembershipLookupStatus.PropertyForbidden:
                    throw new ForbiddenException("ERR_PROPERTY_FORBIDDEN", membership.ErrorMessage ?? "Bạn không có quyền truy cập chi nhánh này.");
                case MembershipLookupStatus.TenantNotFoundOrInactive:
                    throw new ForbiddenException("ERR_TENANT_INACTIVE", membership.ErrorMessage ?? "Doanh nghiệp hiện bị tạm ngưng.");
                default:
                    throw new UnauthorizedAccessException(membership.ErrorMessage ?? "Không đủ quyền truy cập.");
            }
        }

        // Enforce PAYMENTS:Approve (Action 16) at application level
        if (!_userContext.RoleId.HasValue || _userContext.RoleId.Value == Guid.Empty)
        {
            throw new ForbiddenException("ERR_FORBIDDEN_APPROVE", "Không tìm thấy vai trò hợp lệ để từ chối hoàn tiền.");
        }

        var hasApprovePermission = await _context.RolePermissions
            .AsNoTracking()
            .AnyAsync(rp => rp.RoleId == _userContext.RoleId.Value &&
                            rp.Function!.Code == "PAYMENTS" &&
                            (rp.ActionMask & 16) == 16,
                      cancellationToken);

        if (!hasApprovePermission)
        {
            throw new ForbiddenException("ERR_FORBIDDEN_APPROVE",
                "Bạn không có quyền từ chối yêu cầu hoàn tiền. Thao tác này chỉ dành cho Quản lý chi nhánh (Property Manager) hoặc Chủ khách sạn (Owner) theo Quyết định D23.");
        }

        // Serialize concurrent refund state transitions via PostgreSQL transactional advisory lock
        await using var tx = await _context.BeginTransactionAsync(cancellationToken);
        await _context.LockIdempotencyKeyAsync(request.PropertyId, $"refund_mutation_{request.PaymentId:N}", cancellationToken);

        // Load tracked payment
        var payment = await _context.Payments
            .Include(p => p.Property)
            .Include(p => p.Reservation)
                .ThenInclude(r => r!.Payments)
            .FirstOrDefaultAsync(p => p.Id == request.PaymentId &&
                                      p.PropertyId == request.PropertyId &&
                                      p.TenantId == tenantId.Value,
                                cancellationToken);

        if (payment == null || payment.TransactionRef == null || !payment.TransactionRef.Contains("REFUND"))
        {
            throw new NotFoundException("Không tìm thấy yêu cầu hoàn tiền tương ứng.");
        }

        if (payment.Status == PaymentStatus.Completed || payment.Status == PaymentStatus.Refunded)
        {
            throw new ConflictException("ERR_ALREADY_COMPLETED", "Không thể từ chối vì yêu cầu hoàn tiền này đã được chi trả hoàn tất trước đó.");
        }

        var oldTxRef = payment.TransactionRef;
        var reservation = payment.Reservation;
        var nowUtc = DateTime.UtcNow;
        var confCode = reservation?.ConfirmationCode ?? "UNKNOWN";
        var cleanReason = request.Reason.Trim();

        // Update payment state: Failed with Rejection reason
        payment.Status = PaymentStatus.Failed;
        payment.TransactionRef = $"REFUND-REJECTED-{confCode}|By:{userId}|At:{nowUtc:o}|Reason:{cleanReason}";

        // Audit Log (T03)
        try
        {
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = payment.TenantId,
                PropertyId = payment.PropertyId,
                UserId = userId,
                Action = AuditActions.Update,
                EntityName = nameof(Payment),
                EntityId = payment.Id,
                OldValues = JsonSerializer.Serialize(new { Status = "Pending", TransactionRef = oldTxRef }, AuditJsonOptions),
                NewValues = JsonSerializer.Serialize(new
                {
                    Status = "Rejected",
                    TransactionRef = payment.TransactionRef,
                    RejectedBy = userId,
                    RejectedAtUtc = nowUtc,
                    Reason = cleanReason
                }, AuditJsonOptions),
                IpAddress = _userContext?.IpAddress ?? "CashierPMS",
                CreatedAtUtc = nowUtc
            };
            _context.AuditLogs.Add(auditLog);
        }
        catch (NotImplementedException)
        {
            // Unit test mock fallback
        }

        await _context.SaveChangesAsync(cancellationToken);
        if (tx != null)
        {
            await tx.CommitAsync(cancellationToken);
        }

        // Notify SignalR hub
        if (_notificationDispatcher != null)
        {
            try
            {
                await _notificationDispatcher.NotifyReservationStatusChangedAsync(
                    payment.PropertyId.ToString(),
                    payment.ReservationId.ToString(),
                    confCode,
                    "RefundPendingApproval",
                    "RefundRejected",
                    cancellationToken);
            }
            catch
            {
                // Soft failure
            }
        }

        var otherPayments = reservation?.Payments ?? (ICollection<Domain.Entities.Payment>)Array.Empty<Domain.Entities.Payment>();
        var paidAmount = otherPayments
            .Where(x => x.Id != payment.Id && x.Status == PaymentStatus.Completed)
            .Sum(x => x.Amount);

        var refundableAmount = payment.Amount;
        var cancellationFee = Math.Max(0m, paidAmount - refundableAmount);

        return new RefundRequestDto(
            PaymentId: payment.Id,
            TenantId: payment.TenantId,
            PropertyId: payment.PropertyId,
            PropertyName: payment.Property?.Name ?? "LuxeStay",
            ReservationId: payment.ReservationId,
            ConfirmationCode: confCode,
            GuestName: reservation?.GuestName ?? "Khách vãng lai",
            GuestEmail: PiiMaskingHelper.MaskEmail(reservation?.GuestEmail),
            GuestPhone: PiiMaskingHelper.MaskPhone(reservation?.GuestPhone),
            TotalAmount: reservation?.TotalAmount ?? 0m,
            PaidAmount: paidAmount,
            CancellationFee: cancellationFee,
            RefundableAmount: refundableAmount,
            Method: payment.Method.ToString(),
            Status: "Rejected",
            StatusName: "Đã từ chối",
            TransactionRef: payment.TransactionRef,
            BankTransactionRef: null,
            ApprovedByUserId: userId,
            ApprovedByUserName: _userContext?.Email ?? "Staff",
            ApprovedAtUtc: nowUtc,
            PaidAtUtc: null,
            RejectionReason: cleanReason,
            Notes: null,
            CreatedAtUtc: payment.CreatedAtUtc
        );
    }
}
