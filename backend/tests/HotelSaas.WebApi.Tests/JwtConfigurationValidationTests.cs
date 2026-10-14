using System.Text;
using HotelSaas.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HotelSaas.WebApi.Tests;

/// <summary>
/// Unit and integration tests for unified JWT configuration validation and startup fail-fast behavior.
/// Ensures that secret keys that are missing, whitespace, or less than 32 bytes (256 bits for HMAC-SHA256)
/// immediately abort execution both at DI/service level and at WebHost startup.
/// </summary>
public class JwtConfigurationValidationTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateSecretKey_WhenNullOrWhitespace_ThrowsInvalidOperationException(string? invalidKey)
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            JwtKeyValidator.ValidateSecretKey(invalidKey));

        Assert.Contains("JwtSettings:SecretKey is not configured or is empty", ex.Message);
    }

    [Theory]
    [InlineData("a")]
    [InlineData("short-key")]
    [InlineData("1234567890123456789012345678901")] // 31 bytes
    public void ValidateSecretKey_WhenTooShort_ThrowsInvalidOperationException(string shortKey)
    {
        var ex = Assert.Throws<InvalidOperationException>(() =>
            JwtKeyValidator.ValidateSecretKey(shortKey));

        Assert.Contains("too short", ex.Message);
        Assert.Contains("at least 32 bytes", ex.Message);
    }

    [Theory]
    [InlineData("12345678901234567890123456789012")] // Exactly 32 bytes
    [InlineData("SuperSecretKeyForTestingPurposesMustBeAtLeast32BytesLong!")] // 56 bytes
    public void ValidateSecretKey_WhenValid_ReturnsKey(string validKey)
    {
        var result = JwtKeyValidator.ValidateSecretKey(validKey);

        Assert.Equal(validKey, result);
    }

    [Fact]
    public void JwtService_GenerateTokens_WhenSecretKeyMissing_FailsFast()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = ""
            })
            .Build();

        var service = new JwtService(config);

        var ex = Assert.Throws<InvalidOperationException>(() =>
            service.GenerateTokens(Guid.NewGuid(), "test@test.com", "Test", "User", null, null));

        Assert.Contains("JwtSettings:SecretKey is not configured or is empty", ex.Message);
    }

    [Fact]
    public void JwtService_GenerateTokens_WhenSecretKeyTooShort_FailsFast()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "short-key-less-than-32-b"
            })
            .Build();

        var service = new JwtService(config);

        var ex = Assert.Throws<InvalidOperationException>(() =>
            service.GenerateTokens(Guid.NewGuid(), "test@test.com", "Test", "User", null, null));

        Assert.Contains("too short", ex.Message);
    }

    [Fact]
    public void JwtService_GetPrincipalFromExpiredToken_WhenSecretKeyMissing_FailsFast()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = ""
            })
            .Build();

        var service = new JwtService(config);

        var ex = Assert.Throws<InvalidOperationException>(() =>
            service.GetPrincipalFromExpiredToken("dummy.jwt.token"));

        Assert.Contains("JwtSettings:SecretKey is not configured or is empty", ex.Message);
    }

    private sealed class FailFastFactory : WebApplicationFactory<Program>
    {
        private readonly string? _secretKey;

        public FailFastFactory(string? secretKey)
        {
            _secretKey = secretKey;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SkipStartupDatabaseInit", "true");
            builder.UseSetting("JwtSettings:SecretKey", _secretKey ?? string.Empty);
            builder.ConfigureAppConfiguration((_, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["JwtSettings:SecretKey"] = _secretKey ?? string.Empty,
                    ["SkipStartupDatabaseInit"] = "true"
                });
            });
        }
    }

    [Fact]
    public void WebApplicationStartup_WhenSecretKeyIsEmpty_ThrowsInvalidOperationException()
    {
        using var factory = new FailFastFactory(string.Empty);

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        // Extract innermost exception
        var inner = ex;
        while (inner.InnerException != null)
        {
            inner = inner.InnerException;
        }

        Assert.IsType<InvalidOperationException>(inner);
        Assert.Contains("JwtSettings:SecretKey is not configured or is empty", inner.Message);
    }

    [Fact]
    public void WebApplicationStartup_WhenSecretKeyIsTooShort_ThrowsInvalidOperationException()
    {
        using var factory = new FailFastFactory("short-key");

        var ex = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        // Extract innermost exception
        var inner = ex;
        while (inner.InnerException != null)
        {
            inner = inner.InnerException;
        }

        Assert.IsType<InvalidOperationException>(inner);
        Assert.Contains("too short", inner.Message);
        Assert.Contains("at least 32 bytes", inner.Message);
    }
}
