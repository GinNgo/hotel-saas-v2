using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reviews.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Commands.ToggleReviewVisibility;

/// <summary>
/// PMS command to publish or hide a guest review from public property listings.
/// </summary>
public sealed record ToggleReviewVisibilityCommand(
    Guid ReviewId,
    bool IsPublished
) : IRequest<PmsGuestReviewItemDto>;

public sealed class ToggleReviewVisibilityCommandHandler
    : IRequestHandler<ToggleReviewVisibilityCommand, PmsGuestReviewItemDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IAuditLogService? _auditLogService;

    public ToggleReviewVisibilityCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        IAuditLogService? auditLogService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _auditLogService = auditLogService;
    }

    public async Task<PmsGuestReviewItemDto> Handle(
        ToggleReviewVisibilityCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = PmsReviewMapper.RequireTenantId(_tenantService);

        var review = await _context.GuestReviews
            .IgnoreQueryFilters()
            .Include(r => r.Reservation)
                .ThenInclude(res => res!.Property)
            .Include(r => r.Reservation)
                .ThenInclude(res => res!.Room)
                    .ThenInclude(rm => rm!.RoomType)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == request.ReviewId, cancellationToken);

        if (review == null)
        {
            throw new NotFoundException("Không tìm thấy đánh giá khách hàng.");
        }

        PmsReviewMapper.EnsureMutationBranchAccess(review, tenantId, _propertyService);

        var oldPublished = review.IsPublished;
        review.IsPublished = request.IsPublished;
        review.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        if (_auditLogService != null)
        {
            await _auditLogService.RecordActionAsync(
                "Update",
                "GuestReview",
                review.Id,
                new { IsPublished = oldPublished },
                new { IsPublished = review.IsPublished },
                review.Reservation?.PropertyId,
                cancellationToken);
        }

        return PmsReviewMapper.ToPmsItemDto(review);
    }
}
