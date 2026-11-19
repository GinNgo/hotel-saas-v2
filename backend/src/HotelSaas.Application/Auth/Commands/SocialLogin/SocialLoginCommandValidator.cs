using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.SocialLogin;

/// <summary>
/// Validates <see cref="SocialLoginCommand"/> string length bounds matching database constraints.
/// Preserves handler-level argument validation for empty Provider or ProviderSubject.
/// </summary>
public sealed class SocialLoginCommandValidator : AbstractValidator<SocialLoginCommand>
{
    /// <summary>
    /// Initializes validation rules for social login.
    /// </summary>
    public SocialLoginCommandValidator()
    {
        RuleFor(x => x.Provider)
            .MaximumLength(32)
            .WithMessage("Tên nhà cung cấp không được vượt quá 32 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.Provider));

        RuleFor(x => x.ProviderSubject)
            .MaximumLength(255)
            .WithMessage("Định danh người dùng không được vượt quá 255 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.ProviderSubject));

        RuleFor(x => x.ProviderEmail)
            .MaximumLength(320)
            .WithMessage("Email không được vượt quá 320 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.ProviderEmail));

        RuleFor(x => x.FullName)
            .MaximumLength(200)
            .WithMessage("Họ và tên không được vượt quá 200 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.FullName));

        RuleFor(x => x.AvatarUrl)
            .MaximumLength(1000)
            .WithMessage("Đường dẫn ảnh đại diện không được vượt quá 1000 ký tự.")
            .When(x => !string.IsNullOrEmpty(x.AvatarUrl));
    }
}
