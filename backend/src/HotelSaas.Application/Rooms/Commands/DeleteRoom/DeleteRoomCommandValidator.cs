using FluentValidation;

namespace HotelSaas.Application.Rooms.Commands.DeleteRoom;

/// <summary>
/// Validates <see cref="DeleteRoomCommand"/> before handler execution.
/// </summary>
public sealed class DeleteRoomCommandValidator : AbstractValidator<DeleteRoomCommand>
{
    /// <summary>
    /// Initializes validation rules for room deletion.
    /// </summary>
    public DeleteRoomCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("ID phòng không được để trống.");
    }
}
