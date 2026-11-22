using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Print.Common;
using HotelSaas.Application.Print.DTOs;
using HotelSaas.Application.Public.Services;
using HotelSaas.Application.Reservations.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Print.Queries.GetPrintableVoucher;

public sealed class GetPrintableVoucherQueryHandler : IRequestHandler<GetPrintableVoucherQuery, PrintableVoucherDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly ICurrentPropertyService? _currentPropertyService;

    public GetPrintableVoucherQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        ICurrentPropertyService? currentPropertyService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _currentPropertyService = currentPropertyService;
    }

    public async Task<PrintableVoucherDto> Handle(GetPrintableVoucherQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ConfirmationCode))
        {
            throw new NotFoundException("Không tìm thấy mã đặt phòng.");
        }

        var token = request.ConfirmationCode.Trim();

        var candidates = await _context.Reservations
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Include(r => r.Property)
            .Include(r => r.Tenant)
            .Include(r => r.Room)
            .ThenInclude(rm => rm!.RoomType)
            .Where(r =>
                (r.ConfirmationCode != null && r.ConfirmationCode.ToUpper() == token.ToUpper()) ||
                (r.Notes != null && r.Notes.Contains(token)))
            .Take(10)
            .ToListAsync(cancellationToken);

        Reservation? reservation = null;
        ReservationSnapshot? snapshot = null;
        bool isTokenMatch = false;
        bool isCodeMatch = false;

        foreach (var candidate in candidates)
        {
            var snap = ReservationSnapshotHelper.TryDeserialize(candidate.Notes);
            var tokenMatched = snap != null &&
                !string.IsNullOrWhiteSpace(snap.LookupToken) &&
                string.Equals(snap.LookupToken, token, StringComparison.OrdinalIgnoreCase);
            var codeMatched = string.Equals(candidate.ConfirmationCode, token, StringComparison.OrdinalIgnoreCase);

            if (tokenMatched || codeMatched)
            {
                reservation = candidate;
                snapshot = snap;
                isTokenMatch = tokenMatched;
                isCodeMatch = codeMatched;
                if (tokenMatched) break;
            }
        }

        if (reservation == null)
        {
            throw new NotFoundException("Không tìm thấy mã đặt phòng.");
        }

        var effectiveIsTenantWide = _currentPropertyService != null
            ? _currentPropertyService.IsTenantWide
            : _currentUser.IsTenantWide;
        var effectivePropertyId = _currentPropertyService != null
            ? _currentPropertyService.PropertyId
            : _currentUser.PropertyId;
        var effectiveExcludedPropertyIds = _currentPropertyService != null
            ? _currentPropertyService.ExcludedPropertyIds
            : _currentUser.ExcludedPropertyIds;
        var isPropertyExcluded = effectiveExcludedPropertyIds != null &&
            effectiveExcludedPropertyIds.Contains(reservation.PropertyId);
        var hasStaffBranchAccess = _currentUser.TenantId.HasValue &&
            _currentUser.TenantId.Value == reservation.TenantId &&
            !isPropertyExcluded &&
            (effectiveIsTenantWide || effectivePropertyId == reservation.PropertyId);

        bool isAuthenticatedOwnerOrStaff = _currentUser.IsAuthenticated &&
            (_currentUser.GlobalRole == GlobalUserRole.SuperAdmin ||
             hasStaffBranchAccess ||
             (_currentUser.UserId != Guid.Empty && reservation.GuestUserId == _currentUser.UserId));

        if (!isAuthenticatedOwnerOrStaff && isTokenMatch && !isCodeMatch && snapshot != null &&
            (snapshot.IsTokenRevoked ||
             !snapshot.TokenExpiresAtUtc.HasValue ||
             snapshot.TokenExpiresAtUtc.Value <= DateTime.UtcNow))
        {
            throw new NotFoundException("Mã tra cứu đặt phòng đã hết hạn hoặc bị thu hồi.");
        }

        bool isValidTokenMatch = isTokenMatch &&
            snapshot != null &&
            !snapshot.IsTokenRevoked &&
            snapshot.TokenExpiresAtUtc.HasValue &&
            snapshot.TokenExpiresAtUtc.Value > DateTime.UtcNow;

        bool isAuthorizedFullPii = isAuthenticatedOwnerOrStaff || isValidTokenMatch;

        var voucherConfigs = await _context.PrintTemplateConfigs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(c => c.TenantId == reservation.TenantId && (c.PropertyId == reservation.PropertyId || c.PropertyId == null))
            .ToListAsync(cancellationToken);

        var printConfig = voucherConfigs.FirstOrDefault(c => c.PropertyId == reservation.PropertyId)
            ?? voucherConfigs.FirstOrDefault(c => c.PropertyId == null);

        var property = reservation.Property;
        var roomType = reservation.Room?.RoomType;
        var checkInTime = property != null ? property.CheckInTime.ToString("HH:mm") : "14:00";
        var checkOutTime = property != null ? property.CheckOutTime.ToString("HH:mm") : "12:00";
        var rentalType = snapshot?.RentalType.ToString() ??
            (reservation.CheckInDate == reservation.CheckOutDate ? RentalType.Hourly.ToString() : RentalType.Overnight.ToString());

        return new PrintableVoucherDto
        {
            ConfirmationCode = reservation.ConfirmationCode,
            CreatedAtUtc = reservation.CreatedAtUtc,
            PropertyName = property?.Name ?? reservation.Tenant?.Name ?? "Khách Sạn Đối Tác",
            PropertyAddress = property?.Address ?? string.Empty,
            PropertyPhone = !string.IsNullOrWhiteSpace(property?.PhoneNumber) ? property!.PhoneNumber : (printConfig?.Hotline ?? string.Empty),
            PropertyEmail = property?.Email ?? string.Empty,
            GuestName = isAuthorizedFullPii ? reservation.GuestName : PiiMaskingHelper.MaskName(reservation.GuestName),
            GuestEmail = isAuthorizedFullPii ? reservation.GuestEmail : PrintHelper.MaskEmail(reservation.GuestEmail),
            GuestPhone = isAuthorizedFullPii ? (reservation.GuestPhone ?? string.Empty) : PrintHelper.MaskPhone(reservation.GuestPhone),
            RoomTypeName = roomType?.Name ?? snapshot?.RoomTypeName ?? "Phòng Tiêu Chuẩn",
            RoomNumber = isAuthorizedFullPii
                ? (reservation.Room?.RoomNumber ?? "Lễ tân sắp xếp khi check-in")
                : (string.IsNullOrWhiteSpace(reservation.Room?.RoomNumber) ? "Lễ tân sắp xếp khi check-in" : "***"),
            RentalType = rentalType,
            CheckInDate = reservation.CheckInDate,
            CheckInTime = checkInTime,
            CheckOutDate = reservation.CheckOutDate,
            CheckOutTime = checkOutTime,
            NumberOfGuests = reservation.NumberOfGuests,
            TotalAmount = reservation.TotalAmount,
            Status = reservation.Status.ToString(),
            BedType = roomType?.BedType ?? "1 Giường King",
            SquareMeters = roomType?.SquareMeters ?? 28,
            PolicyNote = printConfig?.CheckInPolicyText ?? $"Nhận phòng từ {checkInTime} - Trả phòng trước {checkOutTime}. Vui lòng xuất trình CCCD/Hộ chiếu gốc tại quầy lễ tân.",
            FooterNote = printConfig?.FooterNote ?? "Cảm ơn Quý khách đã tin tưởng và sử dụng dịch vụ của chúng tôi!",
            SpecialRequests = isAuthorizedFullPii ? ReservationSnapshotHelper.CleanCustomerNotes(reservation.Notes, snapshot) : null,
            QrCodeData = isAuthorizedFullPii
                ? $"HOTEL-CHECKIN:{reservation.ConfirmationCode}:{reservation.GuestName}"
                : $"HOTEL-CHECKIN:{reservation.ConfirmationCode}"
        };
    }
}
