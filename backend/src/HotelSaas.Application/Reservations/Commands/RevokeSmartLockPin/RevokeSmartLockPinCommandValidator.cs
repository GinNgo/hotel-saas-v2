using FluentValidation;

namespace HotelSaas.Application.Reservations.Commands.RevokeSmartLockPin;

/// <summary>
/// Validates <see cref="RevokeSmartLockPinCommand"/> inputs.
/// </summary>
public sealed class RevokeSmartLockPinCommandValidator : AbstractValidator<RevokeSmartLockPinCommand>
{
    public RevokeSmartLockPinCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đặt phòng là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh là bắt buộc.");

        RuleFor(x => x.Reason)
            .Must(r => r == null || r.Trim().Length <= 500)
            .WithMessage("Lý do thu hồi mã PIN không được vượt quá 500 ký tự.");
    }
}
