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
            .MaximumLength(30).WithMessage("Số điện thoại không được vượt quá 30 ký tự.");

        RuleFor(x => x.GuestKey).MaximumLength(512);
        RuleFor(x => x).Must(x => !string.IsNullOrWhiteSpace(x.GuestKey) || !string.IsNullOrWhiteSpace(x.PhoneNumber))
            .WithMessage("Cần mã hồ sơ hoặc số điện thoại khách hàng.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Ghi chú khách hàng không được vượt quá 1000 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
