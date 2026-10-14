using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Quotes.Services;

/// <summary>
/// Authoritative implementation of the pricing calculation engine.
/// Evaluates active versioned rates, duration boundaries, and surcharge policies.
/// </summary>
public sealed class PricingCalculator : IPricingCalculator
{
    private readonly IApplicationDbContext _context;

    public PricingCalculator(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    private static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public async Task<QuoteDto> CalculateAsync(
        Property property,
        RoomType roomType,
        RentalType rentalType,
        DateTime startAtUtc,
        DateTime endAtUtc,
        DateOnly? checkInDate,
        DateOnly? checkOutDate,
        CancellationToken cancellationToken)
    {
        var tz = GetVietnamTimeZone();
        var breakdown = new List<QuoteBreakdownItemDto>();
        decimal totalAmount = 0m;

        if (rentalType == RentalType.Hourly)
        {
            var duration = endAtUtc - startAtUtc;
            if (duration <= TimeSpan.Zero)
            {
                throw new BadRequestException("ERR_INVALID_DURATION",
                    "Thời gian thuê phải lớn hơn 0.");
            }

            var maxAllowedDuration = TimeSpan.FromHours(property.MaxHourlyHours);
            if (duration > maxAllowedDuration)
            {
                var hoursRequested = Math.Round(duration.TotalHours, 1, MidpointRounding.AwayFromZero);
                throw new UnprocessableEntityException("ERR_HOURLY_LIMIT_EXCEEDED",
                    $"Thời gian thuê theo giờ ({hoursRequested} giờ) vượt quá giới hạn tối đa cho phép của chi nhánh ({property.MaxHourlyHours} giờ). Vui lòng chọn hình thức thuê theo đêm (Overnight).");
            }

            var startLocal = TimeZoneInfo.ConvertTimeFromUtc(startAtUtc, tz);
            var startDateLocal = DateOnly.FromDateTime(startLocal);

            var rate = await _context.RoomTypeRates
                .IgnoreQueryFilters()
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
        else if (rentalType == RentalType.Overnight)
        {
            var startLocal = TimeZoneInfo.ConvertTimeFromUtc(startAtUtc, tz);
            var startDateLocal = DateOnly.FromDateTime(startLocal);
            var endLocal = TimeZoneInfo.ConvertTimeFromUtc(endAtUtc, tz);
            var endDateLocal = DateOnly.FromDateTime(endLocal);

            if (checkInDate.HasValue && checkInDate.Value != startDateLocal)
            {
                throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH",
                    $"Ngày nhận phòng ({checkInDate.Value:yyyy-MM-dd}) không khớp với thời điểm bắt đầu theo múi giờ chi nhánh ({startDateLocal:yyyy-MM-dd}).");
            }

            if (checkOutDate.HasValue && checkOutDate.Value != endDateLocal)
            {
                throw new BadRequestException("ERR_DATE_TIMEZONE_MISMATCH",
                    $"Ngày trả phòng ({checkOutDate.Value:yyyy-MM-dd}) không khớp với thời điểm kết thúc theo múi giờ chi nhánh ({endDateLocal:yyyy-MM-dd}).");
            }

            var actualCheckIn = checkInDate ?? startDateLocal;
            var actualCheckOut = checkOutDate ?? endDateLocal;

            if (actualCheckOut <= actualCheckIn)
            {
                throw new BadRequestException("ERR_INVALID_OVERNIGHT",
                    "Thời gian thuê qua đêm phải có ngày trả phòng sau ngày nhận phòng (tối thiểu 1 đêm).");
            }

            RoomTypeRate? firstNightRate = null;
            RoomTypeRate? lastNightRate = null;

            for (var d = actualCheckIn; d < actualCheckOut; d = d.AddDays(1))
            {
                var rate = await _context.RoomTypeRates
                    .IgnoreQueryFilters()
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

                if (d == actualCheckIn) firstNightRate = rate;
                if (d == actualCheckOut.AddDays(-1)) lastNightRate = rate;

                var nightlyPrice = Math.Round(rate.NightlyPrice, 0, MidpointRounding.AwayFromZero);
                breakdown.Add(new QuoteBreakdownItemDto
                {
                    Description = $"Tiền phòng đêm {d:yyyy-MM-dd}",
                    UnitPrice = nightlyPrice,
                    Quantity = 1,
                    Amount = nightlyPrice
                });
            }

            // Early check-in surcharge
            var startLocalTime = TimeOnly.FromDateTime(startLocal);
            if (startLocalTime < property.CheckInTime)
            {
                var earlyPolicies = await _context.PropertySurchargePolicies
                    .IgnoreQueryFilters()
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
                    surchargeAmount = Math.Round(rawSurcharge, 0, MidpointRounding.AwayFromZero);
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

            // Late check-out surcharge
            var endLocalTime = TimeOnly.FromDateTime(endLocal);
            if (endLocalTime > property.CheckOutTime)
            {
                var latePolicies = await _context.PropertySurchargePolicies
                    .IgnoreQueryFilters()
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
                    surchargeAmount = Math.Round(rawSurcharge, 0, MidpointRounding.AwayFromZero);
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
            throw new BadRequestException("ERR_INVALID_RENTAL_TYPE",
                "Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly hoặc Overnight.");
        }

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
            RentalType = rentalType.ToString(),
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
