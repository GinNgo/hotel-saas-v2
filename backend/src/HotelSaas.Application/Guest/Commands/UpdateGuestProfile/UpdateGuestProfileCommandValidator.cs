using FluentValidation;

namespace HotelSaas.Application.Guest.Commands.UpdateGuestProfile;

public sealed class UpdateGuestProfileCommandValidator : AbstractValidator<UpdateGuestProfileCommand>
{
    public UpdateGuestProfileCommandValidator()
    {
        RuleFor(v => v.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MinimumLength(2).WithMessage("Họ và tên phải có ít nhất 2 ký tự.")
            .MaximumLength(100).WithMessage("Họ và tên không được vượt quá 100 ký tự.");

        RuleFor(v => v.AvatarUrl)
            .MaximumLength(1000).WithMessage("Đường dẫn ảnh đại diện không được vượt quá 1000 ký tự.")
            .When(v => !string.IsNullOrEmpty(v.AvatarUrl));
    }
}
