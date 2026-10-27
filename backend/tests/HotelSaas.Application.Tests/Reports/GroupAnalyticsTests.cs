using System;
using FluentValidation.TestHelper;
using HotelSaas.Application.Reports.Queries.GetGroupAnalytics;
using Xunit;

namespace HotelSaas.Application.Tests.Reports;

public sealed class GroupAnalyticsTests
{
    private readonly GetGroupAnalyticsQueryValidator _validator = new();

    [Fact]
    public void Validator_NullDates_PassesValidation()
    {
        var query = new GetGroupAnalyticsQuery(null, null);
        var result = _validator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_FromDateEqualOrBeforeToDate_PassesValidation()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query1 = new GetGroupAnalyticsQuery(today.AddDays(-7), today);
        var result1 = _validator.TestValidate(query1);
        result1.ShouldNotHaveAnyValidationErrors();

        var query2 = new GetGroupAnalyticsQuery(today, today);
        var result2 = _validator.TestValidate(query2);
        result2.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_FromDateAfterToDate_HasValidationError()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var query = new GetGroupAnalyticsQuery(today, today.AddDays(-1));
        var result = _validator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x)
            .WithErrorMessage("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
    }

    [Fact]
    public void Dto_InitializesWithProperDefaults()
    {
        var dto = new GroupAnalyticsDto();

        Assert.Equal(0, dto.TotalProperties);
        Assert.Equal(0, dto.TotalRooms);
        Assert.Equal(0m, dto.TotalRevenue);
        Assert.Empty(dto.Properties);
        Assert.Empty(dto.DailyTrends);
        Assert.Empty(dto.ChannelDistribution);
        Assert.Empty(dto.PaymentDistribution);
    }
}
