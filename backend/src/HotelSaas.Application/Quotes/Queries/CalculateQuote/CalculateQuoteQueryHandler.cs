using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Quotes.Queries.CalculateQuote;

/// <summary>
/// Quote Engine query handler providing verified price estimates for hourly and overnight stays.
/// Enforces Decision D05, D06, D19, D20, D25 fail-closed constraints and interim branch policy limits (D14 pending PO approval).
/// </summary>
public sealed class CalculateQuoteQueryHandler : IRequestHandler<CalculateQuoteQuery, QuoteDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ICurrentUserContext _userContext;
    private readonly IMembershipLookupService _membershipLookupService;
    private readonly ICurrentPropertyService? _propertyService;

    public CalculateQuoteQueryHandler(
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

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public async Task<QuoteDto> Handle(CalculateQuoteQuery request, CancellationToken cancellationToken)
    {
        // Finding 2: Require authenticated tenant and user context fail-closed
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

        // Header / Token property context check
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

        // Verify property exists and belongs to tenant
        var property = await _context.Properties
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == request.PropertyId, cancellationToken);

        if (property == null || property.TenantId != tenantId.Value)
        {
            throw new NotFoundException("Chi nhánh không tồn tại.");
        }

        // Verify room type exists and matches property
        var roomType = await _context.RoomTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.PropertyId == request.PropertyId, cancellationToken);

        if (roomType == null)
        {
            throw new NotFoundException("Loại phòng không tồn tại trong chi nhánh này.");
        }

        // Finding 2: Authoritative membership check - ONLY Success proceeds, everything else fails closed
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
                    throw new ForbiddenException("ERR_FORBIDDEN", membership.ErrorMessage ?? "Không có quyền truy cập chi nhánh này.");
            }
        }

        var tz = GetVietnamTimeZone();
        var breakdown = new List<QuoteBreakdownItemDto>();
        decimal totalAmount = 0m;

        if (request.RentalType == RentalType.Hourly)
        {
            // Finding 5: Exact duration calculation without prior rounding on minutes
            var duration = request.EndAtUtc - request.StartAtUtc;
            if (duration <= TimeSpan.Zero)
            {
                throw new BadRequestException("ERR_INVALID_DURATION",
                    "Thời gian thuê phải lớn hơn 0.");
            }

            // Finding 1: Decision D14 (Chờ PO phê duyệt) - Check interim branch hourly limit
            var maxAllowedDuration = TimeSpan.FromHours(property.MaxHourlyHours);
            if (duration > maxAllowedDuration)
            {
                var hoursRequested = Math.Round(duration.TotalHours, 1, MidpointRounding.AwayFromZero);
                throw new UnprocessableEntityException("ERR_HOURLY_LIMIT_EXCEEDED",
                    $"Thời gian thuê theo giờ ({hoursRequested} giờ) vượt quá giới hạn tối đa cho phép của chi nhánh ({property.MaxHourlyHours} giờ). Vui lòng chọn hình thức thuê theo đêm (Overnight).");
            }

            // Query active rate for start date in branch local timezone
            var startLocal = TimeZoneInfo.ConvertTimeFromUtc(request.StartAtUtc, tz);
            var startDateLocal = DateOnly.FromDateTime(startLocal);

            var rate = await _context.RoomTypeRates
                .AsNoTracking()
                .Where(r => r.RoomTypeId == roomType.Id &&
                            r.PropertyId == property.Id &&
                            r.IsActive &&
                            r.EffectiveFrom <= startDateLocal &&
                            startDateLocal < r.EffectiveTo)
                .FirstOrDefaultAsync(cancellationToken);

            if (rate == null)
            {
                throw new UnprocessableEntityException("ERR_PRICING_NOT_CONFIGURED",
                    "Không tìm thấy bảng giá thuê giờ hợp lệ cho thời điểm lưu trú đã chọn.");
            }

            var packageDuration = TimeSpan.FromHours(rate.FirstHours);
            if (duration <= packageDuration)
            {
                var firstHoursPrice = Math.Round(rate.FirstHoursPrice, 0, MidpointRounding.AwayFromZero);
                totalAmount = firstHoursPrice;
                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Gói {rate.FirstHours} giờ đầu tiên",
                    UnitPrice = firstHoursPrice,
                    Quantity = 1,
                    Amount = firstHoursPrice
                });
            }
            else
            {
                var extraDuration = duration - packageDuration;
                // Finding 5: strictly ceil extra hours without intermediate Math.Round on minutes
                var extraHours = (int)Math.Ceiling(extraDuration.TotalHours);
                var additionalUnitPrice = Math.Round(rate.AdditionalHourPrice, 0, MidpointRounding.AwayFromZero);
                var additionalAmount = Math.Round(extraHours * additionalUnitPrice, 0, MidpointRounding.AwayFromZero);
                var firstHoursPrice = Math.Round(rate.FirstHoursPrice, 0, MidpointRounding.AwayFromZero);
                totalAmount = firstHoursPrice + additionalAmount;

                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Gói {rate.FirstHours} giờ đầu tiên",
                    UnitPrice = firstHoursPrice,
                    Quantity = 1,
                    Amount = firstHoursPrice
                });

                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Giờ phát sinh ({extraHours} giờ thêm)",
                    UnitPrice = additionalUnitPrice,
                    Quantity = extraHours,
                    Amount = additionalAmount
                });
            }
        }
        else if (request.RentalType == RentalType.Overnight)
        {
            // Finding 3: CheckInDate and CheckOutDate must match StartAtUtc and EndAtUtc in branch local timezone
            var startLocal = TimeZoneInfo.ConvertTimeFromUtc(request.StartAtUtc, tz);
            var startDateLocal = DateOnly.FromDateTime(startLocal);
            var endLocal = TimeZoneInfo.ConvertTimeFromUtc(request.EndAtUtc, tz);
            var endDateLocal = DateOnly.FromDateTime(endLocal);

            if (request.CheckInDate.HasValue && request.CheckInDate.Value != startDateLocal)
            {
                throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH",
                    $"Ngày nhận phòng ({request.CheckInDate.Value:yyyy-MM-dd}) không khớp với thời điểm bắt đầu theo múi giờ chi nhánh ({startDateLocal:yyyy-MM-dd}).");
            }

            if (request.CheckOutDate.HasValue && request.CheckOutDate.Value != endDateLocal)
            {
                throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH",
                    $"Ngày trả phòng ({request.CheckOutDate.Value:yyyy-MM-dd}) không khớp với thời điểm kết thúc theo múi giờ chi nhánh ({endDateLocal:yyyy-MM-dd}).");
            }

            var checkInDate = request.CheckInDate ?? startDateLocal;
            var checkOutDate = request.CheckOutDate ?? endDateLocal;

            if (checkOutDate <= checkInDate)
            {
                throw new BadRequestException("ERR_INVALID_OVERNIGHT",
                    "Thời gian thuê qua đêm phải có ngày trả phòng sau ngày nhận phòng (tối thiểu 1 đêm).");
            }

            var nights = checkOutDate.DayNumber - checkInDate.DayNumber;

            RoomTypeRate? firstNightRate = null;
            RoomTypeRate? lastNightRate = null;

            // Iterate over each overnight stay and aggregate rate
            for (var d = checkInDate; d < checkOutDate; d = d.AddDays(1))
            {
                var rate = await _context.RoomTypeRates
                    .AsNoTracking()
                    .Where(r => r.RoomTypeId == roomType.Id &&
                                r.PropertyId == property.Id &&
                                r.IsActive &&
                                r.EffectiveFrom <= d &&
                                d < r.EffectiveTo)
                    .FirstOrDefaultAsync(cancellationToken);

                if (rate == null)
                {
                    throw new UnprocessableEntityException("ERR_PRICING_NOT_CONFIGURED",
                        $"Không tìm thấy bảng giá thuê đêm cho ngày {d:yyyy-MM-dd}.");
                }

                if (d == checkInDate) firstNightRate = rate;
                if (d == checkOutDate.AddDays(-1)) lastNightRate = rate;

                var nightlyPrice = Math.Round(rate.NightlyPrice, 0, MidpointRounding.AwayFromZero);
                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Tiền phòng đêm {d:yyyy-MM-dd}",
                    UnitPrice = nightlyPrice,
                    Quantity = 1,
                    Amount = nightlyPrice
                });
            }

            // Surcharges: Early check-in
            var startLocalTime = TimeOnly.FromDateTime(startLocal);

            if (startLocalTime < property.CheckInTime)
            {
                var earlyPolicies = await _context.PropertySurchargePolicies
                    .AsNoTracking()
                    .Where(sp => sp.PropertyId == property.Id &&
                                sp.SurchargeType == SurchargeType.EarlyCheckIn &&
                                sp.IsActive)
                    .ToListAsync(cancellationToken);

                var matchingPolicy = earlyPolicies.FirstOrDefault(sp =>
                    sp.FromTime <= startLocalTime && startLocalTime <= sp.ToTime);

                if (matchingPolicy == null)
                {
                    throw new UnprocessableEntityException("ERR_SURCHARGE_NOT_CONFIGURED",
                        "Chi nhánh chưa cấu hình biểu phí phụ thu nhận phòng sớm cho khung giờ này. Không thể xuất báo giá ngoài khung giờ chuẩn.");
                }

                decimal surchargeAmount;
                if (matchingPolicy.CalculationMethod == SurchargeCalculationMethod.PercentageOfNightly)
                {
                    var rawSurcharge = firstNightRate!.NightlyPrice * (matchingPolicy.Percentage!.Value / 100.0m);
                    surchargeAmount = Math.Round(rawSurcharge, 0, MidpointRounding.AwayFromZero); // Decision D25 AwayFromZero
                }
                else
                {
                    surchargeAmount = Math.Round(matchingPolicy.FlatAmount!.Value, 0, MidpointRounding.AwayFromZero);
                }

                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Phụ thu nhận phòng sớm ({matchingPolicy.FromTime:HH\\:mm} - {matchingPolicy.ToTime:HH\\:mm})",
                    UnitPrice = surchargeAmount,
                    Quantity = 1,
                    Amount = surchargeAmount
                });
            }

            // Surcharges: Late check-out
            var endLocalTime = TimeOnly.FromDateTime(endLocal);

            if (endLocalTime > property.CheckOutTime)
            {
                var latePolicies = await _context.PropertySurchargePolicies
                    .AsNoTracking()
                    .Where(sp => sp.PropertyId == property.Id &&
                                sp.SurchargeType == SurchargeType.LateCheckOut &&
                                sp.IsActive)
                    .ToListAsync(cancellationToken);

                var matchingPolicy = latePolicies.FirstOrDefault(sp =>
                    sp.FromTime <= endLocalTime && endLocalTime <= sp.ToTime);

                if (matchingPolicy == null)
                {
                    throw new UnprocessableEntityException("ERR_SURCHARGE_NOT_CONFIGURED",
                        "Chi nhánh chưa cấu hình biểu phí phụ thu trả phòng muộn cho khung giờ này. Không thể xuất báo giá ngoài khung giờ chuẩn.");
                }

                decimal surchargeAmount;
                if (matchingPolicy.CalculationMethod == SurchargeCalculationMethod.PercentageOfNightly)
                {
                    var rawSurcharge = lastNightRate!.NightlyPrice * (matchingPolicy.Percentage!.Value / 100.0m);
                    surchargeAmount = Math.Round(rawSurcharge, 0, MidpointRounding.AwayFromZero); // Decision D25 AwayFromZero
                }
                else
                {
                    surchargeAmount = Math.Round(matchingPolicy.FlatAmount!.Value, 0, MidpointRounding.AwayFromZero);
                }

                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Phụ thu trả phòng muộn ({matchingPolicy.FromTime:HH\\:mm} - {matchingPolicy.ToTime:HH\\:mm})",
                    UnitPrice = surchargeAmount,
                    Quantity = 1,
                    Amount = surchargeAmount
                });
            }

            totalAmount = Math.Round(breakdown.Sum(b => b.Amount), 0, MidpointRounding.AwayFromZero);
        }
        else
        {
            // Finding 4: Reject any RentalType outside enum - NEVER return 0 VND quote
            throw new BadRequestException("ERR_INVALID_RENTAL_TYPE",
                "Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly hoặc Overnight.");
        }

        // Finding 4 & 5: Safety check - totalAmount must be strictly positive
        if (totalAmount <= 0)
        {
            throw new UnprocessableEntityException("ERR_INVALID_QUOTE_TOTAL",
                "Tổng tiền báo giá không hợp lệ (nhỏ hơn hoặc bằng 0).");
        }

        return new QuoteDto
        {
            PropertyId = property.Id,
            RoomTypeId = roomType.Id,
            RoomTypeName = roomType.Name,
            RentalType = request.RentalType.ToString(),
            TotalAmount = totalAmount,
            Currency = "VND",
            ExpiresAtUtc = DateTime.UtcNow.AddMinutes(5), // Decision D20: Quote TTL 5 minutes
            Breakdown = breakdown,
            AppliedPolicies = new AppliedPoliciesDto
            {
                MaxHourlyHours = property.MaxHourlyHours,
                BufferMinutes = property.BufferMinutes,
                CheckInTime = property.CheckInTime,
                CheckOutTime = property.CheckOutTime
            }
        };
    }
}
