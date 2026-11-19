using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Banners.DTOs;
using HotelSaas.Application.Banners.Queries.GetActiveBanners;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Banners.Queries.GetAllBanners;

public sealed record GetAllBannersQuery : IRequest<IReadOnlyList<SystemBannerDto>>;

public sealed class GetAllBannersQueryHandler
    : IRequestHandler<GetAllBannersQuery, IReadOnlyList<SystemBannerDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public GetAllBannersQueryHandler(
        IApplicationDbContext context,
        ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<IReadOnlyList<SystemBannerDto>> Handle(
        GetAllBannersQuery request,
        CancellationToken cancellationToken)
    {
        if (_currentUser.IsAuthenticated && _currentUser.GlobalRole != GlobalUserRole.SuperAdmin)
        {
            throw new ForbiddenException("ERR_FORBIDDEN", "Chỉ Quản trị viên Nền tảng (SuperAdmin) mới có quyền quản lý System Banner.");
        }

        var banners = await _context.SystemBanners
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return banners.Select(BannerMappingHelper.ToDto).ToList();
    }
}
