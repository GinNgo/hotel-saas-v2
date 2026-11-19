using FluentValidation;

namespace HotelSaas.Application.Guests.Commands.UpdateGuestNotes;

/// <summary>
/// Validates <see cref="UpdateGuestNotesCommand"/> before handler execution.
/// </summary>
public sealed class UpdateGuestNotesCommandValidator : AbstractValidator<UpdateGuestNotesCommand>
{
    /// <summary>
    /// Initializes validation rules for guest CRM notes updates.
    /// </summary>
    public UpdateGuestNotesCommandValidator()
    {
        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("Số điện thoại khách hàng không được để trống.")
            .MaximumLength(30).WithMessage("Số điện thoại không được vượt quá 30 ký tự.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Ghi chú khách hàng không được vượt quá 1000 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
