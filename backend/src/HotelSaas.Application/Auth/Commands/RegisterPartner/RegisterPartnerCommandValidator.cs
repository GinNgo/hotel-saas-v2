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

        RuleFor(x => x.BrandName)
            .MaximumLength(200).WithMessage("Tên thương hiệu không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrWhiteSpace(x.BrandName));

        RuleFor(x => x.PropertyType)
            .Must(pt => System.Enum.IsDefined(typeof(HotelSaas.Domain.Enums.PropertyType), pt!.Value))
            .WithMessage("Loại hình cơ sở lưu trú không hợp lệ (giá trị hợp lệ từ 1 đến 8).")
            .When(x => x.PropertyType.HasValue);

        RuleFor(x => x.StarRating)
            .InclusiveBetween(1, 5).WithMessage("Hạng sao phải nằm trong khoảng từ 1 đến 5.")
            .When(x => x.StarRating.HasValue);

        RuleFor(x => x.Latitude)
            .InclusiveBetween(-90.0, 90.0).WithMessage("Vĩ độ phải nằm trong khoảng từ -90 đến 90.")
            .When(x => x.Latitude.HasValue);

        RuleFor(x => x.Longitude)
            .InclusiveBetween(-180.0, 180.0).WithMessage("Kinh độ phải nằm trong khoảng từ -180 đến 180.")
            .When(x => x.Longitude.HasValue);

        RuleFor(x => x.DefaultNightlyPrice)
            .GreaterThan(0m).WithMessage("Giá phòng theo đêm mặc định phải lớn hơn 0.")
            .When(x => x.DefaultNightlyPrice.HasValue);

        RuleFor(x => x.DefaultHourlyPrice)
            .GreaterThan(0m).WithMessage("Giá phòng theo giờ mặc định phải lớn hơn 0.")
            .When(x => x.DefaultHourlyPrice.HasValue);
    }
}
