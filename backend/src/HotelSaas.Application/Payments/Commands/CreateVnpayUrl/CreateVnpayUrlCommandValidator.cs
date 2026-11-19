using FluentValidation;

namespace HotelSaas.Application.Payments.Commands.CreateVnpayUrl;

/// <summary>
/// Validates <see cref="CreateVnpayUrlCommand"/> input length and return URL format.
/// Preserves handler-level ERR_RESERVATION_REQUIRED check when both ReservationId and LookupToken are omitted.
/// </summary>
public sealed class CreateVnpayUrlCommandValidator : AbstractValidator<CreateVnpayUrlCommand>
{
    /// <summary>
    /// Initializes validation rules for VNPay checkout URL generation.
    /// </summary>
    public CreateVnpayUrlCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .MaximumLength(200)
            .WithMessage("Mã tra cứu không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.LookupToken));

        RuleFor(x => x.ClientIp)
            .MaximumLength(100)
            .WithMessage("Địa chỉ IP không được vượt quá 100 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.ClientIp));

        When(x => !string.IsNullOrWhiteSpace(x.ReturnUrl), () =>
        {
            RuleFor(x => x.ReturnUrl!)
                .MaximumLength(1000)
                .WithMessage("URL quay lại không được vượt quá 1000 ký tự.")
                .Must(url => Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri) &&
                             (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
                .WithMessage("URL quay lại VNPay phải là địa chỉ HTTP/HTTPS hợp lệ.");
        });
    }
}
