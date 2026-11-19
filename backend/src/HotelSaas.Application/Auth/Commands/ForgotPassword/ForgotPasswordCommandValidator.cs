using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.ForgotPassword;

/// <summary>
/// Validates <see cref="ForgotPasswordCommand"/> inputs.
/// </summary>
public sealed class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Địa chỉ email không đúng định dạng.")
            .MaximumLength(200).WithMessage("Email không được vượt quá 200 ký tự.");

        RuleFor(x => x.AppUrl)
            .MaximumLength(500).WithMessage("AppUrl không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.AppUrl));
    }
}
