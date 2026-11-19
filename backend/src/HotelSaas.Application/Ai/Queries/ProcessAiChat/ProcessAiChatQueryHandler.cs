using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Common;
using HotelSaas.Application.Ai.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using MediatR;

namespace HotelSaas.Application.Ai.Queries.ProcessAiChat;

public sealed class ProcessAiChatQueryHandler : IRequestHandler<ProcessAiChatQuery, AiChatResponse>
{
    private readonly ISender _mediator;
    private readonly ILocationLookupService _locationService;

    public ProcessAiChatQueryHandler(ISender mediator, ILocationLookupService locationService)
    {
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
    }

    public async Task<AiChatResponse> Handle(ProcessAiChatQuery request, CancellationToken cancellationToken)
    {
        var rawMessage = !string.IsNullOrWhiteSpace(request.Message)
            ? request.Message.Trim()
            : request.Messages?
                .LastOrDefault(m => string.Equals(m.Role, "user", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(m.Content))
                ?.Content?.Trim();

        if (string.IsNullOrWhiteSpace(rawMessage))
        {
            throw new BadRequestException("ERR_EMPTY_MESSAGE", "Nội dung câu hỏi không được để trống.");
        }

        var normQuery = VietnameseTextNormalizer.Normalize(rawMessage);
        var extracted = AiHelper.ExtractSmartSearchCriteria(_locationService, rawMessage, normQuery);

        var hasValidLocation = request.Location != null &&
                               double.IsFinite(request.Location.Latitude) &&
                               request.Location.Latitude >= -90.0 &&
                               request.Location.Latitude <= 90.0 &&
                               double.IsFinite(request.Location.Longitude) &&
                               request.Location.Longitude >= -180.0 &&
                               request.Location.Longitude <= 180.0;

        ReverseGeocodeResultDto? geoContext = hasValidLocation
            ? _locationService.ReverseGeocode(request.Location!.Latitude, request.Location.Longitude)
            : null;

        var hasStructuredPlace = !string.IsNullOrWhiteSpace(extracted.LandmarkSlug) ||
                                 !string.IsNullOrWhiteSpace(extracted.TouristZoneSlug) ||
                                 !string.IsNullOrWhiteSpace(extracted.ProvinceCode);

        var effectiveDestination = hasStructuredPlace
            ? extracted.DestinationKeyword
            : (hasValidLocation ? null : extracted.DestinationKeyword);

        var properties = await _mediator.Send(
            new GetPublicPropertiesQuery(
                Search: null,
                DestinationKeyword: effectiveDestination,
                PropertyTypes: extracted.PropertyTypes.Count > 0 ? extracted.PropertyTypes : null,
                RentalType: extracted.RentalType,
                TouristZoneSlug: string.IsNullOrWhiteSpace(extracted.LandmarkSlug) ? extracted.TouristZoneSlug : null,
                LandmarkSlug: extracted.LandmarkSlug,
                MaxDistanceKm: null,
                MaxDistanceMeters: extracted.MaxDistanceMeters ?? (hasValidLocation && !hasStructuredPlace ? 15000.0 : null),
                UserLatitude: hasValidLocation ? request.Location!.Latitude : null,
                UserLongitude: hasValidLocation ? request.Location!.Longitude : null,
                ProvinceCode: extracted.ProvinceCode),
            cancellationToken);

        if (properties.Count == 0 && !hasStructuredPlace && !string.IsNullOrWhiteSpace(effectiveDestination))
        {
            properties = await _mediator.Send(
                new GetPublicPropertiesQuery(
                    PropertyTypes: extracted.PropertyTypes.Count > 0 ? extracted.PropertyTypes : null,
                    RentalType: extracted.RentalType,
                    UserLatitude: hasValidLocation ? request.Location!.Latitude : null,
                    UserLongitude: hasValidLocation ? request.Location!.Longitude : null),
                cancellationToken);
        }

        if (extracted.MaxPrice.HasValue && extracted.MaxPrice.Value > 0)
        {
            var priceFiltered = properties
                .Where(p => !p.StartingPrice.HasValue || p.StartingPrice.Value <= extracted.MaxPrice.Value)
                .ToList();
            if (priceFiltered.Count > 0)
            {
                properties = priceFiltered;
            }
        }

        var topProperties = properties.Take(3).ToList();
        var groundingChunks = new List<AiChatGroundingChunk>();

        foreach (var prop in topProperties)
        {
            var mapUri = prop.Latitude.HasValue && prop.Longitude.HasValue
                ? $"https://www.google.com/maps/search/?api=1&query={prop.Latitude.Value.ToString(CultureInfo.InvariantCulture)},{prop.Longitude.Value.ToString(CultureInfo.InvariantCulture)}"
                : $"https://www.google.com/maps/search/?api=1&query={Uri.EscapeDataString($"{prop.Name}, {prop.Address}, {prop.City}")}";

            var title = string.IsNullOrWhiteSpace(prop.DistanceFormatted)
                ? prop.Name
                : $"{prop.Name} ({prop.DistanceFormatted})";

            groundingChunks.Add(new AiChatGroundingChunk
            {
                Maps = new AiChatMapsChunk
                {
                    Title = title,
                    Uri = mapUri
                }
            });
        }

        if (groundingChunks.Count == 0 && !string.IsNullOrWhiteSpace(extracted.LandmarkSlug))
        {
            var lm = _locationService.GetLandmarkBySlug(extracted.LandmarkSlug);
            if (lm != null)
            {
                groundingChunks.Add(new AiChatGroundingChunk
                {
                    Maps = new AiChatMapsChunk
                    {
                        Title = lm.Name,
                        Uri = $"https://www.google.com/maps/search/?api=1&query={lm.Latitude.ToString(CultureInfo.InvariantCulture)},{lm.Longitude.ToString(CultureInfo.InvariantCulture)}"
                    }
                });
            }
        }

        var text = BuildChatResponseText(rawMessage, geoContext, topProperties);
        return new AiChatResponse
        {
            Text = text,
            GroundingChunks = groundingChunks
        };
    }

    private static string BuildChatResponseText(
        string rawMessage,
        ReverseGeocodeResultDto? geoContext,
        IReadOnlyList<PublicPropertyDto> topProperties)
    {
        var sb = new StringBuilder();
        sb.Append("Dạ chào Quý khách! ");

        if (geoContext != null && !string.IsNullOrWhiteSpace(geoContext.DisplayLabel))
        {
            sb.Append($"Hệ thống ghi nhận vị trí của Quý khách tại {geoContext.DisplayLabel}. ");
        }

        if (topProperties.Count > 0)
        {
            sb.Append($"Dựa trên dữ liệu cơ sở đang mở bán cho \"{rawMessage}\", em gợi ý {topProperties.Count} lựa chọn phù hợp nhất:\n");
            for (var i = 0; i < topProperties.Count; i++)
            {
                var prop = topProperties[i];
                var area = prop.ProvinceName ?? prop.City;
                var distanceNote = !string.IsNullOrWhiteSpace(prop.DistanceFormatted) ? $" - {prop.DistanceFormatted}" : "";
                var dailyPrice = prop.OvernightStartingPrice ?? prop.DailyStartingPrice ?? prop.StartingPrice;
                var priceParts = new List<string>();
                if (dailyPrice.HasValue && dailyPrice.Value > 0)
                {
                    priceParts.Add($"từ {dailyPrice.Value:N0}đ/đêm");
                }
                if (prop.HourlyStartingPrice.HasValue && prop.HourlyStartingPrice.Value > 0)
                {
                    priceParts.Add($"từ {prop.HourlyStartingPrice.Value:N0}đ/giờ");
                }
                var priceNote = priceParts.Count > 0 ? $" ({string.Join(", ", priceParts)})" : "";
                sb.Append($"{i + 1}. {prop.Name} — {area}{distanceNote}{priceNote}.\n");
            }
        }
        else
        {
            sb.Append("Hiện tại chưa có cơ sở lưu trú đang hoạt động khớp hoàn toàn tiêu chí trên. Quý khách vui lòng mở rộng khu vực hoặc thay đổi bộ lọc ngày/giá nhé.\n");
        }

        // T025: Use matched top property's configured CheckInTime / CheckOutTime; fallback 14:00 / 12:00 only if unavailable
        var leadProp = topProperties.Count > 0 ? topProperties[0] : null;
        var hasConfiguredTimes = leadProp != null && (leadProp.CheckInTime != default || leadProp.CheckOutTime != default);
        var checkInStr = hasConfiguredTimes ? leadProp!.CheckInTime.ToString("HH:mm") : "14:00";
        var checkOutStr = hasConfiguredTimes ? leadProp!.CheckOutTime.ToString("HH:mm") : "12:00";

        sb.Append($"Chính sách nhận phòng tiêu chuẩn (Check-in) từ {checkInStr} và trả phòng (Check-out) trước {checkOutStr} hôm sau.");
        return sb.ToString();
    }
}
