using FluentValidation;

namespace HotelSaas.Application.Reviews.Commands.ReplyGuestReview;

public sealed class ReplyGuestReviewCommandValidator : AbstractValidator<ReplyGuestReviewCommand>
{
    public ReplyGuestReviewCommandValidator()
    {
        RuleFor(x => x.ReviewId)
            .NotEmpty().WithMessage("Mã đánh giá không hợp lệ.");

        RuleFor(x => x.Reply)
            .NotEmpty().WithMessage("Nội dung phản hồi không được để trống.")
            .Must(r => !string.IsNullOrWhiteSpace(r)).WithMessage("Nội dung phản hồi không được chỉ chứa khoảng trắng.")
            .MaximumLength(2000).WithMessage("Nội dung phản hồi không được vượt quá 2000 ký tự.");
    }
}
