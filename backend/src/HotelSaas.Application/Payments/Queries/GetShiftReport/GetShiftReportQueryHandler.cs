using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Payments.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Payments.Queries.GetShiftReport;

/// <summary>
/// Handles retrieving verified cashier shift collections and line-item transaction audit,
/// strictly separated from daily revenue aggregation.
/// </summary>
public sealed class GetShiftReportQueryHandler : IRequestHandler<GetShiftReportQuery, ShiftReportDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public GetShiftReportQueryHandler(
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

    public async Task<ShiftReportDto> Handle(GetShiftReportQuery request, CancellationToken cancellationToken)
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

        // Vietnam local date (UTC+7)
        var vnNow = DateTime.UtcNow.AddHours(7);
        var targetDate = request.Date ?? DateOnly.FromDateTime(vnNow);

        DateTime startVn;
        DateTime endVn;
        string shiftName;

        switch (request.ShiftType)
        {
            case ShiftType.Afternoon:
                shiftName = "Ca 2 - Chiều (14:00 - 22:00)";
                startVn = targetDate.ToDateTime(new TimeOnly(14, 0, 0));
                endVn = targetDate.ToDateTime(new TimeOnly(22, 0, 0));
                break;
            case ShiftType.Night:
                shiftName = "Ca 3 - Đêm (22:00 - 06:00 sáng hôm sau)";
                startVn = targetDate.ToDateTime(new TimeOnly(22, 0, 0));
                endVn = targetDate.AddDays(1).ToDateTime(new TimeOnly(6, 0, 0));
                break;
            case ShiftType.Morning:
            default:
                shiftName = "Ca 1 - Sáng (06:00 - 14:00)";
                startVn = targetDate.ToDateTime(new TimeOnly(6, 0, 0));
                endVn = targetDate.ToDateTime(new TimeOnly(14, 0, 0));
                break;
        }

        var startUtc = DateTime.SpecifyKind(startVn.AddHours(-7), DateTimeKind.Utc);
        var endUtc = DateTime.SpecifyKind(endVn.AddHours(-7), DateTimeKind.Utc);

        var payments = await _context.Payments
            .AsNoTracking()
            .Where(p =>
                p.TenantId == tenantId.Value &&
                p.PropertyId == request.PropertyId &&
                p.Status == PaymentStatus.Completed &&
                p.PaidAtUtc >= startUtc &&
                p.PaidAtUtc < endUtc)
            .OrderByDescending(p => p.PaidAtUtc)
            .ToListAsync(cancellationToken);

        var totalCollected = payments.Sum(p => p.Amount);
        var cashCollected = payments.Where(p => p.Method == PaymentMethod.Cash).Sum(p => p.Amount);
        var bankTransferCollected = payments.Where(p => p.Method == PaymentMethod.BankTransfer).Sum(p => p.Amount);
        var creditCardCollected = payments.Where(p => p.Method == PaymentMethod.CreditCard).Sum(p => p.Amount);
        var completedCount = payments.Count;

        var paymentDtos = payments.Select(PaymentDto.FromEntity).ToList();

        return new ShiftReportDto(
            request.PropertyId,
            targetDate,
            request.ShiftType,
            shiftName,
            startUtc,
            endUtc,
            totalCollected,
            cashCollected,
            bankTransferCollected,
            creditCardCollected,
            completedCount,
            paymentDtos
        );
    }
}
