using FluentValidation;

namespace HotelSaas.Application.Platform.Commands.UpdatePlatformUserRole;

/// <summary>
/// Validates <see cref="UpdatePlatformUserRoleCommand"/> inputs before execution.
/// </summary>
public sealed class UpdatePlatformUserRoleCommandValidator : AbstractValidator<UpdatePlatformUserRoleCommand>
{
    public UpdatePlatformUserRoleCommandValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("Mã người dùng là bắt buộc.");

        RuleFor(x => x.TargetRole)
            .IsInEnum().WithMessage("Vai trò hệ thống không hợp lệ.");
    }
}
