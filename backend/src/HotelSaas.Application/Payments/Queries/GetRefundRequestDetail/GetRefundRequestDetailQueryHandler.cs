using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Queries.GetRefundRequestDetail;

public sealed class GetRefundRequestDetailQueryHandler : IRequestHandler<GetRefundRequestDetailQuery, RefundRequestDetailDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICancellationPolicyService _cancellationPolicyService;
    private readonly ICurrentPropertyService? _propertyService;

    public GetRefundRequestDetailQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICancellationPolicyService? cancellationPolicyService = null,
        ICurrentPropertyService? propertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _cancellationPolicyService = cancellationPolicyService ?? new CancellationPolicyService();
        _propertyService = propertyService;
    }

    public async Task<RefundRequestDetailDto> Handle(GetRefundRequestDetailQuery request, CancellationToken cancellationToken)
    {
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

        var payment = await _context.Payments
            .AsNoTracking()
            .Include(p => p.Property)
            .Include(p => p.Reservation)
                .ThenInclude(r => r!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .FirstOrDefaultAsync(p => p.Id == request.PaymentId &&
                                      p.PropertyId == request.PropertyId &&
                                      p.TenantId == tenantId.Value,
                                cancellationToken);

        if (payment == null || payment.TransactionRef == null || !payment.TransactionRef.Contains("REFUND"))
        {
            throw new NotFoundException("Không tìm thấy yêu cầu hoàn tiền tương ứng.");
        }

        var reservation = payment.Reservation;
        if (reservation == null)
        {
            throw new NotFoundException("Đơn đặt phòng liên quan không tồn tại.");
        }

        var originalPaymentEntities = await _context.Payments
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id && p.Id != payment.Id)
            .OrderBy(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var originalPayments = originalPaymentEntities
            .Select(p => new RefundPaymentHistoryDto(
                p.Id,
                p.Amount,
                p.Method.ToString(),
                p.Status.ToString(),
                p.TransactionRef,
                p.PaidAtUtc,
                p.CreatedAtUtc
            ))
            .ToList();

        var paidAmount = originalPayments
            .Where(p => p.StatusName == PaymentStatus.Completed.ToString())
            .Sum(p => p.Amount);

        var property = payment.Property;
        var estimate = _cancellationPolicyService.CalculateEstimate(
            reservation,
            property,
            reservation.CancelledAtUtc ?? payment.CreatedAtUtc,
            paidAmount);

        var txRef = payment.TransactionRef ?? string.Empty;
        string status;
        string statusName;

        if (payment.Status == PaymentStatus.Failed || txRef.Contains("REJECTED"))
        {
            status = "Rejected";
            statusName = "Đã từ chối";
        }
        else if (payment.Status == PaymentStatus.Completed || payment.Status == PaymentStatus.Refunded)
        {
            status = "Completed";
            statusName = "Đã hoàn tiền";
        }
        else if (txRef.Contains("APPROVED"))
        {
            status = "Approved";
            statusName = "Đã duyệt - Chờ chi trả";
        }
        else
        {
            status = "PendingApproval";
            statusName = "Chờ phê duyệt";
        }

        string? bankTxRef = ExtractSegment(txRef, "BankRef:");
        string? rejectionReason = ExtractSegment(txRef, "Reason:");
        DateTime? approvedAtUtc = null;

        var atStr = ExtractSegment(txRef, "At:");
        if (!string.IsNullOrEmpty(atStr) && DateTime.TryParse(atStr, out var parsedAt))
        {
            approvedAtUtc = parsedAt;
        }

        Guid? approvedByUserId = null;
        string? approvedByUserName = null;
        var byStr = ExtractSegment(txRef, "By:");
        if (!string.IsNullOrEmpty(byStr) && Guid.TryParse(byStr, out var parsedBy))
        {
            approvedByUserId = parsedBy;
            try
            {
                var approverUser = await _context.Users
                    .AsNoTracking()
                    .Where(u => u.Id == parsedBy)
                    .Select(u => new { u.FullName, u.Email })
                    .FirstOrDefaultAsync(cancellationToken);
                if (approverUser != null)
                {
                    approvedByUserName = !string.IsNullOrWhiteSpace(approverUser.FullName)
                        ? approverUser.FullName
                        : approverUser.Email;
                }
            }
            catch
            {
                // Soft fallback for mock DbContexts
            }
        }

        // Build audit trail steps
        var auditTrail = new List<RefundAuditStepDto>
        {
            new RefundAuditStepDto(
                StepTitle: "1. Khách gửi yêu cầu hủy đặt phòng",
                Description: $"Đơn phòng đã hủy thành công trên hệ thống. Lý do: {reservation.CancellationReason ?? "Khách tự hủy trực tuyến"}.",
                PerformedBy: reservation.GuestName,
                TimestampUtc: reservation.CancelledAtUtc ?? payment.CreatedAtUtc,
                State: "completed"
            ),
            new RefundAuditStepDto(
                StepTitle: "2. Thẩm định & Phê duyệt theo Quyết định D23",
                Description: status switch
                {
                    "PendingApproval" => "Đang chờ Quản lý chi nhánh (Property Manager) hoặc Chủ khách sạn (Owner) phê duyệt.",
                    "Approved" => "Đã được phê duyệt hợp lệ. Đang chuyển sang bước giải ngân / chi trả.",
                    "Completed" => "Đã được phê duyệt hợp lệ.",
                    "Rejected" => $"Yêu cầu bị từ chối: {rejectionReason ?? "Không đủ điều kiện"}",
                    _ => "Đang xử lý"
                },
                PerformedBy: status == "PendingApproval" ? null : (approvedByUserName ?? "Quản lý có thẩm quyền"),
                TimestampUtc: approvedAtUtc,
                State: status switch
                {
                    "PendingApproval" => "current",
                    "Approved" => "completed",
                    "Completed" => "completed",
                    "Rejected" => "failed",
                    _ => "upcoming"
                }
            ),
            new RefundAuditStepDto(
                StepTitle: "3. Chi trả tiền hoàn & Đối soát chứng từ",
                Description: status switch
                {
                    "PendingApproval" => "Chờ phê duyệt trước khi chi trả.",
                    "Approved" => "Chờ Thu ngân thực hiện chi trả qua ngân hàng/tiền mặt và nhập mã tham chiếu.",
                    "Completed" => $"Đã chi trả thành công. Mã tham chiếu giao dịch: {bankTxRef ?? payment.TransactionRef}",
                    "Rejected" => "Đã hủy luồng chi trả.",
                    _ => "Chờ xử lý"
                },
                PerformedBy: status == "Completed" ? "Thu ngân chi nhánh" : null,
                TimestampUtc: payment.PaidAtUtc,
                State: status switch
                {
                    "Completed" => "completed",
                    "Approved" => "current",
                    "Rejected" => "failed",
                    _ => "upcoming"
                }
            )
        };

        // Determine if current user can approve (Owner or Property Manager)
        // Check RolePermissions for PAYMENTS with action bit 16
        bool canApprove = false;
        if (_userContext.RoleId.HasValue && _userContext.RoleId.Value != Guid.Empty)
        {
            canApprove = await _context.RolePermissions
                .AsNoTracking()
                .AnyAsync(rp => rp.RoleId == _userContext.RoleId.Value &&
                                rp.Function!.Code == "PAYMENTS" &&
                                (rp.ActionMask & 16) == 16,
                          cancellationToken);
        }

        var roomTypeName = reservation.Room?.RoomType?.Name ?? "Tiêu chuẩn";
        var roomNumber = reservation.Room?.RoomNumber ?? "Chưa gán";

        return new RefundRequestDetailDto(
            PaymentId: payment.Id,
            TenantId: payment.TenantId,
            PropertyId: payment.PropertyId,
            PropertyName: property?.Name ?? "LuxeStay",
            ReservationId: reservation.Id,
            ConfirmationCode: reservation.ConfirmationCode,
            GuestName: reservation.GuestName,
            GuestEmail: PiiMaskingHelper.MaskEmail(reservation.GuestEmail),
            GuestPhone: PiiMaskingHelper.MaskPhone(reservation.GuestPhone),
            RoomTypeName: roomTypeName,
            RoomNumber: roomNumber,
            CheckInDate: reservation.CheckInDate,
            CheckOutDate: reservation.CheckOutDate,
            StartAtUtc: estimate.StartAtUtc,
            EndAtUtc: estimate.EndAtUtc,
            TotalAmount: reservation.TotalAmount,
            PaidAmount: paidAmount,
            CancellationFee: estimate.CancellationFee,
            RefundableAmount: payment.Amount,
            Method: payment.Method.ToString(),
            Status: status,
            StatusName: statusName,
            TransactionRef: payment.TransactionRef,
            BankTransactionRef: bankTxRef,
            PolicyDescription: estimate.PolicyDescription,
            IsFreeCancellation: estimate.IsFreeCancellation,
            HoursUntilCheckIn: estimate.HoursUntilCheckIn,
            ApprovedByUserId: approvedByUserId,
            ApprovedByUserName: approvedByUserName,
            ApprovedAtUtc: approvedAtUtc,
            PaidAtUtc: payment.PaidAtUtc,
            RejectionReason: rejectionReason,
            Notes: reservation.CancellationReason,
            CreatedAtUtc: payment.CreatedAtUtc,
            CanApprove: canApprove,
            OriginalPayments: originalPayments,
            AuditTrail: auditTrail
        );
    }

    private static string? ExtractSegment(string text, string prefix)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var segments = text.Split('|');
        foreach (var seg in segments)
        {
            if (seg.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            {
                var val = seg.Substring(prefix.Length).Trim();
                return string.IsNullOrEmpty(val) ? null : val;
            }
        }
        return null;
    }
}
