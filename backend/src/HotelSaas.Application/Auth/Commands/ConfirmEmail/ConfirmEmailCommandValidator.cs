using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.ConfirmEmail;

/// <summary>
/// Validator for ConfirmEmailCommand ensuring the token is provided and non-empty.
/// </summary>
public sealed class ConfirmEmailCommandValidator : AbstractValidator<ConfirmEmailCommand>
{
    public ConfirmEmailCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .WithMessage("Mã xác thực email không được để trống.");
    }
}
