using HotelSaas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Auth.Commands.RevokeToken;

/// <summary>
/// Handles refresh token revocation for user logout.
/// </summary>
public sealed class RevokeTokenCommandHandler : IRequestHandler<RevokeTokenCommand, bool>
{
    private readonly IApplicationDbContext _context;

    /// <summary>
    /// Initializes a new instance of <see cref="RevokeTokenCommandHandler"/>.
    /// </summary>
    public RevokeTokenCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<bool> Handle(RevokeTokenCommand request, CancellationToken cancellationToken)
    {
        var token = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt =>
                rt.Token == request.RefreshToken &&
                rt.RevokedAtUtc == null,
                cancellationToken);

        if (token is null)
            return false;

        token.RevokedAtUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
