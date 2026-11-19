using FluentValidation;

namespace HotelSaas.Application.Platform.Commands.CreatePlatformAdmin;

/// <summary>
/// Validates <see cref="CreatePlatformAdminCommand"/> inputs before execution.
/// </summary>
public sealed class CreatePlatformAdminCommandValidator : AbstractValidator<CreatePlatformAdminCommand>
{
    public CreatePlatformAdminCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email tài khoản quản trị là bắt buộc.")
            .EmailAddress().WithMessage("Định dạng email không hợp lệ.")
            .MaximumLength(256).WithMessage("Email không được vượt quá 256 ký tự.");

        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên quản trị viên là bắt buộc.")
            .MaximumLength(150).WithMessage("Họ và tên không được vượt quá 150 ký tự.");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Mật khẩu khởi tạo là bắt buộc.")
            .MinimumLength(8).WithMessage("Mật khẩu quản trị phải có tối thiểu 8 ký tự.");

        When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber), () =>
        {
            RuleFor(x => x.PhoneNumber!)
                .MaximumLength(30).WithMessage("Số điện thoại không được vượt quá 30 ký tự.");
        });
    }
}
