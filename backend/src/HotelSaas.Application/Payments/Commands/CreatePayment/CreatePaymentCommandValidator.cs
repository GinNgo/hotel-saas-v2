using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.CreatePayment;

/// <summary>
/// Validates <see cref="CreatePaymentCommand"/> structural identifiers and string bounds.
/// Preserves handler-level ERR_INVALID_AMOUNT, ERR_INVALID_PAYMENT_METHOD, and ERR_INVALID_IDEMPOTENCY_KEY error codes.
/// </summary>
public sealed class CreatePaymentCommandValidator : AbstractValidator<CreatePaymentCommand>
{
    /// <summary>
    /// Initializes validation rules for manual payment creation.
    /// </summary>
    public CreatePaymentCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.ReservationId)
            .NotEmpty()
            .WithMessage("Mã đơn đặt phòng không được để trống.");

        RuleFor(x => x.TransactionRef)
            .MaximumLength(500)
            .WithMessage("Mã tham chiếu giao dịch không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.TransactionRef));

        RuleFor(x => x.IdempotencyKey)
            .MaximumLength(256)
            .WithMessage("Khóa IdempotencyKey không được vượt quá 256 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.IdempotencyKey));
    }
}
