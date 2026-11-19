using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.ConfirmRefundPayout;

/// <summary>
/// Validates <see cref="ConfirmRefundPayoutCommand"/> before handler execution.
/// Preserves handler-level ERR_BANK_REF_REQUIRED semantics for empty references.
/// </summary>
public sealed class ConfirmRefundPayoutCommandValidator : AbstractValidator<ConfirmRefundPayoutCommand>
{
    /// <summary>
    /// Initializes validation rules for refund payout confirmation.
    /// </summary>
    public ConfirmRefundPayoutCommandValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty()
            .WithMessage("Mã giao dịch hoàn tiền không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.PayoutMethod)
            .IsInEnum()
            .WithMessage("Phương thức chi trả hoàn tiền không hợp lệ.");

        RuleFor(x => x.BankTransactionRef)
            .MaximumLength(200)
            .WithMessage("Mã tham chiếu ngân hàng không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.BankTransactionRef));

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithMessage("Ghi chú chi trả không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
