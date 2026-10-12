using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicRoomTypes;

public sealed record GetPublicRoomTypesQuery(string PropertySlug) : IRequest<IReadOnlyList<PublicRoomTypeDto>>;

public sealed class GetPublicRoomTypesQueryHandler : IRequestHandler<GetPublicRoomTypesQuery, IReadOnlyList<PublicRoomTypeDto>>
{
    private readonly IApplicationDbContext _context;

    public GetPublicRoomTypesQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<IReadOnlyList<PublicRoomTypeDto>> Handle(GetPublicRoomTypesQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PropertySlug))
        {
            throw new BadRequestException("ERR_INVALID_SLUG", "Mã đường dẫn cơ sở không hợp lệ.");
        }

        var normalizedSlug = request.PropertySlug.Trim().ToLowerInvariant();

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Status == PropertyStatus.Active &&
                                     (p.Slug.ToLower() == normalizedSlug || p.Id.ToString() == normalizedSlug),
                                 cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
        }

        var roomTypes = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(rt => rt.PropertyId == property.Id)
            .OrderBy(rt => rt.BasePrice)
            .Select(rt => new PublicRoomTypeDto
            {
                Id = rt.Id,
                PropertyId = rt.PropertyId,
                Name = rt.Name,
                Code = rt.Code,
                Description = rt.Description,
                BasePrice = rt.BasePrice,
                MaxOccupancy = rt.MaxOccupancy,
                BedType = rt.BedType,
                SquareMeters = rt.SquareMeters,
                ImageUrl = rt.ImageUrl
            })
            .ToListAsync(cancellationToken);

        return roomTypes;
    }
}
