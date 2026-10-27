using FluentValidation;

namespace HotelSaas.Application.Guest.Queries.GetGuestBookings;

public sealed class GetGuestBookingsQueryValidator : AbstractValidator<GetGuestBookingsQuery>
{
    public GetGuestBookingsQueryValidator()
    {
        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithMessage("Chỉ số trang (Page) phải lớn hơn hoặc bằng 1.");

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 50)
            .WithMessage("Kích thước trang (PageSize) phải từ 1 đến 50 phần tử.");
    }
}
