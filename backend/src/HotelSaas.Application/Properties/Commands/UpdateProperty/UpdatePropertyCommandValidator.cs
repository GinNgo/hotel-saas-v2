using FluentValidation;

namespace HotelSaas.Application.Properties.Commands.UpdateProperty;

/// <summary>
/// Validates <see cref="UpdatePropertyCommand"/> before handler execution.
/// </summary>
public sealed class UpdatePropertyCommandValidator : AbstractValidator<UpdatePropertyCommand>
{
    /// <summary>
    /// Initializes validation rules for property updates matching database constraints.
    /// </summary>
    public UpdatePropertyCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Mã chi nhánh không được để trống.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên cơ sở lưu trú không được để trống.")
            .MaximumLength(200).WithMessage("Tên cơ sở lưu trú tối đa 200 ký tự.");

        RuleFor(x => x.Address)
            .NotEmpty().WithMessage("Địa chỉ không được để trống.")
            .MaximumLength(500).WithMessage("Địa chỉ tối đa 500 ký tự.");

        RuleFor(x => x.City)
            .NotEmpty().WithMessage("Thành phố/Tỉnh không được để trống.")
            .MaximumLength(100).WithMessage("Thành phố/Tỉnh tối đa 100 ký tự.");

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(20).WithMessage("Số điện thoại tối đa 20 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.PhoneNumber));

        When(x => !string.IsNullOrWhiteSpace(x.Email), () =>
        {
            RuleFor(x => x.Email!)
                .EmailAddress().WithMessage("Email liên hệ không đúng định dạng.")
                .MaximumLength(200).WithMessage("Email liên hệ tối đa 200 ký tự.");
        });

        RuleFor(x => x.PropertyType)
            .IsInEnum().WithMessage("Loại hình cơ sở lưu trú không hợp lệ.");

        RuleFor(x => x.StarRating)
            .InclusiveBetween(0, 5).WithMessage("Hạng sao phải nằm trong khoảng từ 0 đến 5.");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Trạng thái chi nhánh không hợp lệ.");

        RuleFor(x => x.TouristZoneSlug)
            .MaximumLength(100).WithMessage("Mã khu du lịch tối đa 100 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.TouristZoneSlug));

        RuleFor(x => x.TouristZoneName)
            .MaximumLength(200).WithMessage("Tên khu du lịch tối đa 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.TouristZoneName));

        RuleFor(x => x.NearbyLandmarksJson)
            .MaximumLength(4000).WithMessage("Dữ liệu địa điểm lân cận tối đa 4000 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.NearbyLandmarksJson));

        When(x => x.Latitude.HasValue, () =>
        {
            RuleFor(x => x.Latitude!.Value)
                .InclusiveBetween(-90d, 90d)
                .WithMessage("Vĩ độ (Latitude) phải nằm trong khoảng từ -90 đến 90.");
        });

        When(x => x.Longitude.HasValue, () =>
        {
            RuleFor(x => x.Longitude!.Value)
                .InclusiveBetween(-180d, 180d)
                .WithMessage("Kinh độ (Longitude) phải nằm trong khoảng từ -180 đến 180.");
        });
    }
}
