using FluentValidation;

namespace HotelSaas.Application.Rooms.Commands.UpdateRoomStatus;

/// <summary>
/// Validates <see cref="UpdateRoomStatusCommand"/> before execution.
/// </summary>
public sealed class UpdateRoomStatusCommandValidator : AbstractValidator<UpdateRoomStatusCommand>
{
    /// <summary>
    /// Initializes validation rules for updating room status.
    /// </summary>
    public UpdateRoomStatusCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("ID phòng không được để trống.");

        RuleFor(x => x.Status)
            .IsInEnum().WithMessage("Trạng thái phòng không hợp lệ.");

        RuleFor(x => x.ExpectedOldStatus)
            .NotNull().WithMessage("Trạng thái mong đợi cũ (ExpectedOldStatus) là bắt buộc.")
            .IsInEnum().WithMessage("Trạng thái mong đợi cũ không hợp lệ.");
    }
}
