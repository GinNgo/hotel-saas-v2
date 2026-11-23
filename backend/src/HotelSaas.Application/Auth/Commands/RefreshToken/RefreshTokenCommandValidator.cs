using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.RefreshToken;

/// <summary>
/// Validates <see cref="RefreshTokenCommand"/> token length bounds prior to handler execution.
/// Empty or invalid tokens continue to reach the handler so HTTP 401 Unauthorized semantics are preserved.
/// </summary>
public sealed class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    /// <summary>
    /// Initializes validation rules for token refresh requests.
    /// </summary>
    public RefreshTokenCommandValidator()
    {
        RuleFor(x => x.AccessToken)
            .MaximumLength(8192)
            .WithMessage("Access token vượt quá độ dài cho phép.")
            .When(x => !string.IsNullOrEmpty(x.AccessToken));

        RuleFor(x => x.RefreshToken)
            .MaximumLength(512)
            .WithMessage("Refresh token vượt quá độ dài cho phép.")
            .When(x => !string.IsNullOrEmpty(x.RefreshToken));
    }
}
