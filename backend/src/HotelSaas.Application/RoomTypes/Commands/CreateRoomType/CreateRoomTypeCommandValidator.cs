using FluentValidation;

namespace HotelSaas.Application.RoomTypes.Commands.CreateRoomType;

/// <summary>
/// Validates <see cref="CreateRoomTypeCommand"/> before handler execution.
/// </summary>
public sealed class CreateRoomTypeCommandValidator : AbstractValidator<CreateRoomTypeCommand>
{
    /// <summary>
    /// Initializes validation rules for room type creation.
    /// </summary>
    public CreateRoomTypeCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên loại phòng không được để trống.")
            .MaximumLength(100).WithMessage("Tên loại phòng tối đa 100 ký tự.");

        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã loại phòng không được để trống.")
            .MaximumLength(20).WithMessage("Mã loại phòng tối đa 20 ký tự.")
            .Matches("^[A-Z0-9_]+$").WithMessage("Mã loại phòng chỉ bao gồm chữ in hoa, chữ số và dấu gạch dưới.");

        RuleFor(x => x.BasePrice)
            .GreaterThan(0).WithMessage("Giá cơ bản phải lớn hơn 0.");

        RuleFor(x => x.MaxOccupancy)
            .InclusiveBetween(1, 20).WithMessage("Sức chứa phải từ 1 đến 20 khách.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Mô tả tối đa 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Description));

        RuleFor(x => x.BedType)
            .MaximumLength(50).WithMessage("Loại giường tối đa 50 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.BedType));

        RuleFor(x => x.PropertyId)
            .NotEqual(Guid.Empty).WithMessage("PropertyId không hợp lệ.")
            .When(x => x.PropertyId.HasValue);
    }
}
