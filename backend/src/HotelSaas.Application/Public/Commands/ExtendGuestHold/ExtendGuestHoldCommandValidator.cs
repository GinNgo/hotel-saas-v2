using FluentValidation;

namespace HotelSaas.Application.Public.Commands.ExtendGuestHold;

/// <summary>
/// Validates <see cref="ExtendGuestHoldCommand"/> string length bounds.
/// Preserves handler-level ERR_INVALID_TOKEN semantics for empty or invalid tokens.
/// </summary>
public sealed class ExtendGuestHoldCommandValidator : AbstractValidator<ExtendGuestHoldCommand>
{
    /// <summary>
    /// Initializes validation rules for extending a guest online hold.
    /// </summary>
    public ExtendGuestHoldCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .MaximumLength(200)
            .WithMessage("Mã tra cứu giữ phòng không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.LookupToken));
    }
}
