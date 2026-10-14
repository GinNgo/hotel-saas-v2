using FluentValidation;

namespace HotelSaas.Application.Rooms.Commands.CreateRoom;

/// <summary>
/// Validates <see cref="CreateRoomCommand"/> before handler execution.
/// </summary>
public sealed class CreateRoomCommandValidator : AbstractValidator<CreateRoomCommand>
{
    /// <summary>
    /// Initializes validation rules for room creation.
    /// </summary>
    public CreateRoomCommandValidator()
    {
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

        RuleFor(x => x.PropertyId)
            .NotEqual(Guid.Empty).WithMessage("PropertyId không hợp lệ.")
            .When(x => x.PropertyId.HasValue);
    }
}
