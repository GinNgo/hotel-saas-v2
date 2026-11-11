using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.GoogleLogin;

/// <summary>
/// Validates <see cref="GoogleLoginCommand"/> payload.
/// </summary>
public sealed class GoogleLoginCommandValidator : AbstractValidator<GoogleLoginCommand>
{
    public GoogleLoginCommandValidator()
    {
        RuleFor(x => x.IdToken)
            .NotEmpty()
            .WithMessage("Mã xác thực Google (IdToken) không được để trống.");
    }
}
