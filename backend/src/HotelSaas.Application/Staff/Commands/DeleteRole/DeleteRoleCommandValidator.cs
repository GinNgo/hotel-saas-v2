using FluentValidation;

namespace HotelSaas.Application.Staff.Commands.DeleteRole;

/// <summary>
/// Validates <see cref="DeleteRoleCommand"/> before handler execution.
/// </summary>
public sealed class DeleteRoleCommandValidator : AbstractValidator<DeleteRoleCommand>
{
    /// <summary>
    /// Initializes validation rules for role deletion.
    /// </summary>
    public DeleteRoleCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Mã chức vụ không được để trống.");
    }
}
