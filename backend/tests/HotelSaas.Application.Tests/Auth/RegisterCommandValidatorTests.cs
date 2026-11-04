using FluentValidation.TestHelper;
using HotelSaas.Application.Auth.Commands.Register;
using Xunit;

namespace HotelSaas.Application.Tests.Auth;

public sealed class RegisterCommandValidatorTests
{
    private readonly RegisterCommandValidator _validator = new();

    [Fact]
    public void Validate_ValidCommandWithPhoneAndAvatar_Passes()
    {
        var command = new RegisterCommand(
            Email: "ngovotuananh@gmail.com",
            Password: "SecurePassword123!",
            FullName: "An Ngô Võ Tuấn",
            PhoneNumber: "+84912345678",
            AvatarUrl: "https://example.com/avatar.png");

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_MissingEmail_Fails()
    {
        var command = new RegisterCommand(
            Email: "",
            Password: "SecurePassword123!",
            FullName: "An Ngô Võ Tuấn");

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WeakPassword_Fails()
    {
        var command = new RegisterCommand(
            Email: "test@example.com",
            Password: "weak",
            FullName: "Test User");

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Theory]
    [InlineData("0912345678")]
    [InlineData("+84987654321")]
    [InlineData("02838123456")]
    public void Validate_ValidPhoneNumbers_Pass(string phone)
    {
        var command = new RegisterCommand(
            Email: "test@example.com",
            Password: "SecurePassword123!",
            FullName: "Test User",
            PhoneNumber: phone);

        var result = _validator.TestValidate(command);

        result.ShouldNotHaveValidationErrorFor(x => x.PhoneNumber);
    }

    [Theory]
    [InlineData("abcd")]
    [InlineData("123")]
    [InlineData("phone-number!")]
    public void Validate_InvalidPhoneNumbers_Fail(string phone)
    {
        var command = new RegisterCommand(
            Email: "test@example.com",
            Password: "SecurePassword123!",
            FullName: "Test User",
            PhoneNumber: phone);

        var result = _validator.TestValidate(command);

        result.ShouldHaveValidationErrorFor(x => x.PhoneNumber);
    }
}
