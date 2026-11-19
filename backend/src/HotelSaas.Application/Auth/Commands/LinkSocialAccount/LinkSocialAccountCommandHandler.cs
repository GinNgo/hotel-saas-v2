using HotelSaas.Application.Auth.Queries.GetSocialIdentities;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using HotelSaas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.LinkSocialAccount;

/// <summary>
/// Links a verified Google social identity to the current authenticated user without overwriting existing accounts.
/// </summary>
public sealed class LinkSocialAccountCommandHandler
    : IRequestHandler<LinkSocialAccountCommand, ApiResponse<SocialIdentityDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IGoogleAuthService? _googleAuthService;

    public LinkSocialAccountCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext,
        IGoogleAuthService? googleAuthService = null)
    {
        _context = context;
        _currentUserContext = currentUserContext;
        _googleAuthService = googleAuthService;
    }

    public async Task<ApiResponse<SocialIdentityDto>> Handle(
        LinkSocialAccountCommand request,
        CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập để liên kết tài khoản mạng xã hội.");
        }

        var provider = string.Equals(request.Provider?.Trim(), "Google", StringComparison.OrdinalIgnoreCase)
            ? "Google"
            : throw new BadRequestException("ERR_UNSUPPORTED_PROVIDER", "Hiện tại hệ thống chỉ hỗ trợ liên kết tài khoản Google.");

        if (_googleAuthService is null)
        {
            throw new BadRequestException("ERR_GOOGLE_AUTH_UNAVAILABLE", "Dịch vụ xác thực Google hiện chưa sẵn sàng.");
        }

        var verification = await _googleAuthService.VerifyGoogleTokenAsync(request.IdToken, cancellationToken);
        if (!verification.IsValid ||
            string.IsNullOrWhiteSpace(verification.Subject) ||
            string.IsNullOrWhiteSpace(verification.Email))
        {
            throw new BadRequestException(
                "ERR_INVALID_GOOGLE_TOKEN",
                verification.ErrorMessage ?? "Mã xác thực Google không hợp lệ hoặc đã hết hạn.");
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.Id == _currentUserContext.UserId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
        }

        var subject = verification.Subject.Trim();
        var providerEmail = verification.Email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;

        var existingSubjectLink = await _context.SocialIdentities
            .FirstOrDefaultAsync(s => s.Provider == provider && s.ProviderSubject == subject, cancellationToken);

        if (existingSubjectLink != null)
        {
            if (existingSubjectLink.UserId != user.Id)
            {
                throw new ConflictException(
                    "ERR_SOCIAL_ACCOUNT_IN_USE",
                    "Tài khoản Google này đã được liên kết với một tài khoản khác.");
            }

            existingSubjectLink.ProviderEmail = providerEmail;
            existingSubjectLink.AvatarUrl = verification.AvatarUrl;
            existingSubjectLink.LastLoginAtUtc = now;
            existingSubjectLink.UpdatedAtUtc = now;
            await _context.SaveChangesAsync(cancellationToken);

            return ApiResponse.Ok(
                new SocialIdentityDto(
                    existingSubjectLink.Id,
                    existingSubjectLink.Provider,
                    existingSubjectLink.ProviderEmail,
                    existingSubjectLink.AvatarUrl,
                    existingSubjectLink.LastLoginAtUtc,
                    existingSubjectLink.CreatedAtUtc),
                "Tài khoản Google đã được liên kết.");
        }

        var existingProviderForUser = await _context.SocialIdentities
            .FirstOrDefaultAsync(s => s.UserId == user.Id && s.Provider == provider, cancellationToken);

        if (existingProviderForUser != null)
        {
            throw new ConflictException(
                "ERR_PROVIDER_ALREADY_LINKED",
                "Tài khoản của bạn đã liên kết với một tài khoản Google khác. Vui lòng hủy liên kết cũ trước.");
        }

        var identity = new SocialIdentity
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Provider = provider,
            ProviderSubject = subject,
            ProviderEmail = providerEmail,
            AvatarUrl = verification.AvatarUrl,
            LastLoginAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now
        };

        if (string.Equals(user.Email, providerEmail, StringComparison.OrdinalIgnoreCase))
        {
            user.EmailVerifiedAtUtc ??= now;
        }
        if (!string.IsNullOrWhiteSpace(verification.AvatarUrl) && string.IsNullOrWhiteSpace(user.AvatarUrl))
        {
            user.AvatarUrl = verification.AvatarUrl;
        }
        user.UpdatedAtUtc = now;

        _context.SocialIdentities.Add(identity);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse.Ok(
            new SocialIdentityDto(
                identity.Id,
                identity.Provider,
                identity.ProviderEmail,
                identity.AvatarUrl,
                identity.LastLoginAtUtc,
                identity.CreatedAtUtc),
            "Liên kết tài khoản Google thành công.");
    }
}
