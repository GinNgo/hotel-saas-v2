using FluentValidation;

namespace HotelSaas.Application.Public.Commands.CancelGuestBooking;

public sealed class CancelGuestBookingCommandValidator : AbstractValidator<CancelGuestBookingCommand>
{
    public CancelGuestBookingCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .NotEmpty()
            .WithMessage("Mã tra cứu không được để trống.");

        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithMessage("Lý do hủy không được vượt quá 500 ký tự.");
    }
}

