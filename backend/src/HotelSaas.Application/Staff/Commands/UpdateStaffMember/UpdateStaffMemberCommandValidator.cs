using FluentValidation;

namespace HotelSaas.Application.Staff.Commands.UpdateStaffMember;

/// <summary>
/// Validates <see cref="UpdateStaffMemberCommand"/> before handler execution.
/// Preserves handler semantics where PropertyId = Guid.Empty clears branch assignment to Tenant-Wide HQ.
/// </summary>
public sealed class UpdateStaffMemberCommandValidator : AbstractValidator<UpdateStaffMemberCommand>
{
    /// <summary>
    /// Initializes validation rules for staff member assignment updates.
    /// </summary>
    public UpdateStaffMemberCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("ID nhân viên không được để trống.");

        When(x => x.StaffRole.HasValue, () =>
        {
            RuleFor(x => x.StaffRole!.Value)
                .IsInEnum()
                .WithMessage("Vai trò nhân sự không hợp lệ.");
        });
    }
}
