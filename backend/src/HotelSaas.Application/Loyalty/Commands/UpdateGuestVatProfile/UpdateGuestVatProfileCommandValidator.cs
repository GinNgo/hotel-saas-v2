using FluentValidation;

namespace HotelSaas.Application.Loyalty.Commands.UpdateGuestVatProfile;

/// <summary>
/// Validates <see cref="UpdateGuestVatProfileCommand"/> field length bounds before handler execution.
/// All fields remain optional so guests can partially update or clear VAT billing info.
/// </summary>
public sealed class UpdateGuestVatProfileCommandValidator : AbstractValidator<UpdateGuestVatProfileCommand>
{
    /// <summary>
    /// Initializes validation rules for guest VAT profile updates.
    /// </summary>
    public UpdateGuestVatProfileCommandValidator()
    {
        RuleFor(x => x.CompanyName)
            .MaximumLength(200)
            .WithMessage("Tên công ty không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.CompanyName));

        RuleFor(x => x.CompanyTaxCode)
            .MaximumLength(50)
            .WithMessage("Mã số thuế không được vượt quá 50 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.CompanyTaxCode));

        RuleFor(x => x.CompanyAddress)
            .MaximumLength(500)
            .WithMessage("Địa chỉ công ty không được vượt quá 500 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.CompanyAddress));
    }
}
