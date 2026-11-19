using FluentValidation;

namespace HotelSaas.Application.Public.Commands.ConfirmGuestBooking;

/// <summary>
/// Validates <see cref="ConfirmGuestBookingCommand"/> input length bounds prior to handler execution.
/// Business and error-code validation (ERR_PROPERTY_REQUIRED, ERR_INVALID_PAYMENT_AMOUNT,
/// ERR_INVALID_PAYMENT_METHOD, ERR_TRANSACTION_REF_REQUIRED, ERR_INVALID_IDEMPOTENCY_KEY,
/// ERR_INVALID_REQUEST) is preserved in the command handler.
/// </summary>
public sealed class ConfirmGuestBookingCommandValidator : AbstractValidator<ConfirmGuestBookingCommand>
{
    /// <summary>
    /// Initializes structural length rules for guest booking confirmation.
    /// </summary>
    public ConfirmGuestBookingCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .MaximumLength(200)
            .WithMessage("Mã tra cứu không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.LookupToken));

        RuleFor(x => x.TransactionRef)
            .MaximumLength(500)
            .WithMessage("Mã giao dịch không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.TransactionRef));

        RuleFor(x => x.IdempotencyKey)
            .MaximumLength(256)
            .WithMessage("Khóa IdempotencyKey không được vượt quá 256 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.IdempotencyKey));
    }
}
