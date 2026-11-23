using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.ResetPassword;

/// <summary>
/// Validates <see cref="ResetPasswordCommand"/> including unified strong password complexity rules.
/// </summary>
public sealed class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Mã đặt lại mật khẩu không được để trống.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Mật khẩu mới không được để trống.")
            .MinimumLength(8).WithMessage("Mật khẩu cần ít nhất 8 ký tự.")
            .MaximumLength(100).WithMessage("Mật khẩu không được vượt quá 100 ký tự.")
            .Matches("[A-Z]").WithMessage("Mật khẩu cần ít nhất 1 chữ hoa.")
            .Matches("[a-z]").WithMessage("Mật khẩu cần ít nhất 1 chữ thường.")
            .Matches("[0-9]").WithMessage("Mật khẩu cần ít nhất 1 chữ số.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Mật khẩu cần ít nhất 1 ký tự đặc biệt.");
    }
}
