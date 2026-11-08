using FluentValidation;

namespace HotelSaas.Application.Auth.Commands.VerifyPhoneFirebase;

public sealed class VerifyPhoneFirebaseCommandValidator : AbstractValidator<VerifyPhoneFirebaseCommand>
{
    public VerifyPhoneFirebaseCommandValidator()
    {
        RuleFor(x => x.FirebaseIdToken)
            .NotEmpty()
            .WithMessage("Mã xác thực Firebase ID Token không được để trống.");
    }
}
