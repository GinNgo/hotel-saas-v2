using System;
using System.Threading;
using System.Threading.Tasks;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Production-grade implementation of <see cref="IGoogleAuthService"/> supporting Google Identity Services (GSI)
/// and Firebase Google Provider tokens with sandbox/mock mode for test automation.
/// </summary>
public sealed class GoogleAuthService : IGoogleAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<GoogleAuthService> _logger;

    public GoogleAuthService(IConfiguration configuration, ILogger<GoogleAuthService> logger)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<GoogleTokenVerificationResult> VerifyGoogleTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return new GoogleTokenVerificationResult(false, null, null, null, null, "Mã xác thực Google (IdToken) không được để trống.");
        }

        // ── 1. Dev / Mock Sandbox Token (For offline unit tests, load tests, or automated verification) ──
        if (idToken.StartsWith("dev-mock-google-token:", StringComparison.OrdinalIgnoreCase) ||
            idToken.Equals("dev-mock-google-token", StringComparison.OrdinalIgnoreCase))
        {
            string email = "alex.luxury@gmail.com";
            string fullName = "Alex Luxury Guest";

            if (idToken.Contains(':'))
            {
                var parts = idToken.Split(':', 3);
                if (parts.Length >= 2 && !string.IsNullOrWhiteSpace(parts[1]))
                {
                    email = parts[1].Trim().ToLowerInvariant();
                }
                if (parts.Length >= 3 && !string.IsNullOrWhiteSpace(parts[2]))
                {
                    fullName = parts[2].Trim();
                }
                else
                {
                    fullName = email.Split('@')[0];
                }
            }

            var mockSub = $"google-mock-{Math.Abs(email.GetHashCode())}";
            var mockAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";

            _logger.LogInformation("Sandbox Google OAuth accepted for mock user: {Email}", email);
            return new GoogleTokenVerificationResult(true, mockSub, email, fullName, mockAvatar);
        }

        // ── 2. Standard Google Identity Services (GSI) / OAuth2 Token Verification ──
        try
        {
            var googleClientId = _configuration["Authentication:Google:ClientId"]
                ?? _configuration["Google:ClientId"]
                ?? Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID");

            var settings = new GoogleJsonWebSignature.ValidationSettings();
            if (!string.IsNullOrWhiteSpace(googleClientId))
            {
                settings.Audience = new[] { googleClientId };
            }

            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
            if (payload != null && !string.IsNullOrWhiteSpace(payload.Subject) && !string.IsNullOrWhiteSpace(payload.Email))
            {
                _logger.LogInformation("Successfully verified Google ID Token for user: {Email} (Sub: {Sub})", payload.Email, payload.Subject);
                return new GoogleTokenVerificationResult(
                    true,
                    payload.Subject,
                    payload.Email,
                    payload.Name,
                    payload.Picture);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "GoogleJsonWebSignature validation failed: {Message}. Attempting Firebase Auth fallback.", ex.Message);
        }

        // ── 3. Graceful Fallback: Firebase ID Token with Google Provider ──
        try
        {
            if (FirebaseApp.DefaultInstance != null)
            {
                var auth = FirebaseAuth.DefaultInstance;
                var decodedToken = await auth.VerifyIdTokenAsync(idToken, cancellationToken);
                if (decodedToken != null)
                {
                    var email = decodedToken.Claims.TryGetValue("email", out var eObj) ? eObj?.ToString() : null;
                    var name = decodedToken.Claims.TryGetValue("name", out var nObj) ? nObj?.ToString() : null;
                    var picture = decodedToken.Claims.TryGetValue("picture", out var pObj) ? pObj?.ToString() : null;

                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        _logger.LogInformation("Successfully verified Firebase Google ID Token for: {Email}", email);
                        return new GoogleTokenVerificationResult(true, decodedToken.Uid, email, name, picture);
                    }
                }
            }
        }
        catch (Exception fEx)
        {
            _logger.LogWarning(fEx, "Firebase token verification fallback failed: {Message}", fEx.Message);
        }

        return new GoogleTokenVerificationResult(false, null, null, null, null, "Mã xác thực Google không hợp lệ hoặc đã hết hạn.");
    }
}
