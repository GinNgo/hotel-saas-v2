using FluentValidation;

namespace HotelSaas.Application.Reservations.Commands.RegenerateSmartLockPin;

/// <summary>
/// Validates <see cref="RegenerateSmartLockPinCommand"/> inputs.
/// </summary>
public sealed class RegenerateSmartLockPinCommandValidator : AbstractValidator<RegenerateSmartLockPinCommand>
{
    public RegenerateSmartLockPinCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đặt phòng là bắt buộc.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Chi nhánh là bắt buộc.");

        RuleFor(x => x.Reason)
            .Must(r => r == null || r.Trim().Length <= 500)
            .WithMessage("Lý do cấp lại mã PIN không được vượt quá 500 ký tự.");
    }
}
