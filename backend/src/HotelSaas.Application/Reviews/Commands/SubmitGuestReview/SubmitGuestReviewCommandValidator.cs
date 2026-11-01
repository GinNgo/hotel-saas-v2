using FluentValidation;

namespace HotelSaas.Application.Reviews.Commands.SubmitGuestReview;

public sealed class SubmitGuestReviewCommandValidator : AbstractValidator<SubmitGuestReviewCommand>
{
    public SubmitGuestReviewCommandValidator()
    {
        RuleFor(x => x.LookupToken)
            .NotEmpty().WithMessage("Mã tra cứu đặt phòng không được để trống.");

        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5).WithMessage("Điểm đánh giá tổng quan phải từ 1 đến 5 sao.");

        RuleFor(x => x.CleanlinessRating)
            .InclusiveBetween(1, 5).When(x => x.CleanlinessRating.HasValue)
            .WithMessage("Điểm vệ sinh phải từ 1 đến 5 sao.");

        RuleFor(x => x.LocationRating)
            .InclusiveBetween(1, 5).When(x => x.LocationRating.HasValue)
            .WithMessage("Điểm vị trí phải từ 1 đến 5 sao.");

        RuleFor(x => x.ServiceRating)
            .InclusiveBetween(1, 5).When(x => x.ServiceRating.HasValue)
            .WithMessage("Điểm dịch vụ phải từ 1 đến 5 sao.");

        RuleFor(x => x.ValueRating)
            .InclusiveBetween(1, 5).When(x => x.ValueRating.HasValue)
            .WithMessage("Điểm giá trị phải từ 1 đến 5 sao.");

        RuleFor(x => x.Comment)
            .MaximumLength(1500).WithMessage("Nội dung nhận xét không được vượt quá 1500 ký tự.");
    }
}
