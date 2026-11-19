using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.ApproveRefund;

/// <summary>
/// Validates <see cref="ApproveRefundCommand"/> before handler execution.
/// </summary>
public sealed class ApproveRefundCommandValidator : AbstractValidator<ApproveRefundCommand>
{
    /// <summary>
    /// Initializes validation rules for refund approval.
    /// </summary>
    public ApproveRefundCommandValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty()
            .WithMessage("Mã giao dịch hoàn tiền không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.Notes)
            .MaximumLength(500)
            .WithMessage("Ghi chú phê duyệt không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
