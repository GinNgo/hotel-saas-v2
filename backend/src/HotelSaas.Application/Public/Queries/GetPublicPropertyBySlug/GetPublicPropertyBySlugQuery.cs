using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.GetPublicPropertyBySlug;

public sealed record GetPublicPropertyBySlugQuery(string Slug) : IRequest<PublicPropertyDto>;

public sealed class GetPublicPropertyBySlugQueryHandler : IRequestHandler<GetPublicPropertyBySlugQuery, PublicPropertyDto>
{
    private readonly IApplicationDbContext _context;

    public GetPublicPropertyBySlugQueryHandler(IApplicationDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<PublicPropertyDto> Handle(GetPublicPropertyBySlugQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Slug))
        {
            throw new BadRequestException("ERR_INVALID_SLUG", "Mã đường dẫn cơ sở không hợp lệ.");
        }

        var normalizedSlug = request.Slug.Trim().ToLowerInvariant();

        var property = await _context.Properties
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active && (p.Slug.ToLower() == normalizedSlug || p.Id.ToString() == normalizedSlug))
            .Select(p => new PublicPropertyDto
            {
                Id = p.Id,
                Name = p.Name,
                Code = p.Code,
                Slug = p.Slug,
                Address = p.Address,
                City = p.City,
                CheckInTime = p.CheckInTime,
                CheckOutTime = p.CheckOutTime,
                BufferMinutes = p.BufferMinutes,
                MaxHourlyHours = p.MaxHourlyHours,
                ImageUrl = null
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (property == null)
        {
            throw new NotFoundException("Không tìm thấy cơ sở lưu trú.");
        }

        return property;
    }
}
