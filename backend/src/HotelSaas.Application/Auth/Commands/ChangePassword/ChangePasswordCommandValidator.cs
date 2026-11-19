using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.ChangePassword;

/// <summary>
/// Validates <see cref="ChangePasswordCommand"/> inputs and enforces strong password complexity.
/// </summary>
public sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword)
            .NotEmpty().WithMessage("Vui lòng nhập mật khẩu hiện tại.");

        RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage("Mật khẩu mới không được để trống.")
            .MinimumLength(8).WithMessage("Mật khẩu cần ít nhất 8 ký tự.")
            .MaximumLength(100).WithMessage("Mật khẩu không được vượt quá 100 ký tự.")
            .Matches("[A-Z]").WithMessage("Mật khẩu cần ít nhất 1 chữ hoa.")
            .Matches("[a-z]").WithMessage("Mật khẩu cần ít nhất 1 chữ thường.")
            .Matches("[0-9]").WithMessage("Mật khẩu cần ít nhất 1 chữ số.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Mật khẩu cần ít nhất 1 ký tự đặc biệt.")
            .NotEqual(x => x.CurrentPassword).WithMessage("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
    }
}
