using FluentValidation;

namespace HotelSaas.Application.Reports.Queries.GetGroupAnalytics;

/// <summary>
/// Validator kiểm tra hợp lệ khoảng thời gian truy vấn dữ liệu chuỗi khách sạn.
/// </summary>
public sealed class GetGroupAnalyticsQueryValidator : AbstractValidator<GetGroupAnalyticsQuery>
{
    public GetGroupAnalyticsQueryValidator()
    {
        RuleFor(x => x)
            .Must(x => !x.FromDate.HasValue || !x.ToDate.HasValue || x.FromDate.Value <= x.ToDate.Value)
            .WithMessage("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
    }
}
