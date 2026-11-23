using FluentValidation;

namespace HotelSaas.Application.Contracts.Commands.CreateAdminContract;

public sealed class CreateAdminContractCommandValidator : AbstractValidator<CreateAdminContractCommand>
{
    public CreateAdminContractCommandValidator()
    {
        RuleFor(x => x.ContractNumber)
            .MaximumLength(100)
            .When(x => x.ContractNumber != null);

        RuleFor(x => x.PlanCode)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(x => x.PlanName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.ContractType)
            .MaximumLength(100)
            .When(x => x.ContractType != null);

        RuleFor(x => x.RepresentativeName)
            .MaximumLength(200);

        RuleFor(x => x.RepresentativeEmail)
            .MaximumLength(256);

        RuleFor(x => x.RepresentativePhone)
            .MaximumLength(50)
            .When(x => x.RepresentativePhone != null);

        RuleFor(x => x.BillingCycle)
            .MaximumLength(50)
            .When(x => x.BillingCycle != null);

        RuleFor(x => x.ContractValue)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.TermsAndConditions)
            .MaximumLength(10000)
            .When(x => x.TermsAndConditions != null);

        RuleFor(x => x.Notes)
            .MaximumLength(4000)
            .When(x => x.Notes != null);
    }
}
