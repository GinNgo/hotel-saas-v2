using FluentValidation;

namespace HotelSaas.Application.Loyalty.Commands.EnrollPropertyMembership;

/// <summary>
/// Validates <see cref="EnrollPropertyMembershipCommand"/> before handler execution.
/// </summary>
public sealed class EnrollPropertyMembershipCommandValidator : AbstractValidator<EnrollPropertyMembershipCommand>
{
    /// <summary>
    /// Initializes validation rules for guest loyalty enrollment.
    /// </summary>
    public EnrollPropertyMembershipCommandValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty()
            .WithMessage("Mã cơ sở lưu trú không được để trống.");
    }
}
