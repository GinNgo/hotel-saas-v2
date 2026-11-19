using FluentValidation;

namespace HotelSaas.Application.Platform.Commands.TogglePlatformUserStatus;

/// <summary>
/// Validates <see cref="TogglePlatformUserStatusCommand"/> inputs before execution.
/// </summary>
public sealed class TogglePlatformUserStatusCommandValidator : AbstractValidator<TogglePlatformUserStatusCommand>
{
    public TogglePlatformUserStatusCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("Mã người dùng là bắt buộc.");

        RuleFor(x => x.Reason)
            .MaximumLength(500).WithMessage("Lý do thay đổi trạng thái không được vượt quá 500 ký tự.");
    }
}
