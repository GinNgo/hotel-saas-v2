using FluentValidation;

namespace HotelSaas.Application.RoomTypes.Commands.DeleteRoomType;

/// <summary>
/// Validates <see cref="DeleteRoomTypeCommand"/> before handler execution.
/// </summary>
public sealed class DeleteRoomTypeCommandValidator : AbstractValidator<DeleteRoomTypeCommand>
{
    /// <summary>
    /// Initializes validation rules for room type deletion.
    /// </summary>
    public DeleteRoomTypeCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("ID loại phòng không được để trống.");
    }
}
