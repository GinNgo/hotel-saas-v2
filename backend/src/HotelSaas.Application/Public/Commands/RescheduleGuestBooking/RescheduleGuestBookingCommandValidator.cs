using System;
using FluentValidation;

namespace HotelSaas.Application.Public.Commands.RescheduleGuestBooking;

/// <summary>
/// Validates <see cref="RescheduleGuestBookingCommand"/> inputs prior to handler execution.
/// </summary>
public sealed class RescheduleGuestBookingCommandValidator : AbstractValidator<RescheduleGuestBookingCommand>
{
    public RescheduleGuestBookingCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .NotEmpty()
            .WithMessage("Mã tra cứu đặt phòng không được để trống.");

        RuleFor(x => x)
            .Must(HasValidScheduleInput)
            .WithMessage("Thời gian nhận và trả phòng mới không hợp lệ.");

        RuleFor(x => x.Reason)
            .Must(r => r == null || r.Trim().Length <= 500)
            .WithMessage("Lý do đổi lịch lưu trú không được vượt quá 500 ký tự.");
    }

    private static bool HasValidScheduleInput(RescheduleGuestBookingCommand cmd)
    {
        if (cmd.NewStartAtUtc != default && cmd.NewEndAtUtc != default)
        {
            return cmd.NewEndAtUtc > cmd.NewStartAtUtc;
        }

        if (cmd.NewCheckInDate.HasValue && cmd.NewCheckOutDate.HasValue)
        {
            return cmd.NewCheckOutDate.Value > cmd.NewCheckInDate.Value;
        }

        return false;
    }
}
