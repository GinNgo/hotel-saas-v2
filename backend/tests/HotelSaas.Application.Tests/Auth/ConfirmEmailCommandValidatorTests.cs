using HotelSaas.Application.Auth.Commands.ConfirmEmail;
using Xunit;

namespace HotelSaas.Application.Tests.Auth;

public sealed class ConfirmEmailCommandValidatorTests
{
    private readonly ConfirmEmailCommandValidator _validator = new();

    [Fact]
    public void Validator_ShouldFail_WhenTokenIsEmpty()
    {
        var command = new ConfirmEmailCommand(string.Empty);
        var result = _validator.Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == nameof(ConfirmEmailCommand.Token));
    }

    [Fact]
    public void Validator_ShouldPass_WhenTokenIsProvided()
    {
        var command = new ConfirmEmailCommand("valid.jwt.token");
        var result = _validator.Validate(command);

        Assert.True(result.IsValid);
    }
}
