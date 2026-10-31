using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reservations.Queries.GetReservationCancellationPreview;

public sealed class GetReservationCancellationPreviewQueryHandler
    : IRequestHandler<GetReservationCancellationPreviewQuery, CancellationEstimateResult>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICancellationPolicyService _cancellationPolicyService;

    public GetReservationCancellationPreviewQueryHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentUserContext userContext,
        IMembershipLookupService membershipLookupService,
        ICurrentPropertyService propertyService,
        ICancellationPolicyService cancellationPolicyService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
        _membershipLookupService = membershipLookupService ?? throw new ArgumentNullException(nameof(membershipLookupService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _cancellationPolicyService = cancellationPolicyService ?? throw new ArgumentNullException(nameof(cancellationPolicyService));
    }

    public async Task<CancellationEstimateResult> Handle(
        GetReservationCancellationPreviewQuery request,
        CancellationToken cancellationToken)
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

        // Context header / token validation
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

        // Authoritative membership check
        var membership = await _membershipLookupService.ResolveMembershipAsync(
            tenantId.Value,
            userId,
            request.PropertyId,
            cancellationToken);

        if (membership.Status != MembershipLookupStatus.Success)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền thực hiện thao tác trên chi nhánh này.");
        }

        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId && p.TenantId == tenantId.Value, cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        var reservation = await _context.Reservations
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId &&
                                      r.PropertyId == request.PropertyId &&
                                      r.TenantId == tenantId.Value, cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy đơn đặt phòng.");
        }

        var payments = await _context.Payments
            .AsNoTracking()
            .Where(p => p.ReservationId == reservation.Id)
            .ToListAsync(cancellationToken);

        var paidAmount = payments
            .Where(p => p.Status == PaymentStatus.Completed)
            .Sum(p => p.Amount);

        var hasPendingPayments = payments
            .Any(p => p.Status == PaymentStatus.Pending);

        var pendingPaymentAmount = payments
            .Where(p => p.Status == PaymentStatus.Pending)
            .Sum(p => p.Amount);

        return _cancellationPolicyService.CalculateEstimate(
            reservation,
            property,
            DateTime.UtcNow,
            paidAmount,
            hasPendingPayments,
            pendingPaymentAmount);
    }
}

