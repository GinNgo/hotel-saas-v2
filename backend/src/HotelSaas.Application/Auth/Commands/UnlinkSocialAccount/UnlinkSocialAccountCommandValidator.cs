using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.UnlinkSocialAccount;

/// <summary>
/// Validates <see cref="UnlinkSocialAccountCommand"/> inputs.
/// </summary>
public sealed class UnlinkSocialAccountCommandValidator : AbstractValidator<UnlinkSocialAccountCommand>
{
    public UnlinkSocialAccountCommandValidator()
    {
        RuleFor(x => x.Provider)
            .NotEmpty().WithMessage("Vui lòng chỉ định nhà cung cấp mạng xã hội cần hủy liên kết.")
            .MaximumLength(50).WithMessage("Tên nhà cung cấp không hợp lệ.");
    }
}
