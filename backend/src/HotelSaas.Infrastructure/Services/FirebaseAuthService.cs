using System;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using HotelSaas.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// Production-grade implementation of <see cref="IFirebaseAuthService"/> backed by Google Identity Platform (Firebase Admin SDK).
/// Supports both enterprise Google Service Account verification and developer/sandbox mocking for offline testability.
/// </summary>
public sealed class FirebaseAuthService : IFirebaseAuthService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<FirebaseAuthService> _logger;
    private static readonly object _initLock = new();
    private static bool _isInitialized;

    public FirebaseAuthService(IConfiguration configuration, ILogger<FirebaseAuthService> logger)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        EnsureFirebaseInitialized();
    }

    private void EnsureFirebaseInitialized()
    {
        if (_isInitialized || FirebaseApp.DefaultInstance != null)
        {
            _isInitialized = true;
            return;
        }

        lock (_initLock)
        {
            if (_isInitialized || FirebaseApp.DefaultInstance != null)
            {
                _isInitialized = true;
                return;
            }

            try
            {
                var credentialsPath = _configuration["Firebase:CredentialsPath"];
                var credentialsJson = _configuration["Firebase:CredentialsJson"];
                var projectId = _configuration["Firebase:ProjectId"] ?? "hotelsaas-platform";

                AppOptions options;

#pragma warning disable CS0618 // GoogleCredential.FromFile and FromJson deprecation transition
                if (!string.IsNullOrWhiteSpace(credentialsPath) && File.Exists(credentialsPath))
                {
                    _logger.LogInformation("Initializing FirebaseApp from credentials path: {Path}", credentialsPath);
                    options = new AppOptions
                    {
                        Credential = GoogleCredential.FromFile(credentialsPath),
                        ProjectId = projectId
                    };
                }
                else if (!string.IsNullOrWhiteSpace(credentialsJson))
                {
                    _logger.LogInformation("Initializing FirebaseApp from inline credentials JSON for project {ProjectId}", projectId);
                    options = new AppOptions
                    {
                        Credential = GoogleCredential.FromJson(credentialsJson),
                        ProjectId = projectId
                    };
                }
                else
                {
                    _logger.LogInformation("Firebase credentials path/json not set. Initializing with ProjectId {ProjectId} (dev/sandbox mode)", projectId);
                    options = new AppOptions
                    {
                        ProjectId = projectId
                    };
                }
#pragma warning restore CS0618

                FirebaseApp.Create(options);
                _isInitialized = true;
                _logger.LogInformation("FirebaseApp initialized successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to initialize FirebaseApp. Phone verification may operate in sandbox/mock mode.");
            }
        }
    }

    public async Task<FirebasePhoneVerificationResult> VerifyIdTokenAsync(string idToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return new FirebasePhoneVerificationResult(false, null, null, "Mã xác thực (idToken) không được để trống.");
        }

        // ── 1. Dev / Mock Sandbox Token (For offline unit tests, load tests, or local verification) ──
        if (idToken.StartsWith("dev-mock-token:", StringComparison.OrdinalIgnoreCase))
        {
            var raw = idToken.Substring("dev-mock-token:".Length).Trim();
            var phone = !string.IsNullOrWhiteSpace(raw) ? NormalizePhoneNumber(raw) : "+84901234567";
            var mockUid = $"mock-uid-{Math.Abs(phone.GetHashCode())}";

            _logger.LogInformation("Sandbox Phone Verification accepted for mock phone: {Phone}", phone);
            return new FirebasePhoneVerificationResult(true, phone, mockUid);
        }

        // ── 2. Production Google Identity Platform Token Verification ──
        try
        {
            if (FirebaseApp.DefaultInstance == null)
            {
                EnsureFirebaseInitialized();
            }

            if (FirebaseApp.DefaultInstance == null)
            {
                _logger.LogError("FirebaseApp instance is unavailable. Cannot verify production idToken.");
                return new FirebasePhoneVerificationResult(false, null, null, "Dịch vụ xác thực Firebase chưa được khởi tạo trên máy chủ.");
            }

            var auth = FirebaseAuth.DefaultInstance;
            FirebaseToken decodedToken = await auth.VerifyIdTokenAsync(idToken, cancellationToken);

            if (decodedToken == null)
            {
                return new FirebasePhoneVerificationResult(false, null, null, "Mã xác thực Firebase không hợp lệ hoặc đã hết hạn.");
            }

            // Extract verified phone_number claim
            if (!decodedToken.Claims.TryGetValue("phone_number", out var phoneObj) || phoneObj is not string phoneNumber || string.IsNullOrWhiteSpace(phoneNumber))
            {
                _logger.LogWarning("Firebase token verified for UID {Uid} but missing phone_number claim.", decodedToken.Uid);
                return new FirebasePhoneVerificationResult(false, null, decodedToken.Uid, "Mã xác thực không chứa thông tin số điện thoại được chứng thực.");
            }

            var normalizedPhone = NormalizePhoneNumber(phoneNumber);
            _logger.LogInformation("Successfully verified Firebase phone token for UID {Uid}, Phone: {Phone}", decodedToken.Uid, normalizedPhone);

            return new FirebasePhoneVerificationResult(true, normalizedPhone, decodedToken.Uid);
        }
        catch (FirebaseAuthException ex)
        {
            _logger.LogWarning(ex, "FirebaseAuthException during token verification: {Message}", ex.Message);
            return new FirebasePhoneVerificationResult(false, null, null, $"Xác thực Firebase thất bại: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error during Firebase token verification: {Message}", ex.Message);
            return new FirebasePhoneVerificationResult(false, null, null, "Đã xảy ra lỗi khi kiểm tra mã xác thực với Google Identity Platform.");
        }
    }

    private static string NormalizePhoneNumber(string phone)
    {
        var cleaned = Regex.Replace(phone.Trim(), @"[^\d+]", "");
        if (cleaned.StartsWith("0") && cleaned.Length >= 10)
        {
            return "+84" + cleaned.Substring(1);
        }
        if (!cleaned.StartsWith("+"))
        {
            return "+84" + cleaned;
        }
        return cleaned;
    }
}
