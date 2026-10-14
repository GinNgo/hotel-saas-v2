using System;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Quotes.DTOs;
using HotelSaas.Application.Quotes.Services;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Public.Queries.CalculatePublicQuote;

public sealed record CalculatePublicQuoteQuery(
    string PropertySlug,
    Guid RoomTypeId,
    RentalType RentalType,
    DateTime StartAtUtc,
    DateTime EndAtUtc,
    DateOnly? CheckInDate = null,
    DateOnly? CheckOutDate = null
) : IRequest<QuoteDto>;

public sealed class CalculatePublicQuoteQueryHandler : IRequestHandler<CalculatePublicQuoteQuery, QuoteDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IPricingCalculator _pricingCalculator;

    public CalculatePublicQuoteQueryHandler(
        IApplicationDbContext context,
        IPricingCalculator pricingCalculator)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _pricingCalculator = pricingCalculator ?? throw new ArgumentNullException(nameof(pricingCalculator));
    }

    public async Task<QuoteDto> Handle(CalculatePublicQuoteQuery request, CancellationToken cancellationToken)
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

        var roomType = await _context.RoomTypes
            .IgnoreQueryFilters()
            .AsNoTracking()
            .FirstOrDefaultAsync(rt => rt.Id == request.RoomTypeId && rt.PropertyId == property.Id, cancellationToken);

        if (roomType == null)
        {
            throw new NotFoundException("Loại phòng không tồn tại trong cơ sở này.");
        }

        return await _pricingCalculator.CalculateAsync(
            property,
            roomType,
            request.RentalType,
            request.StartAtUtc,
            request.EndAtUtc,
            request.CheckInDate,
            request.CheckOutDate,
            cancellationToken);
    }
}
