using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Banners.Commands.DeleteBanner;

public sealed record DeleteBannerCommand(Guid Id) : IRequest<Unit>;

public sealed class DeleteBannerCommandValidator : AbstractValidator<DeleteBannerCommand>
{
    public DeleteBannerCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Mã banner là bắt buộc.");
    }
}

public sealed class DeleteBannerCommandHandler : IRequestHandler<DeleteBannerCommand, Unit>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public DeleteBannerCommandHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<Unit> Handle(DeleteBannerCommand request, CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền xóa System Banner.");
        }

        var banner = await _context.SystemBanners
            .FirstOrDefaultAsync(b => b.Id == request.Id, cancellationToken);

        if (banner == null)
        {
            throw new NotFoundException(nameof(SystemBanner), request.Id);
        }

        _context.SystemBanners.Remove(banner);
        await _context.SaveChangesAsync(cancellationToken);

        return Unit.Value;
    }
}
