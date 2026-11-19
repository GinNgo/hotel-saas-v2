using FluentValidation;

namespace HotelSaas.Application.Reviews.Commands.ToggleReviewVisibility;

public sealed class ToggleReviewVisibilityCommandValidator : AbstractValidator<ToggleReviewVisibilityCommand>
{
    public ToggleReviewVisibilityCommandValidator()
    {
        RuleFor(x => x.ReviewId)
            .NotEmpty().WithMessage("Mã đánh giá không hợp lệ.");
    }
}
