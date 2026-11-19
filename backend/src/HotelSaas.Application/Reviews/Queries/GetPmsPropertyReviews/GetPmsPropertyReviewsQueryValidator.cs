using FluentValidation;

namespace HotelSaas.Application.Reviews.Queries.GetPmsPropertyReviews;

public sealed class GetPmsPropertyReviewsQueryValidator : AbstractValidator<GetPmsPropertyReviewsQuery>
{
    public GetPmsPropertyReviewsQueryValidator()
    {
        RuleFor(x => x.Rating)
            .InclusiveBetween(1, 5)
            .When(x => x.Rating.HasValue)
            .WithMessage("Bộ lọc số sao phải nằm trong khoảng từ 1 đến 5.");

        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Số trang phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithMessage("Kích thước trang phải từ 1 đến 100.");
    }
}
