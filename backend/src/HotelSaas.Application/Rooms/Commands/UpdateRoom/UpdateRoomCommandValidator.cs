using FluentValidation;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoom;

/// <summary>
/// Validates <see cref="UpdateRoomCommand"/> before handler execution.
/// </summary>
public sealed class UpdateRoomCommandValidator : AbstractValidator<UpdateRoomCommand>
{
    /// <summary>
    /// Initializes validation rules for room update.
    /// </summary>
    public UpdateRoomCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID phòng không được để trống.");

        RuleFor(x => x.RoomNumber)
            .NotEmpty().WithMessage("Số phòng không được để trống.")
            .MaximumLength(20).WithMessage("Số phòng tối đa 20 ký tự.");

        RuleFor(x => x.RoomTypeId)
            .NotEmpty().WithMessage("Loại phòng không được để trống.");

        RuleFor(x => x.Floor)
            .GreaterThanOrEqualTo(0).WithMessage("Tầng phải lớn hơn hoặc bằng 0.");

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Ghi chú tối đa 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
