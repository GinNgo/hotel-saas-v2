using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.RevokeToken;

/// <summary>
/// Validates <see cref="RevokeTokenCommand"/> token length bounds prior to handler execution.
/// Empty or unknown tokens continue to reach the handler to preserve idempotent boolean response behavior.
/// </summary>
public sealed class RevokeTokenCommandValidator : AbstractValidator<RevokeTokenCommand>
{
    /// <summary>
    /// Initializes validation rules for refresh token revocation.
    /// </summary>
    public RevokeTokenCommandValidator()
    {
        RuleFor(x => x.RefreshToken)
            .MaximumLength(512)
            .WithMessage("Refresh token vượt quá độ dài cho phép.")
            .When(x => !string.IsNullOrEmpty(x.RefreshToken));
    }
}
