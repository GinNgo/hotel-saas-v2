using FluentValidation;

namespace HotelSaas.Application.Staff.Commands.DeleteStaffMember;

/// <summary>
/// Validates <see cref="DeleteStaffMemberCommand"/> before handler execution.
/// </summary>
public sealed class DeleteStaffMemberCommandValidator : AbstractValidator<DeleteStaffMemberCommand>
{
    /// <summary>
    /// Initializes validation rules for staff member deletion.
    /// </summary>
    public DeleteStaffMemberCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("ID nhân viên không được để trống.");
    }
}
