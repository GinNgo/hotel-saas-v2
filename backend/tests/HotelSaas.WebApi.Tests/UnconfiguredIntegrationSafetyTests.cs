using HotelSaas.Application.Auth.Commands.SocialLogin;
using HotelSaas.Infrastructure.Services;
using HotelSaas.WebApi.Controllers;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

namespace HotelSaas.WebApi.Tests;

public sealed class UnconfiguredIntegrationSafetyTests
{
    [Fact]
    public async Task SocialLogin_DoesNotDispatchUnverifiedIdentity()
    {
        var controller = new AuthController(null!);
        var result = await controller.SocialLogin(
            new SocialLoginCommand("Google", "unverified-subject", "qa@example.invalid"),
            CancellationToken.None);

        var response = Assert.IsType<ObjectResult>(result);
        Assert.Equal(503, response.StatusCode);
    }

    [Fact]
    public void Vnpay_WithoutCredentials_CannotCreateUrlOrVerifyCallback()
    {
        var service = new VnpayPaymentService(new ConfigurationBuilder().Build());

        Assert.Throws<InvalidOperationException>(() => service.CreatePaymentUrl(
            Guid.NewGuid(), "QA", 100000m, "QA booking", "127.0.0.1"));
        var result = service.VerifyCallback(new Dictionary<string, string>());
        Assert.False(result.IsValid);
    }
}
