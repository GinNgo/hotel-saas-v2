using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.LinkSocialAccount;

/// <summary>
/// Validates <see cref="LinkSocialAccountCommand"/> inputs.
/// </summary>
public sealed class LinkSocialAccountCommandValidator : AbstractValidator<LinkSocialAccountCommand>
{
    public LinkSocialAccountCommandValidator()
    {
        RuleFor(x => x.IdToken)
            .NotEmpty().WithMessage("Mã xác thực tài khoản mạng xã hội không được để trống.");

        RuleFor(x => x.Provider)
            .NotEmpty().WithMessage("Nhà cung cấp không được để trống.")
            .Must(p => string.Equals(p.Trim(), "Google", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Hiện tại hệ thống chỉ hỗ trợ liên kết tài khoản Google.");
    }
}
