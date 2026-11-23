using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Reviews.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Commands.ReplyGuestReview;

/// <summary>
/// PMS command allowing authorized property staff/managers/owners to publish or update an official reply to a guest review.
/// </summary>
public sealed record ReplyGuestReviewCommand(
    Guid ReviewId,
    string Reply
) : IRequest<PmsGuestReviewItemDto>;

public sealed class ReplyGuestReviewCommandHandler : IRequestHandler<ReplyGuestReviewCommand, PmsGuestReviewItemDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly IAuditLogService? _auditLogService;

    public ReplyGuestReviewCommandHandler(
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
        ReplyGuestReviewCommand request,
        CancellationToken cancellationToken)
    {
        var tenantId = PmsReviewMapper.RequireTenantId(_tenantService);

        if (string.IsNullOrWhiteSpace(request.Reply))
        {
            throw new BadRequestException("ERR_EMPTY_REPLY", "Nội dung phản hồi không được để trống.");
        }

        var trimmedReply = request.Reply.Trim();
        if (trimmedReply.Length > 2000)
        {
            throw new BadRequestException("ERR_REPLY_TOO_LONG", "Nội dung phản hồi không được vượt quá 2000 ký tự.");
        }

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

        var oldReply = review.OwnerReply;
        var oldRepliedAt = review.RepliedAtUtc;
        var utcNow = DateTime.UtcNow;

        review.OwnerReply = trimmedReply;
        review.RepliedAtUtc = utcNow;
        review.UpdatedAtUtc = utcNow;

        await _context.SaveChangesAsync(cancellationToken);

        if (_auditLogService != null)
        {
            await _auditLogService.RecordActionAsync(
                "Update",
                "GuestReview",
                review.Id,
                new { OwnerReply = oldReply, RepliedAtUtc = oldRepliedAt },
                new { OwnerReply = review.OwnerReply, RepliedAtUtc = review.RepliedAtUtc },
                review.Reservation?.PropertyId,
                cancellationToken);
        }

        return PmsReviewMapper.ToPmsItemDto(review);
    }
}
