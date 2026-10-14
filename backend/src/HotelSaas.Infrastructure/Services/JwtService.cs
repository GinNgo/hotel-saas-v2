using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// JWT token generation and validation service.
/// Produces signed access tokens with role/permission claims and cryptographic refresh tokens.
/// </summary>
public sealed class JwtService : IJwtService
{
    private readonly IConfiguration _configuration;

    /// <summary>
    /// Initializes a new instance of <see cref="JwtService"/>.
    /// </summary>
    /// <param name="configuration">Application configuration containing JwtSettings section.</param>
    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    /// <inheritdoc />
    public (string accessToken, string refreshToken, DateTime expiresAtUtc) GenerateTokens(
        Guid userId,
        string email,
        string fullName,
        string globalRole,
        Guid? tenantId,
        IReadOnlyList<string>? permissions,
        Guid? propertyId = null,
        string? scope = null,
        string? staffRole = null)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = JwtKeyValidator.ValidateSecretKey(jwtSettings["SecretKey"]);
        var issuer = jwtSettings["Issuer"] ?? "HotelSaas";
        var audience = jwtSettings["Audience"] ?? "HotelSaasClient";
        var accessTokenExpirationMinutes = int.Parse(
            jwtSettings["AccessTokenExpirationMinutes"] ?? "60");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expiresAtUtc = DateTime.UtcNow.AddMinutes(accessTokenExpirationMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(JwtRegisteredClaimNames.Email, email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("fullName", fullName),
            new("globalRole", globalRole)
        };

        if (tenantId.HasValue)
        {
            claims.Add(new Claim("tenantId", tenantId.Value.ToString()));
            claims.Add(new Claim("tid", tenantId.Value.ToString()));
        }

        if (propertyId.HasValue)
        {
            claims.Add(new Claim("propertyId", propertyId.Value.ToString()));
            claims.Add(new Claim("pid", propertyId.Value.ToString()));
        }

        if (!string.IsNullOrEmpty(scope))
        {
            claims.Add(new Claim("scope", scope));
        }

        if (!string.IsNullOrEmpty(staffRole))
        {
            claims.Add(new Claim("staffRole", staffRole));
        }

        if (permissions is { Count: > 0 })
        {
            claims.Add(new Claim("permissions",
                System.Text.Json.JsonSerializer.Serialize(permissions)));
        }

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = GenerateRefreshToken();

        return (accessToken, refreshToken, expiresAtUtc);
    }

    /// <inheritdoc />
    public string GenerateRefreshToken()
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    /// <inheritdoc />
    public int GetRefreshTokenExpirationDays()
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        return int.Parse(jwtSettings["RefreshTokenExpirationDays"] ?? "7");
    }

    /// <inheritdoc />
    public ClaimsPrincipal GetPrincipalFromExpiredToken(string token)
    {
        var jwtSettings = _configuration.GetSection("JwtSettings");
        var secretKey = JwtKeyValidator.ValidateSecretKey(jwtSettings["SecretKey"]);

        var tokenValidationParameters = new TokenValidationParameters
        {
            ValidateAudience = true,
            ValidateIssuer = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings["Issuer"] ?? "HotelSaas",
            ValidAudience = jwtSettings["Audience"] ?? "HotelSaasClient",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            ValidateLifetime = false // Allow expired tokens for refresh flow
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        tokenHandler.InboundClaimTypeMap.Clear();
        var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);

        if (securityToken is not JwtSecurityToken jwtSecurityToken ||
            !jwtSecurityToken.Header.Alg.Equals(
                SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
        {
            throw new SecurityTokenException("Invalid token algorithm.");
        }

        return principal;
    }
}
