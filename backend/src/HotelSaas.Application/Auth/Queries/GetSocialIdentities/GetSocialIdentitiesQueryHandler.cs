using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Queries.GetSocialIdentities;

/// <summary>
/// Returns the authenticated user's linked external social identities and password capability.
/// </summary>
public sealed class GetSocialIdentitiesQueryHandler
    : IRequestHandler<GetSocialIdentitiesQuery, ApiResponse<SocialAccountsResponseDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;

    public GetSocialIdentitiesQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext)
    {
        _context = context;
        _currentUserContext = currentUserContext;
    }

    public async Task<ApiResponse<SocialAccountsResponseDto>> Handle(
        GetSocialIdentitiesQuery request,
        CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập để xem liên kết tài khoản mạng xã hội.");
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == _currentUserContext.UserId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
        }

        var accounts = await _context.SocialIdentities
            .AsNoTracking()
            .Where(s => s.UserId == user.Id)
            .OrderBy(s => s.Provider)
            .Select(s => new SocialIdentityDto(
                s.Id,
                s.Provider,
                s.ProviderEmail,
                s.AvatarUrl,
                s.LastLoginAtUtc,
                s.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        var hasPassword = !string.IsNullOrEmpty(user.PasswordHash);
        return ApiResponse.Ok(new SocialAccountsResponseDto(hasPassword, accounts));
    }
}
