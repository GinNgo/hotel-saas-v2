using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.Register;

/// <summary>
/// Validates the <see cref="RegisterCommand"/> before handler execution.
/// </summary>
public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    /// <summary>
    /// Initializes validation rules for user registration.
    /// </summary>
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Email không đúng định dạng.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu không được để trống.")
            .MinimumLength(8).WithMessage("Mật khẩu cần ít nhất 8 ký tự.")
            .Matches("[A-Z]").WithMessage("Mật khẩu cần ít nhất 1 chữ hoa.")
            .Matches("[0-9]").WithMessage("Mật khẩu cần ít nhất 1 chữ số.")
            .Matches("[^a-zA-Z0-9]").WithMessage("Mật khẩu cần ít nhất 1 ký tự đặc biệt.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ tên không được để trống.")
            .MaximumLength(100).WithMessage("Họ tên tối đa 100 ký tự.");
    }
}
