using FluentValidation;

namespace HotelSaas.Application.Contracts.Commands.UpdateAdminContractStatus;

public sealed class UpdateAdminContractStatusCommandValidator : AbstractValidator<UpdateAdminContractStatusCommand>
{
    public UpdateAdminContractStatusCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty();

        RuleFor(x => x.Status)
            .MaximumLength(50);

        RuleFor(x => x.Note)
            .MaximumLength(2000)
            .When(x => x.Note != null);

        RuleFor(x => x.Notes)
            .MaximumLength(2000)
            .When(x => x.Notes != null);
    }
}
