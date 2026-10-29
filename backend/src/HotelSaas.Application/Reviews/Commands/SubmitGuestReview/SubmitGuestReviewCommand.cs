using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reservations.Services;
using HotelSaas.Application.Reviews.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Commands.SubmitGuestReview;

/// <summary>
/// Mutation command to submit a verified guest review for a completed or confirmed stay.
/// </summary>
public sealed record SubmitGuestReviewCommand(
    string LookupToken,
    int Rating,
    int? CleanlinessRating = null,
    int? LocationRating = null,
    int? ServiceRating = null,
    int? ValueRating = null,
    string? Comment = null
) : IRequest<GuestReviewDto>;

public sealed class SubmitGuestReviewCommandHandler : IRequestHandler<SubmitGuestReviewCommand, GuestReviewDto>
{
    private readonly IApplicationDbContext _context;

    public SubmitGuestReviewCommandHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<GuestReviewDto> Handle(SubmitGuestReviewCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu đặt phòng không hợp lệ.");
        }

        var token = request.LookupToken.Trim();

        // 1. Authoritative lookup of reservation across tenant boundaries
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Property)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .FirstOrDefaultAsync(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)), cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        // 2. Validate token validity via snapshot if present
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        bool isTokenMatch = snapshot != null && string.Equals(snapshot.LookupToken, token, StringComparison.OrdinalIgnoreCase);
        bool isCodeMatch = string.Equals(reservation.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

        if (!isTokenMatch && !isCodeMatch)
        {
            throw new NotFoundException("Mã tra cứu không khớp với đơn đặt phòng.");
        }

        // 3. State verification: Guest can review if CheckedOut, CheckedIn, or Confirmed (cannot review PendingPayment or Cancelled)
        if (reservation.Status != ReservationStatus.CheckedOut &&
            reservation.Status != ReservationStatus.CheckedIn &&
            reservation.Status != ReservationStatus.Confirmed)
        {
            throw new BadRequestException("ERR_INELIGIBLE_FOR_REVIEW",
                $"Chỉ có thể đánh giá đơn đặt phòng đã xác nhận hoặc đã hoàn tất lưu trú (Trạng thái hiện tại: {reservation.Status}).");
        }

        // 4. Duplicate review prevention (One review per reservation)
        var existingReview = await _context.GuestReviews
            .IgnoreQueryFilters()
            .AnyAsync(gr => gr.ReservationId == reservation.Id, cancellationToken);

        if (existingReview)
        {
            throw new BadRequestException("ERR_ALREADY_REVIEWED", "Đơn đặt phòng này đã được gửi đánh giá xác thực.");
        }

        // 5. User foreign key resolution (Ensure non-null FK UserId)
        Guid userId;
        if (reservation.GuestUserId.HasValue && reservation.GuestUserId.Value != Guid.Empty)
        {
            userId = reservation.GuestUserId.Value;
        }
        else
        {
            // Lookup user by guest email
            var email = !string.IsNullOrWhiteSpace(reservation.GuestEmail) ? reservation.GuestEmail.Trim() : $"guest_{reservation.Id:N}@hotel.local";
            var user = await _context.Users
                .IgnoreQueryFilters()
                .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLower(), cancellationToken);

            if (user == null)
            {
                user = new User
                {
                    Id = Guid.NewGuid(),
                    TenantId = reservation.TenantId,
                    Username = $"guest_{Guid.NewGuid():N}"[..20],
                    Email = email,
                    FullName = !string.IsNullOrWhiteSpace(reservation.GuestName) ? reservation.GuestName.Trim() : "Khách lưu trú",
                    PasswordHash = string.Empty,
                    GlobalRole = GlobalUserRole.Customer,
                    IsActive = true
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync(cancellationToken);
            }
            userId = user.Id;
        }

        // 6. Create GuestReview entity
        var review = new GuestReview
        {
            Id = Guid.NewGuid(),
            TenantId = reservation.TenantId,
            ReservationId = reservation.Id,
            UserId = userId,
            OverallRating = Math.Clamp(request.Rating, 1, 5),
            CleanlinessRating = request.CleanlinessRating.HasValue ? Math.Clamp(request.CleanlinessRating.Value, 1, 5) : null,
            LocationRating = request.LocationRating.HasValue ? Math.Clamp(request.LocationRating.Value, 1, 5) : null,
            ServiceRating = request.ServiceRating.HasValue ? Math.Clamp(request.ServiceRating.Value, 1, 5) : null,
            ValueRating = request.ValueRating.HasValue ? Math.Clamp(request.ValueRating.Value, 1, 5) : null,
            Comment = request.Comment?.Trim(),
            IsPublished = true,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };

        _context.GuestReviews.Add(review);
        await _context.SaveChangesAsync(cancellationToken);

        // 7. Assemble return DTO
        var guestName = !string.IsNullOrWhiteSpace(reservation.GuestName) ? reservation.GuestName : "Khách lưu trú";
        var maskedName = PiiMaskingHelper.MaskName(guestName);
        var roomTypeName = snapshot?.RoomTypeName ?? reservation.Room?.RoomType?.Name ?? "Tiêu chuẩn";
        var rentalTypeStr = snapshot?.RentalType.ToString() ?? "Daily";

        return new GuestReviewDto
        {
            Id = review.Id,
            PropertyId = reservation.PropertyId,
            PropertyName = reservation.Property?.Name ?? "Cơ sở lưu trú",
            GuestName = maskedName,
            Rating = review.OverallRating,
            CleanlinessRating = review.CleanlinessRating,
            LocationRating = review.LocationRating,
            ServiceRating = review.ServiceRating,
            ValueRating = review.ValueRating,
            Comment = review.Comment,
            OwnerReply = review.OwnerReply,
            RepliedAt = review.RepliedAtUtc,
            CreatedAt = review.CreatedAtUtc,
            RentalType = rentalTypeStr,
            RoomTypeName = roomTypeName
        };
    }
}
