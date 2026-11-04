using System;
using System.Collections.Generic;
using HotelSaas.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace HotelSaas.Application.Tests.Auth;

public sealed class EmailVerificationTokenTests
{
    private readonly JwtService _jwtService;

    public EmailVerificationTokenTests()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "SuperSecretKeyForEmailVerificationTestsAtLeast32BytesLong!",
                ["JwtSettings:Issuer"] = "HotelSaas",
                ["JwtSettings:Audience"] = "HotelSaasClient"
            })
            .Build();

        _jwtService = new JwtService(config);
    }

    [Fact]
    public void GenerateAndValidateEmailVerificationToken_ShouldSucceed_ForValidToken()
    {
        var userId = Guid.NewGuid();
        var email = "guest@example.com";

        var token = _jwtService.GenerateEmailVerificationToken(userId, email, TimeSpan.FromMinutes(30));

        Assert.NotNull(token);
        Assert.NotEmpty(token);

        var (isValid, extractedUserId, extractedEmail) = _jwtService.ValidateEmailVerificationToken(token);

        Assert.True(isValid);
        Assert.Equal(userId, extractedUserId);
        Assert.Equal(email, extractedEmail);
    }

    [Fact]
    public void ValidateEmailVerificationToken_ShouldFail_ForTamperedToken()
    {
        var (isValid, _, _) = _jwtService.ValidateEmailVerificationToken("invalid.tampered.token");
        Assert.False(isValid);
    }

    [Fact]
    public void ValidateEmailVerificationToken_ShouldFail_ForEmptyToken()
    {
        var (isValid, _, _) = _jwtService.ValidateEmailVerificationToken(string.Empty);
        Assert.False(isValid);
    }
}
