using FluentValidation;

namespace HotelSaas.Application.Reservations.Commands.CancelReservation;

/// <summary>
/// Validates <see cref="CancelReservationCommand"/> before handler execution.
/// </summary>
public sealed class CancelReservationCommandValidator : AbstractValidator<CancelReservationCommand>
{
    /// <summary>
    /// Initializes validation rules for reservation cancellation.
    /// </summary>
    public CancelReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đơn đặt phòng không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithMessage("Lý do hủy đặt phòng không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Reason));
    }
}
