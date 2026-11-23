using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.ResendConfirmation;

/// <summary>
/// Validates <see cref="ResendConfirmationCommand"/> inputs.
/// </summary>
public sealed class ResendConfirmationCommandValidator : AbstractValidator<ResendConfirmationCommand>
{
    public ResendConfirmationCommandValidator()
    {
        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Địa chỉ email không đúng định dạng.")
            .MaximumLength(200).WithMessage("Email không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));

        RuleFor(x => x.AppUrl)
            .MaximumLength(500).WithMessage("AppUrl không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.AppUrl));
    }
}
