using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.RejectRefund;

/// <summary>
/// Validates <see cref="RejectRefundCommand"/> before handler execution.
/// Preserves handler-level ERR_REASON_REQUIRED semantics for empty or whitespace reasons.
/// </summary>
public sealed class RejectRefundCommandValidator : AbstractValidator<RejectRefundCommand>
{
    /// <summary>
    /// Initializes validation rules for refund rejection.
    /// </summary>
    public RejectRefundCommandValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty()
            .WithMessage("Mã giao dịch hoàn tiền không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.Reason)
            .MaximumLength(500)
            .WithMessage("Lý do từ chối không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Reason));
    }
}
