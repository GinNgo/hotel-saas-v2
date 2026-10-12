using System;
using FluentValidation;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Quotes.Queries.CalculateQuote;

/// <summary>
/// Validator for CalculateQuoteQuery enforcing duration, enum boundaries, and timezone alignment.
/// </summary>
public sealed class CalculateQuoteQueryValidator : AbstractValidator<CalculateQuoteQuery>
{
    private static TimeZoneInfo GetVietnamTimeZone()
    {
        if (TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var tz)) return tz;
        if (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out tz)) return tz;
        return TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT");
    }

    public CalculateQuoteQueryValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("PropertyId không được để trống.");

        RuleFor(x => x.RoomTypeId)
            .NotEmpty()
            .WithMessage("RoomTypeId không được để trống.");

        // Finding 4: Reject any RentalType outside enum - never return 0 VND quote
        RuleFor(x => x.RentalType)
            .IsInEnum()
            .Must(x => x == RentalType.Hourly || x == RentalType.Overnight)
            .WithErrorCode("ERR_INVALID_RENTAL_TYPE")
            .WithMessage("Hình thức thuê không hợp lệ. Chỉ chấp nhận Hourly (1) hoặc Overnight (2).");

        RuleFor(x => x.EndAtUtc)
            .GreaterThan(x => x.StartAtUtc)
            .WithErrorCode("ERR_INVALID_DURATION")
            .WithMessage("Thời điểm kết thúc (EndAtUtc) phải lớn hơn thời điểm bắt đầu (StartAtUtc).");

        RuleFor(x => x.StartAtUtc)
            .GreaterThanOrEqualTo(DateTime.UtcNow.AddMinutes(-30))
            .WithErrorCode("ERR_PAST_DATE")
            .WithMessage("Thời điểm bắt đầu không được lùi quá dung sai walk-in 30 phút so với hiện tại.");

        When(x => x.RentalType == RentalType.Overnight, () =>
        {
            RuleFor(x => x.CheckInDate)
                .NotNull()
                .WithErrorCode("ERR_INVALID_OVERNIGHT")
                .WithMessage("Thuê theo đêm bắt buộc phải có ngày nhận phòng (CheckInDate).");

            RuleFor(x => x.CheckOutDate)
                .NotNull()
                .WithErrorCode("ERR_INVALID_OVERNIGHT")
                .WithMessage("Thuê theo đêm bắt buộc phải có ngày trả phòng (CheckOutDate).");

            RuleFor(x => x.CheckOutDate)
                .GreaterThan(x => x.CheckInDate)
                .When(x => x.CheckInDate.HasValue && x.CheckOutDate.HasValue)
                .WithErrorCode("ERR_INVALID_OVERNIGHT")
                .WithMessage("Ngày trả phòng (CheckOutDate) phải sau ngày nhận phòng (CheckInDate).");

            // Finding 3: CheckInDate and CheckOutDate must match StartAtUtc and EndAtUtc in branch local timezone
            RuleFor(x => x.CheckInDate)
                .Must((query, checkInDate) =>
                {
                    if (!checkInDate.HasValue) return true;
                    var tz = GetVietnamTimeZone();
                    var startLocal = TimeZoneInfo.ConvertTimeFromUtc(query.StartAtUtc, tz);
                    return checkInDate.Value == DateOnly.FromDateTime(startLocal);
                })
                .When(x => x.CheckInDate.HasValue)
                .WithErrorCode("ERR_DATE_TIMEZONE_MISMATCH")
                .WithMessage("Ngày nhận phòng (CheckInDate) phải khớp với thời điểm bắt đầu (StartAtUtc) theo múi giờ chi nhánh.");

            RuleFor(x => x.CheckOutDate)
                .Must((query, checkOutDate) =>
                {
                    if (!checkOutDate.HasValue) return true;
                    var tz = GetVietnamTimeZone();
                    var endLocal = TimeZoneInfo.ConvertTimeFromUtc(query.EndAtUtc, tz);
                    return checkOutDate.Value == DateOnly.FromDateTime(endLocal);
                })
                .When(x => x.CheckOutDate.HasValue)
                .WithErrorCode("ERR_DATE_TIMEZONE_MISMATCH")
                .WithMessage("Ngày trả phòng (CheckOutDate) phải khớp với thời điểm kết thúc (EndAtUtc) theo múi giờ chi nhánh.");
        });
    }
}
