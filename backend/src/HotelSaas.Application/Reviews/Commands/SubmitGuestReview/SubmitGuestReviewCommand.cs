using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Application.Reviews.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Reviews.Commands.SubmitGuestReview;

/// <summary>
/// Mutation command to submit a verified guest review for a checked-in or checked-out stay.
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
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentPropertyService _propertyService;
    private readonly ICurrentUserContext? _userContext;

    public SubmitGuestReviewCommandHandler(
        IApplicationDbContext context,
        ICurrentTenantService tenantService,
        ICurrentPropertyService propertyService,
        ICurrentUserContext? userContext = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _tenantService = tenantService ?? throw new ArgumentNullException(nameof(tenantService));
        _propertyService = propertyService ?? throw new ArgumentNullException(nameof(propertyService));
        _userContext = userContext;
    }

    public async Task<GuestReviewDto> Handle(SubmitGuestReviewCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.LookupToken))
        {
            throw new BadRequestException("ERR_INVALID_TOKEN", "Mã tra cứu đặt phòng không hợp lệ.");
        }

        var token = request.LookupToken.Trim();
        var isGuid = Guid.TryParse(token, out var reservationIdFromToken);

        // 1. Authoritative lookup of reservation across tenant boundaries
        var reservation = await _context.Reservations
            .IgnoreQueryFilters()
            .Include(r => r.Property)
            .Include(r => r.Room)
                .ThenInclude(rm => rm!.RoomType)
            .FirstOrDefaultAsync(r =>
                (r.Notes != null && r.Notes.Contains(token)) ||
                (isGuid && r.Id == reservationIdFromToken) ||
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()),
                cancellationToken);

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy thông tin đặt phòng với mã tra cứu này.");
        }

        // 2. Require valid secret LookupToken OR authenticated booking owner (reject bare 6-char ConfirmationCode)
        var snapshot = ReservationSnapshotHelper.TryDeserialize(reservation.Notes);
        bool isTokenMatch = snapshot != null &&
                            !snapshot.IsTokenRevoked &&
                            !string.IsNullOrWhiteSpace(snapshot.LookupToken) &&
                            string.Equals(snapshot.LookupToken, token, StringComparison.OrdinalIgnoreCase);

        bool isAuthenticatedOwner = _userContext is { IsAuthenticated: true } &&
                                    _userContext.UserId != Guid.Empty &&
                                    reservation.GuestUserId.HasValue &&
                                    reservation.GuestUserId.Value == _userContext.UserId;

        if (!isTokenMatch && !isAuthenticatedOwner)
        {
            if (string.Equals(reservation.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase) ||
                (isGuid && reservation.Id == reservationIdFromToken))
            {
                throw new ForbiddenException("ERR_REVIEW_TOKEN_REQUIRED",
                    "Không thể gửi đánh giá bằng mã xác nhận công khai. Vui lòng sử dụng liên kết tra cứu bảo mật hoặc đăng nhập tài khoản đặt phòng.");
            }

            throw new NotFoundException("Mã tra cứu không khớp với đơn đặt phòng.");
        }

        // 3. State verification (G0-06): Guest can only review after checking in or checking out (never Confirmed before arrival)
        if (reservation.Status != ReservationStatus.CheckedOut &&
            reservation.Status != ReservationStatus.CheckedIn)
        {
            throw new BadRequestException("ERR_INELIGIBLE_FOR_REVIEW",
                $"Chỉ có thể đánh giá đơn đặt phòng đang lưu trú hoặc đã hoàn tất trả phòng (Trạng thái hiện tại: {reservation.Status}).");
        }

        // 4. Duplicate review prevention (One review per reservation)
        var existingReview = await _context.GuestReviews
            .IgnoreQueryFilters()
            .AnyAsync(gr => gr.ReservationId == reservation.Id, cancellationToken);

        if (existingReview)
        {
            throw new BadRequestException("ERR_ALREADY_REVIEWED", "Đơn đặt phòng này đã được gửi đánh giá xác thực.");
        }

        // 5. User foreign key resolution — NEVER auto-create ghost User rows with empty PasswordHash
        Guid userId;
        if (reservation.GuestUserId.HasValue && reservation.GuestUserId.Value != Guid.Empty)
        {
            userId = reservation.GuestUserId.Value;
        }
        else if (_userContext is { IsAuthenticated: true } && _userContext.UserId != Guid.Empty)
        {
            userId = _userContext.UserId;
        }
        else
        {
            throw new BadRequestException("ERR_REVIEW_ACCOUNT_REQUIRED",
                "Đơn đặt phòng chưa liên kết tài khoản thành viên. Vui lòng đăng nhập tài khoản khách hàng để gửi đánh giá.");
        }

        // Establish tenant & property context for change tracker & interceptors
        _tenantService.TenantId = reservation.TenantId;
        _propertyService.PropertyId = reservation.PropertyId;

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
