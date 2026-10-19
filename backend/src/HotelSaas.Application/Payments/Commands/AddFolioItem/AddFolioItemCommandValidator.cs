using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.AddFolioItem;

public sealed class AddFolioItemCommandValidator : AbstractValidator<AddFolioItemCommand>
{
    public AddFolioItemCommandValidator()
    {
        RuleFor(x => x.ReservationId)
            .NotEmpty().WithMessage("Mã đơn đặt phòng không được để trống.");

        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("Mã chi nhánh cơ sở không được để trống.");

        RuleFor(x => x.ItemCode)
            .NotEmpty().WithMessage("Mã hàng hóa/dịch vụ không được để trống.")
            .MaximumLength(50).WithMessage("Mã hàng hóa/dịch vụ không được vượt quá 50 ký tự.");

        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("Tên/mô tả hàng hóa dịch vụ không được để trống.")
            .MaximumLength(255).WithMessage("Mô tả không được vượt quá 255 ký tự.");

        RuleFor(x => x.Quantity)
            .GreaterThan(0).WithMessage("Số lượng phải lớn hơn 0.");

        RuleFor(x => x.UnitPrice)
            .GreaterThanOrEqualTo(0m).WithMessage("Đơn giá không được âm.");
    }
}
