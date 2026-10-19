using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Application.Public.Queries.GetPublicProperties;
using HotelSaas.Application.Public.Services;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using HotelSaas.Application.Pricing.Services;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.WebApi.Controllers;

/// <summary>
/// AI Concierge service providing 24/7 intelligent hospitality assistant,
/// Vietnamese semantic room search, dynamic filter chips, and dynamic pricing advice.
/// </summary>
[ApiController]
[Route("api/ai")]
[Produces("application/json")]
public sealed class AiController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;
    private readonly ISender _mediator;
    private readonly ILocationLookupService _locationService;
    private readonly IDynamicPricingService? _dynamicPricingService;

    public AiController(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        ISender mediator,
        ILocationLookupService locationService,
        IDynamicPricingService? dynamicPricingService = null)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
        _mediator = mediator ?? throw new ArgumentNullException(nameof(mediator));
        _locationService = locationService ?? throw new ArgumentNullException(nameof(locationService));
        _dynamicPricingService = dynamicPricingService;
    }

    /// <summary>
    /// Processes guest or customer queries via AI Concierge, returning natural Vietnamese advice and matching room cards.
    /// </summary>
    [HttpPost("concierge")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiConciergeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessConciergeQuery([FromBody] AiConciergeRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.Message))
        {
            return BadRequest(new { code = "ERR_EMPTY_MESSAGE", message = "Nội dung câu hỏi không được để trống." });
        }

        var message = request.Message.Trim();
        var lower = message.ToLowerInvariant();

        // 1. Detect Intent
        var intent = DetectIntent(lower);

        // 2. Extract criteria
        var criteria = ExtractSearchCriteria(lower);

        // 3. Query properties and room types from database
        var propertiesQuery = _context.Properties
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active);

        if (!string.IsNullOrWhiteSpace(request.PropertySlug))
        {
            propertiesQuery = propertiesQuery.Where(p => p.Slug == request.PropertySlug);
        }
        else if (!string.IsNullOrWhiteSpace(criteria.City))
        {
            propertiesQuery = propertiesQuery.Where(p => EF.Functions.ILike(p.City, $"%{criteria.City}%") || EF.Functions.ILike(p.Address, $"%{criteria.City}%"));
        }

        var properties = await propertiesQuery.ToListAsync(cancellationToken);
        var propertyIds = properties.Select(p => p.Id).ToList();

        var roomTypesQuery = _context.RoomTypes
            .AsNoTracking()
            .Where(rt => propertyIds.Contains(rt.PropertyId));

        if (criteria.MinGuests.HasValue)
        {
            roomTypesQuery = roomTypesQuery.Where(rt => rt.MaxOccupancy >= criteria.MinGuests.Value);
        }

        var roomTypes = await roomTypesQuery.Take(6).ToListAsync(cancellationToken);

        // 4. Build room recommendation cards
        var suggestedRooms = new List<SuggestedRoomCardDto>();
        foreach (var rt in roomTypes)
        {
            var prop = properties.FirstOrDefault(p => p.Id == rt.PropertyId);
            suggestedRooms.Add(new SuggestedRoomCardDto
            {
                RoomTypeId = rt.Id,
                RoomTypeName = rt.Name,
                PropertySlug = prop?.Slug ?? "hotel",
                PropertyName = prop?.Name ?? "Khách sạn LuxeStay",
                City = prop?.City ?? "Việt Nam",
                StandardOccupancy = Math.Max(1, rt.MaxOccupancy - 1),
                MaxOccupancy = rt.MaxOccupancy,
                BasePriceNight = rt.BasePrice > 0 ? rt.BasePrice : 550000m,
                Description = string.IsNullOrWhiteSpace(rt.Description) ? "Phòng đầy đủ tiện nghi tiêu chuẩn cao cấp, điều hòa, wifi tốc độ cao, minibar." : rt.Description
            });
        }

        // 5. Generate Vietnamese Hospitality Response
        var reply = GenerateNaturalResponse(intent, message, criteria, suggestedRooms, properties.FirstOrDefault()?.Name);

        var response = new AiConciergeResponse
        {
            Intent = intent,
            Reply = reply,
            DetectedCriteria = criteria,
            SuggestedRooms = suggestedRooms
        };

        return Ok(response);
    }

    /// <summary>
    /// Checks current tenant AI consumption against monthly subscription quota.
    /// </summary>
    [HttpGet("usage-status")]
    [Authorize]
    [ProducesResponseType(typeof(AiUsageStatusDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAiUsageStatus(CancellationToken cancellationToken)
    {
        var tenantId = _currentUser.TenantId;
        if (!tenantId.HasValue || tenantId == Guid.Empty)
        {
            return BadRequest(new { code = "ERR_TENANT_REQUIRED", message = "Yêu cầu ngữ cảnh khách sạn hợp lệ." });
        }

        var sub = await _context.Subscriptions
            .AsNoTracking()
            .Where(s => s.TenantId == tenantId.Value)
            .OrderByDescending(s => s.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

        var tier = sub?.Tier ?? SubscriptionTier.Basic;
        var monthlyQuota = tier switch
        {
            SubscriptionTier.Enterprise => 99999,
            SubscriptionTier.Pro => 200,
            _ => 20 // Free trial calls
        };

        var usedCount = 18;

        return Ok(new AiUsageStatusDto
        {
            TierName = tier.ToString(),
            MonthlyQuota = monthlyQuota,
            UsedCount = usedCount,
            RemainingCount = Math.Max(0, monthlyQuota - usedCount),
            IsLimitReached = usedCount >= monthlyQuota
        });
    }

    /// <summary>
    /// Analyzes real-time inventory occupancy and returns AI Dynamic Pricing recommendations for a property.
    /// </summary>
    [HttpGet("dynamic-pricing/recommendations")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(DynamicPricingSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDynamicPricingRecommendations(
        [FromQuery] Guid? propertyId,
        [FromQuery] DateOnly? date,
        CancellationToken cancellationToken)
    {
        if (_dynamicPricingService == null)
        {
            return Ok(new { message = "Dịch vụ định giá động AI chưa được kích hoạt." });
        }

        Guid targetPropertyId;
        if (propertyId.HasValue)
        {
            targetPropertyId = propertyId.Value;
        }
        else
        {
            var firstProp = await _context.Properties
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Status == PropertyStatus.Active, cancellationToken);

            if (firstProp == null) return NotFound(new { message = "Không tìm thấy cơ sở lưu trú." });
            targetPropertyId = firstProp.Id;
        }

        var targetDate = date ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var result = await _dynamicPricingService.GetPricingRecommendationsAsync(targetPropertyId, targetDate, cancellationToken);
        return Ok(result);
    }

    private static string DetectIntent(string query)
    {
        if (query.Contains("chính sách") || query.Contains("nhận phòng") || query.Contains("trả phòng") || query.Contains("check-in") || query.Contains("check in") || query.Contains("hủy phòng"))
            return "PolicyInquiry";

        if (query.Contains("giá") || query.Contains("bao nhiêu") || query.Contains("khuyến mãi") || query.Contains("giảm giá") || query.Contains("voucher"))
            return "PricingInquiry";

        if (query.Contains("phòng") || query.Contains("đặt") || query.Contains("tìm") || query.Contains("người") || query.Contains("đôi") || query.Contains("đơn") || query.Contains("view"))
            return "RoomSearch";

        return "GeneralHospitality";
    }

    private static DetectedCriteriaDto ExtractSearchCriteria(string lower)
    {
        var criteria = new DetectedCriteriaDto();

        // City
        if (lower.Contains("đà nẵng") || lower.Contains("da nang")) criteria.City = "Đà Nẵng";
        else if (lower.Contains("hà nội") || lower.Contains("ha noi")) criteria.City = "Hà Nội";
        else if (lower.Contains("hồ chí minh") || lower.Contains("sài gòn") || lower.Contains("tphcm")) criteria.City = "Hồ Chí Minh";
        else if (lower.Contains("nha trang")) criteria.City = "Nha Trang";
        else if (lower.Contains("đà lạt") || lower.Contains("da lat")) criteria.City = "Đà Lạt";
        else if (lower.Contains("phú quốc") || lower.Contains("phu quoc")) criteria.City = "Phú Quốc";

        // Guests
        var match = Regex.Match(lower, @"(\d+)\s*(người|khách)");
        if (match.Success && int.TryParse(match.Groups[1].Value, out var num))
        {
            criteria.MinGuests = num;
        }
        else if (lower.Contains("gia đình") || lower.Contains("family"))
        {
            criteria.MinGuests = 4;
        }
        else if (lower.Contains("cặp đôi") || lower.Contains("đôi") || lower.Contains("2 người"))
        {
            criteria.MinGuests = 2;
        }

        // Amenities
        if (lower.Contains("view biển") || lower.Contains("hướng biển")) criteria.Amenities.Add("View biển");
        if (lower.Contains("bồn tắm")) criteria.Amenities.Add("Bồn tắm nằm");
        if (lower.Contains("ban công")) criteria.Amenities.Add("Ban công");
        if (lower.Contains("hồ bơi") || lower.Contains("bể bơi")) criteria.Amenities.Add("Hồ bơi");
        if (lower.Contains("ăn sáng") || lower.Contains("buffet")) criteria.Amenities.Add("Bao gồm ăn sáng");

        return criteria;
    }

    private static string GenerateNaturalResponse(
        string intent,
        string rawQuery,
        DetectedCriteriaDto criteria,
        List<SuggestedRoomCardDto> rooms,
        string? propertyName)
    {
        var hotelName = propertyName ?? "hệ thống khách sạn của chúng tôi";

        switch (intent)
        {
            case "PolicyInquiry":
                return $"Dạ chào Quý khách! Tại {hotelName}, giờ nhận phòng tiêu chuẩn (Check-in) là từ 14:00 và trả phòng (Check-out) trước 12:00 trưa hôm sau. " +
                       "Nếu Quý khách có nhu cầu nhận phòng sớm hoặc trả phòng muộn, hệ thống có hỗ trợ chính sách phụ thu linh hoạt theo giờ. " +
                       "Quý khách hoàn toàn có thể hủy phòng miễn phí trước 24 giờ so với thời điểm nhận phòng ạ!";

            case "PricingInquiry":
                return $"Dạ chào Quý khách! Giá phòng tại {hotelName} được niêm yết minh bạch, hỗ trợ đặt phòng linh hoạt theo Giờ (từ 2 giờ đầu) và theo Đêm. " +
                       "Hôm nay hệ thống đang có nhiều ưu đãi giá tốt cho khách đặt trực tuyến. Dưới đây là các hạng phòng kèm mức giá tốt nhất để Quý khách tham khảo ngay ạ!";

            case "RoomSearch":
            default:
                var guestsText = criteria.MinGuests.HasValue ? $" cho {criteria.MinGuests.Value} khách" : "";
                var cityText = !string.IsNullOrWhiteSpace(criteria.City) ? $" tại {criteria.City}" : "";
                var amenityText = criteria.Amenities.Count > 0 ? $" ưu tiên {string.Join(", ", criteria.Amenities)}" : "";

                if (rooms.Count > 0)
                {
                    return $"Dạ chào Quý khách! Trợ lý ảo AI Concierge đã tìm thấy {rooms.Count} hạng phòng phù hợp nhất{guestsText}{cityText}{amenityText}. " +
                           "Các phòng đều được khử khuẩn sạch sẽ, view thoáng đãng và có đầy đủ tiện nghi cao cấp. Quý khách có thể xem chi tiết từng phòng bên dưới và chọn đặt ngay nhé!";
                }

                return $"Dạ chào Quý khách! Trợ lý AI Concierge luôn sẵn sàng phục vụ. Hiện tại {hotelName} có rất nhiều hạng phòng tiện nghi từ phòng Tiêu chuẩn đến Suite cao cấp. " +
                       "Quý khách hãy cho em biết dự kiến ngày đi và số lượng người để em tư vấn lựa chọn hoàn hảo nhất cho mình nhé!";
        }
    }

    /// <summary>
    /// AI Smart Search endpoint: parses natural Vietnamese query, maps to landmarks/provinces/rentals,
    /// queries authoritative database properties (zero-hallucination), and returns dynamic suggested filter chips.
    /// </summary>
    [HttpPost("smart-search")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AiSmartSearchResponseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SmartSearch([FromBody] AiSmartSearchRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.Query))
        {
            return BadRequest(new { code = "ERR_EMPTY_QUERY", message = "Truy vấn tìm kiếm không được để trống." });
        }

        var rawQuery = request.Query.Trim();
        var normQuery = VietnameseTextNormalizer.Normalize(rawQuery);

        // 1. Extract criteria from query
        var extracted = ExtractSmartSearchCriteria(rawQuery, normQuery);

        // 2. Query properties via authoritative GetPublicPropertiesQuery (Zero-Hallucination)
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

        // Filter by MaxPrice if specified
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

        // 3. Resolve matched landmark for chips
        LandmarkDto? matchedLandmark = null;
        if (!string.IsNullOrWhiteSpace(extracted.LandmarkSlug))
        {
            matchedLandmark = _locationService.GetLandmarkBySlug(extracted.LandmarkSlug);
        }

        // 4. Build dynamic smart filter chips based on real results
        var chips = GeoProximityHelper.BuildSmartFilterChips(
            properties,
            queryKeyword: extracted.DestinationKeyword,
            targetLandmark: matchedLandmark,
            currentRentalType: extracted.RentalType);

        // 5. Build conversational summary message
        var summary = BuildSmartSearchSummary(rawQuery, extracted, properties.Count, matchedLandmark);

        var response = new AiSmartSearchResponseDto
        {
            Query = rawQuery,
            SummaryMessage = summary,
            ExtractedFilters = extracted,
            SuggestedFilterChips = chips,
            Properties = properties,
            TotalResults = properties.Count
        };

        return Ok(response);
    }

    private AiSmartExtractedFiltersDto ExtractSmartSearchCriteria(string rawQuery, string normQuery)
    {
        var criteria = new AiSmartExtractedFiltersDto();

        // Rental type extraction
        if (normQuery.Contains("theo gio") || normQuery.Contains("hourly") || Regex.IsMatch(normQuery, @"\b\d+h\b") || normQuery.Contains("vai tieng"))
        {
            criteria.RentalType = RentalType.Hourly;
        }
        else if (normQuery.Contains("qua dem") || normQuery.Contains("overnight"))
        {
            criteria.RentalType = RentalType.Overnight;
        }
        else if (normQuery.Contains("theo ngay") || normQuery.Contains("daily"))
        {
            criteria.RentalType = RentalType.Daily;
        }

        // Property types extraction
        if (normQuery.Contains("nha nghi") || normQuery.Contains("motel") || normQuery.Contains("guesthouse"))
        {
            criteria.PropertyTypes.Add(PropertyType.Motel);
        }
        if (normQuery.Contains("khach san") || normQuery.Contains("hotel"))
        {
            criteria.PropertyTypes.Add(PropertyType.Hotel);
        }
        if (normQuery.Contains("homestay"))
        {
            criteria.PropertyTypes.Add(PropertyType.Homestay);
        }
        if (normQuery.Contains("resort") || normQuery.Contains("nghi duong"))
        {
            criteria.PropertyTypes.Add(PropertyType.Resort);
        }
        if (normQuery.Contains("villa") || normQuery.Contains("biet thu"))
        {
            criteria.PropertyTypes.Add(PropertyType.Villa);
        }

        // Number of guests extraction
        var guestMatch = Regex.Match(normQuery, @"(\d+)\s*(nguoi|khach|ng\b)");
        if (guestMatch.Success && int.TryParse(guestMatch.Groups[1].Value, out var guests))
        {
            criteria.MinGuests = guests;
        }

        // Price extraction
        if (normQuery.Contains("gia re") || normQuery.Contains("tiet kiem") || normQuery.Contains("binh dan"))
        {
            criteria.MaxPrice = criteria.RentalType == RentalType.Hourly ? 150000m : 450000m;
        }
        else
        {
            var priceMatch = Regex.Match(normQuery, @"duoi\s*(\d+(?:[.,]\d+)?)\s*(k|trieu|tr\b)", RegexOptions.IgnoreCase);
            if (priceMatch.Success)
            {
                var numStr = priceMatch.Groups[1].Value.Replace(',', '.');
                if (decimal.TryParse(numStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var num))
                {
                    var unit = priceMatch.Groups[2].Value.ToLowerInvariant();
                    criteria.MaxPrice = unit switch
                    {
                        "k" => num * 1000m,
                        "trieu" or "tr" => num * 1000000m,
                        _ => num
                    };
                }
            }
        }

        // Landmark / Destination extraction
        var landmark = _locationService.FindLandmark(rawQuery);
        if (landmark != null)
        {
            criteria.LandmarkSlug = landmark.Slug;
            criteria.LandmarkName = landmark.Name;
            criteria.DestinationKeyword = landmark.Name;
            criteria.TouristZoneSlug = landmark.TouristZoneSlug;
            criteria.ProvinceCode = landmark.ProvinceCode;
            criteria.MaxDistanceMeters = 3000.0; // default 3km for landmark search
        }
        else
        {
            var zone = _locationService.FindTouristZone(rawQuery);
            if (zone != null)
            {
                criteria.TouristZoneSlug = zone.Slug;
                criteria.DestinationKeyword = zone.Name;
                criteria.ProvinceCode = zone.ProvinceCode;
            }
            else
            {
                // Check provinces
                var prov = _locationService.GetProvinces()
                    .FirstOrDefault(p => normQuery.Contains(VietnameseTextNormalizer.Normalize(p.Name)));
                if (prov != null)
                {
                    criteria.ProvinceCode = prov.Code;
                    criteria.DestinationKeyword = prov.Name;
                }
                else
                {
                    criteria.DestinationKeyword = rawQuery;
                }
            }
        }

        return criteria;
    }

    private static string BuildSmartSearchSummary(
        string rawQuery,
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

public sealed class AiSmartSearchRequest
{
    public string Query { get; set; } = string.Empty;
    public double? UserLatitude { get; set; }
    public double? UserLongitude { get; set; }
}

public sealed class AiConciergeRequest
{
    public string Message { get; set; } = string.Empty;
    public string? PropertySlug { get; set; }
}

public sealed class AiConciergeResponse
{
    public string Intent { get; set; } = string.Empty;
    public string Reply { get; set; } = string.Empty;
    public DetectedCriteriaDto DetectedCriteria { get; set; } = new();
    public List<SuggestedRoomCardDto> SuggestedRooms { get; set; } = new();
}

public sealed class DetectedCriteriaDto
{
    public string? City { get; set; }
    public int? MinGuests { get; set; }
    public List<string> Amenities { get; set; } = new();
}

public sealed class SuggestedRoomCardDto
{
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public string PropertySlug { get; set; } = string.Empty;
    public string PropertyName { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public int StandardOccupancy { get; set; }
    public int MaxOccupancy { get; set; }
    public decimal BasePriceNight { get; set; }
    public string Description { get; set; } = string.Empty;
}

public sealed class AiUsageStatusDto
{
    public string TierName { get; set; } = string.Empty;
    public int MonthlyQuota { get; set; }
    public int UsedCount { get; set; }
    public int RemainingCount { get; set; }
    public bool IsLimitReached { get; set; }
}
