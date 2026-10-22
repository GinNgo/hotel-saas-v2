using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Guest.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Guest.Commands.UpdateGuestProfile;

public sealed class UpdateGuestProfileCommandHandler : IRequestHandler<UpdateGuestProfileCommand, GuestMeDto>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public UpdateGuestProfileCommandHandler(IApplicationDbContext context, ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<GuestMeDto> Handle(UpdateGuestProfileCommand request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản khách.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        user.FullName = request.FullName.Trim();
        user.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return new GuestMeDto(
            user.Id,
            user.FullName,
            user.Email,
            user.PhoneNumber,
            user.EmailVerifiedAtUtc.HasValue,
            new GuestCapabilitiesDto(CanEditName: true, CanViewBookings: true)
        );
    }
}
