using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.UnlinkSocialAccount;

/// <summary>
/// Removes a social identity link after ensuring the user still retains at least one valid login method.
/// </summary>
public sealed class UnlinkSocialAccountCommandHandler : IRequestHandler<UnlinkSocialAccountCommand, ApiResponse<object?>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUserContext;

    public UnlinkSocialAccountCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUserContext)
    {
        _context = context;
        _currentUserContext = currentUserContext;
    }

    public async Task<ApiResponse<object?>> Handle(UnlinkSocialAccountCommand request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập để hủy liên kết tài khoản mạng xã hội.");
        }

        var user = await _context.Users
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == _currentUserContext.UserId, cancellationToken);

        if (user is null || !user.IsActive)
        {
            throw new UnauthorizedAccessException("Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.");
        }

        var userIdentities = await _context.SocialIdentities
            .Where(s => s.UserId == user.Id)
            .ToListAsync(cancellationToken);

        var targetProvider = request.Provider.Trim();
        var targetIdentity = userIdentities.FirstOrDefault(s =>
            string.Equals(s.Provider, targetProvider, StringComparison.OrdinalIgnoreCase));

        if (targetIdentity is null)
        {
            throw new NotFoundException($"Không tìm thấy liên kết với nhà cung cấp {targetProvider}.");
        }

        var hasLocalPassword = !string.IsNullOrEmpty(user.PasswordHash);
        if (!hasLocalPassword && userIdentities.Count <= 1)
        {
            throw new BadRequestException(
                "ERR_CANNOT_UNLINK_LAST_LOGIN",
                "Không thể hủy liên kết phương thức đăng nhập duy nhất khi tài khoản chưa thiết lập mật khẩu.");
        }

        _context.SocialIdentities.Remove(targetIdentity);
        await _context.SaveChangesAsync(cancellationToken);

        return ApiResponse.Ok($"Đã hủy liên kết tài khoản {targetIdentity.Provider}.");
    }
}
