using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.RegisterPartner;

/// <summary>
/// Validator for <see cref="RegisterPartnerCommand"/>.
/// </summary>
public sealed class RegisterPartnerCommandValidator : AbstractValidator<RegisterPartnerCommand>
{
    public RegisterPartnerCommandValidator()
    {
        RuleFor(x => x.FullName)
            .NotEmpty().WithMessage("Họ và tên không được để trống.")
            .MaximumLength(150).WithMessage("Họ và tên không được vượt quá 150 ký tự.");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email không được để trống.")
            .EmailAddress().WithMessage("Địa chỉ email không đúng định dạng.")
            .MaximumLength(200).WithMessage("Email không được vượt quá 200 ký tự.");

        RuleFor(x => x.Password)
            .MinimumLength(6).WithMessage("Mật khẩu phải có ít nhất 6 ký tự.")
            .MaximumLength(100).WithMessage("Mật khẩu không được vượt quá 100 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.Password));

        RuleFor(x => x.PhoneNumber)
            .NotEmpty().WithMessage("Số điện thoại không được để trống.")
            .MaximumLength(20).WithMessage("Số điện thoại không được vượt quá 20 ký tự.");

        RuleFor(x => x.PropertyName)
            .NotEmpty().WithMessage("Tên khách sạn/cơ sở lưu trú không được để trống.")
            .MaximumLength(200).WithMessage("Tên khách sạn không được vượt quá 200 ký tự.");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Địa chỉ chi tiết không được để trống.")
            .MaximumLength(300).WithMessage("Địa chỉ chi tiết không được vượt quá 300 ký tự.");

        RuleFor(x => x.ProvinceCode)
            .NotEmpty().WithMessage("Vui lòng chọn Tỉnh/Thành phố.");
    }
}
