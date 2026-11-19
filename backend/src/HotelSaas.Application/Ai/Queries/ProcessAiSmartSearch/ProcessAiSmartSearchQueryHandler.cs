using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Common;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Services;
using HotelSaas.Domain.Enums;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.ProcessAiSmartSearch;

public sealed class ProcessAiSmartSearchQueryHandler : IRequestHandler<ProcessAiSmartSearchQuery, AiSmartSearchResponseDto>
{
    private readonly ISender _mediator;
    private readonly ILocationLookupService _locationService;

    public ProcessAiSmartSearchQueryHandler(ISender mediator, ILocationLookupService locationService)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
    }

    public async Task<AiSmartSearchResponseDto> Handle(ProcessAiSmartSearchQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
        {
            throw new BadRequestException("ERR_EMPTY_QUERY", "Truy vấn tìm kiếm không được để trống.");
        }

        var rawQuery = request.Query.Trim();
        var normQuery = VietnameseTextNormalizer.Normalize(rawQuery);

        var extracted = AiHelper.ExtractSmartSearchCriteria(_locationService, rawQuery, normQuery);

        var query = new GetPublicPropertiesQuery(
            Search: null,
            DestinationKeyword: extracted.DestinationKeyword,
            PropertyTypes: extracted.PropertyTypes.Count > 0 ? extracted.PropertyTypes : null,
            RentalType: extracted.RentalType,
            TouristZoneSlug: extracted.TouristZoneSlug,
            LandmarkSlug: extracted.LandmarkSlug,
            MaxDistanceKm: null,
            MaxDistanceMeters: extracted.MaxDistanceMeters,
            UserLatitude: request.UserLatitude,
            UserLongitude: request.UserLongitude);

        var properties = await _mediator.Send(query, cancellationToken);

        if (extracted.MaxPrice.HasValue && extracted.MaxPrice.Value > 0)
        {
            var filtered = properties
                .Where(p => !p.StartingPrice.HasValue || p.StartingPrice.Value <= extracted.MaxPrice.Value)
                .ToList();
            if (filtered.Count > 0)
            {
                properties = filtered;
            }
        }

        LandmarkDto? matchedLandmark = null;
        if (!string.IsNullOrWhiteSpace(extracted.LandmarkSlug))
        {
            matchedLandmark = _locationService.GetLandmarkBySlug(extracted.LandmarkSlug);
        }

        var chips = GeoProximityHelper.BuildSmartFilterChips(
            properties,
            queryKeyword: extracted.DestinationKeyword,
            targetLandmark: matchedLandmark,
            currentRentalType: extracted.RentalType);

        var summary = BuildSmartSearchSummary(extracted, properties.Count, matchedLandmark);

        return new AiSmartSearchResponseDto
        {
            Query = rawQuery,
            SummaryMessage = summary,
            ExtractedFilters = extracted,
            SuggestedFilterChips = chips,
            Properties = properties,
            TotalResults = properties.Count
        };
    }

    private static string BuildSmartSearchSummary(
        AiSmartExtractedFiltersDto criteria,
        int resultCount,
        LandmarkDto? matchedLandmark)
    {
        var dest = matchedLandmark != null
            ? $"khu vực gần {matchedLandmark.Name}"
            : (!string.IsNullOrWhiteSpace(criteria.DestinationKeyword) ? criteria.DestinationKeyword : "hệ thống");

        var modeStr = criteria.RentalType switch
        {
            RentalType.Hourly => "thuê theo giờ",
            RentalType.Overnight => "thuê qua đêm",
            RentalType.Daily => "thuê theo ngày",
            _ => "lưu trú linh hoạt"
        };

        var priceNote = criteria.MaxPrice.HasValue ? $" với mức giá ưu đãi (dưới {criteria.MaxPrice.Value:N0}đ)" : "";

        if (resultCount > 0)
        {
            return $"Dạ chào Quý khách! Em đã tìm thấy {resultCount} cơ sở lưu trú phù hợp tại {dest} ({modeStr}{priceNote}). " +
                   "Dưới đây là danh sách các phòng còn trống đã được hệ thống xác thực giá trực tiếp từ cơ sở, Quý khách có thể bấm vào các gợi ý bộ lọc bên dưới để thu hẹp kết quả nhé!";
        }

        return $"Dạ chào Quý khách! Hiện tại khu vực {dest} với tiêu chí {modeStr}{priceNote} đang có ít cơ sở mở bán trực tuyến. " +
               "Em đã mở rộng bán kính tìm kiếm sang các cơ sở lân cận trong cùng khu vực để Quý khách tiện tham khảo thêm ạ!";
    }
}
