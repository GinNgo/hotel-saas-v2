using FluentValidation;

namespace HotelSaas.Application.Print.Commands.SavePrintTemplateConfig;

public sealed class SavePrintTemplateConfigCommandValidator : AbstractValidator<SavePrintTemplateConfigCommand>
{
    public SavePrintTemplateConfigCommandValidator()
    {
        RuleFor(x => x.HeaderCompanyName)
            .MaximumLength(250);

        RuleFor(x => x.HeaderAddress)
            .MaximumLength(500);

        RuleFor(x => x.TaxNumber)
            .MaximumLength(50);

        RuleFor(x => x.Hotline)
            .MaximumLength(50);

        RuleFor(x => x.LogoUrl)
            .MaximumLength(1000)
            .When(x => x.LogoUrl != null);

        RuleFor(x => x.BankName)
            .MaximumLength(150);

        RuleFor(x => x.BankAccountNumber)
            .MaximumLength(50);

        RuleFor(x => x.BankAccountHolder)
            .MaximumLength(200);

        RuleFor(x => x.FooterNote)
            .MaximumLength(1000);

        RuleFor(x => x.CheckInPolicyText)
            .MaximumLength(1000);

        RuleFor(x => x.DefaultPaperSize)
            .MaximumLength(20);
    }
}
