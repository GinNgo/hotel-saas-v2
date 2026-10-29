using System;
using FluentValidation.TestHelper;
using HotelSaas.Application.Reviews.Commands.SubmitGuestReview;
using Xunit;

namespace HotelSaas.Application.Tests.Reviews;

public sealed class GuestReviewTests
{
    private readonly SubmitGuestReviewCommandValidator _validator = new();

    [Fact]
    public void Validator_RejectsEmptyLookupToken()
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "",
            Rating: 5,
            Comment: "Dịch vụ tuyệt vời");

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.LookupToken);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(6)]
    [InlineData(10)]
    public void Validator_RejectsOverallRatingOutside1To5(int invalidRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-123",
            Rating: invalidRating,
            Comment: "Nhận xét");

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Rating);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public void Validator_AcceptsValidRatings(int validRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: validRating,
            CleanlinessRating: validRating,
            LocationRating: validRating,
            ServiceRating: validRating,
            ValueRating: validRating,
            Comment: "Phòng sạch sẽ, vị trí trung tâm thuận tiện.");

        var result = _validator.TestValidate(cmd);
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validator_RejectsExcessiveCommentLength()
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: 5,
            Comment: new string('a', 1501));

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.Comment);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void Validator_RejectsSubRatingsOutside1To5(int invalidSubRating)
    {
        var cmd = new SubmitGuestReviewCommand(
            LookupToken: "TOKEN-VALID",
            Rating: 5,
            CleanlinessRating: invalidSubRating);

        var result = _validator.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.CleanlinessRating);
    }
}
