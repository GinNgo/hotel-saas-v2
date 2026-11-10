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
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Queries.GetRefundRequests;

public sealed class GetRefundRequestsQueryHandler : IRequestHandler<GetRefundRequestsQuery, PagedResult<RefundRequestDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public GetRefundRequestsQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService? propertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService;
    }

    public async Task<PagedResult<RefundRequestDto>> Handle(GetRefundRequestsQuery request, CancellationToken cancellationToken)
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

        // Base query for refund payments
        var query = _context.Payments
            .AsNoTracking()
            .Include(p => p.Property)
            .Include(p => p.Reservation)
            .Where(p => p.TenantId == tenantId.Value &&
                        p.PropertyId == request.PropertyId &&
                        p.TransactionRef != null &&
                        p.TransactionRef.Contains("REFUND"));

        // Status Filter
        if (!string.IsNullOrWhiteSpace(request.Status) && !string.Equals(request.Status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var filterStatus = request.Status.Trim();
            if (string.Equals(filterStatus, "PendingApproval", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(p => p.Status == PaymentStatus.Pending &&
                                         !p.TransactionRef!.Contains("APPROVED") &&
                                         !p.TransactionRef!.Contains("REJECTED"));
            }
            else if (string.Equals(filterStatus, "Approved", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(p => p.Status == PaymentStatus.Pending &&
                                         p.TransactionRef!.Contains("APPROVED"));
            }
            else if (string.Equals(filterStatus, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(p => p.Status == PaymentStatus.Completed || p.Status == PaymentStatus.Refunded);
            }
            else if (string.Equals(filterStatus, "Rejected", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(p => p.Status == PaymentStatus.Failed || p.TransactionRef!.Contains("REJECTED"));
            }
        }

        // Date filters
        if (request.DateFrom.HasValue)
        {
            var startUtc = request.DateFrom.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            query = query.Where(p => p.CreatedAtUtc >= startUtc);
        }

        if (request.DateTo.HasValue)
        {
            var endUtc = request.DateTo.Value.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
            query = query.Where(p => p.CreatedAtUtc <= endUtc);
        }

        // Search term filter (Confirmation code or Guest Name)
        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var term = request.SearchTerm.Trim().ToUpper();
            query = query.Where(p => (p.Reservation != null && p.Reservation.ConfirmationCode.ToUpper().Contains(term)) ||
                                     (p.Reservation != null && p.Reservation.GuestName.ToUpper().Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = request.Page > 0 ? request.Page : 1;
        var pageSize = request.PageSize > 0 && request.PageSize <= 100 ? request.PageSize : 20;

        var payments = await query
            .OrderByDescending(p => p.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var reservationIds = payments
            .Where(p => p.ReservationId != Guid.Empty)
            .Select(p => p.ReservationId)
            .Distinct()
            .ToList();

        var paidAmounts = new Dictionary<Guid, decimal>();
        if (reservationIds.Count > 0)
        {
            paidAmounts = await _context.Payments
                .AsNoTracking()
                .Where(x => reservationIds.Contains(x.ReservationId) &&
                            x.Status == PaymentStatus.Completed &&
                            (x.TransactionRef == null || !x.TransactionRef.Contains("REFUND")))
                .GroupBy(x => x.ReservationId)
                .Select(g => new { ReservationId = g.Key, TotalPaid = g.Sum(x => x.Amount) })
                .ToDictionaryAsync(x => x.ReservationId, x => x.TotalPaid, cancellationToken);
        }

        var approverUserIds = new HashSet<Guid>();
        foreach (var p in payments)
        {
            var txRef = p.TransactionRef ?? string.Empty;
            var byStr = ExtractSegment(txRef, "By:");
            if (!string.IsNullOrEmpty(byStr) && Guid.TryParse(byStr, out var uid))
            {
                approverUserIds.Add(uid);
            }
        }

        var approverNames = new Dictionary<Guid, string>();
        if (approverUserIds.Count > 0)
        {
            try
            {
                approverNames = await _context.Users
                    .AsNoTracking()
                    .Where(u => approverUserIds.Contains(u.Id))
                    .Select(u => new { u.Id, Name = !string.IsNullOrWhiteSpace(u.FullName) ? u.FullName : u.Email })
                    .ToDictionaryAsync(u => u.Id, u => u.Name, cancellationToken);
            }
            catch
            {
                // Soft fallback for mock DbContexts
            }
        }

        var items = new List<RefundRequestDto>();

        foreach (var p in payments)
        {
            var reservation = p.Reservation;
            var confCode = reservation?.ConfirmationCode ?? "UNKNOWN";
            var guestName = reservation?.GuestName ?? "Khách vãng lai";
            var guestPhone = reservation?.GuestPhone;
            var guestEmail = reservation?.GuestEmail;
            var totalAmount = reservation?.TotalAmount ?? 0m;

            var paidAmount = paidAmounts.TryGetValue(p.ReservationId, out var val) ? val : 0m;

            var refundableAmount = p.Amount;
            var cancellationFee = Math.Max(0m, paidAmount - refundableAmount);

            // Compute normalized status and human readable name
            string status;
            string statusName;

            var txRef = p.TransactionRef ?? string.Empty;
            if (p.Status == PaymentStatus.Failed || txRef.Contains("REJECTED"))
            {
                status = "Rejected";
                statusName = "Đã từ chối";
            }
            else if (p.Status == PaymentStatus.Completed || p.Status == PaymentStatus.Refunded)
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

            // Extract metadata if formatted as composite
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
                approverNames.TryGetValue(parsedBy, out approvedByUserName);
            }

            items.Add(new RefundRequestDto(
                PaymentId: p.Id,
                TenantId: p.TenantId,
                PropertyId: p.PropertyId,
                PropertyName: p.Property?.Name ?? "LuxeStay",
                ReservationId: p.ReservationId,
                ConfirmationCode: confCode,
                GuestName: guestName,
                GuestEmail: PiiMaskingHelper.MaskEmail(guestEmail),
                GuestPhone: PiiMaskingHelper.MaskPhone(guestPhone),
                TotalAmount: totalAmount,
                PaidAmount: paidAmount,
                CancellationFee: cancellationFee,
                RefundableAmount: refundableAmount,
                Method: p.Method.ToString(),
                Status: status,
                StatusName: statusName,
                TransactionRef: p.TransactionRef,
                BankTransactionRef: bankTxRef,
                ApprovedByUserId: approvedByUserId,
                ApprovedByUserName: approvedByUserName,
                ApprovedAtUtc: approvedAtUtc,
                PaidAtUtc: p.PaidAtUtc,
                RejectionReason: rejectionReason,
                Notes: reservation?.CancellationReason,
                CreatedAtUtc: p.CreatedAtUtc
            ));
        }

        return new PagedResult<RefundRequestDto>(items, totalCount, page, pageSize);
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
