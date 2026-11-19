using FluentValidation;

namespace HotelSaas.Application.Reservations.Commands.CheckInReservation;

/// <summary>
/// Validates <see cref="CheckInReservationCommand"/> before handler execution.
/// </summary>
public sealed class CheckInReservationCommandValidator : AbstractValidator<CheckInReservationCommand>
{
    /// <summary>
    /// Initializes validation rules for guest check-in.
    /// </summary>
    public CheckInReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đơn đặt phòng không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");
    }
}
