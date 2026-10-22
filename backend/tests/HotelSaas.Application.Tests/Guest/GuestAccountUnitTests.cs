using System;
using System.Threading.Tasks;
using FluentValidation.TestHelper;
using HotelSaas.Application.Guest.Commands.UpdateGuestProfile;
using HotelSaas.Application.Guest.Queries.GetGuestBookings;
using Xunit;

namespace HotelSaas.Application.Tests.Guest;

public sealed class GuestAccountUnitTests
{
    private readonly UpdateGuestProfileCommandValidator _profileValidator = new();
    private readonly GetGuestBookingsQueryValidator _bookingsValidator = new();

    [Fact]
    public void ProfileValidator_EmptyFullName_HasValidationError()
    {
        var command = new UpdateGuestProfileCommand("");
        var result = _profileValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void ProfileValidator_TooShortFullName_HasValidationError()
    {
        var command = new UpdateGuestProfileCommand("A");
        var result = _profileValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void ProfileValidator_TooLongFullName_HasValidationError()
    {
        var command = new UpdateGuestProfileCommand(new string('A', 101));
        var result = _profileValidator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(x => x.FullName);
    }

    [Fact]
    public void ProfileValidator_ValidFullName_PassesValidation()
    {
        var command = new UpdateGuestProfileCommand("Nguyễn Văn An");
        var result = _profileValidator.TestValidate(command);
        result.ShouldNotHaveValidationErrorFor(x => x.FullName);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(-1, 10)]
    public void BookingsValidator_InvalidPage_HasValidationError(int page, int pageSize)
    {
        var query = new GetGuestBookingsQuery(page, pageSize);
        var result = _bookingsValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.Page);
    }

    [Theory]
    [InlineData(1, 0)]
    [InlineData(1, -5)]
    [InlineData(1, 51)]
    [InlineData(1, 100)]
    public void BookingsValidator_InvalidPageSize_HasValidationError(int page, int pageSize)
    {
        var query = new GetGuestBookingsQuery(page, pageSize);
        var result = _bookingsValidator.TestValidate(query);
        result.ShouldHaveValidationErrorFor(x => x.PageSize);
    }

    [Theory]
    [InlineData(1, 10)]
    [InlineData(2, 20)]
    [InlineData(5, 50)]
    public void BookingsValidator_ValidPageAndPageSize_PassesValidation(int page, int pageSize)
    {
        var query = new GetGuestBookingsQuery(page, pageSize);
        var result = _bookingsValidator.TestValidate(query);
        result.ShouldNotHaveAnyValidationErrors();
    }
}
