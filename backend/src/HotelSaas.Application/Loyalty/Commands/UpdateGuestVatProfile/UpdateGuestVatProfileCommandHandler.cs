using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Loyalty.Commands.UpdateGuestVatProfile;

public sealed class UpdateGuestVatProfileCommandHandler : IRequestHandler<UpdateGuestVatProfileCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _userContext;

    public UpdateGuestVatProfileCommandHandler(
        IApplicationDbContext context,
        ICurrentUserContext userContext)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
    }

    public async Task<bool> Handle(UpdateGuestVatProfileCommand request, CancellationToken cancellationToken)
    {
        var userId = _userContext.UserId;
        if (userId == Guid.Empty)
        {
            throw new UnauthorizedAccessException("Yêu cầu đăng nhập tài khoản.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException("Tài khoản người dùng không tồn tại.");
        }

        user.CompanyName = request.CompanyName?.Trim();
        user.CompanyTaxCode = request.CompanyTaxCode?.Trim();
        user.CompanyAddress = request.CompanyAddress?.Trim();
        user.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
