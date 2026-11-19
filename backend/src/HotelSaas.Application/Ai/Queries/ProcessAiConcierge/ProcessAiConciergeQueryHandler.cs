using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Ai.Common;
using HotelSaas.Application.Ai.DTOs;
using HotelSaas.Application.Common.Exceptions;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HotelSaas.Application.Ai.Queries.ProcessAiConcierge;

public sealed class ProcessAiConciergeQueryHandler : IRequestHandler<ProcessAiConciergeQuery, AiConciergeResponse>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserContext _currentUser;

    public ProcessAiConciergeQueryHandler(IApplicationDbContext context, ICurrentUserContext currentUser)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _currentUser = currentUser ?? throw new ArgumentNullException(nameof(currentUser));
    }

    public async Task<AiConciergeResponse> Handle(ProcessAiConciergeQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            throw new BadRequestException("ERR_EMPTY_MESSAGE", "Nội dung câu hỏi không được để trống.");
        }

        var message = request.Message.Trim();
        var lower = message.ToLowerInvariant();

        // 1. Detect Intent
        var intent = DetectIntent(lower);

        // 2. Extract criteria
        var criteria = ExtractSearchCriteria(lower);

        var isTenantless = !_currentUser.TenantId.HasValue || _currentUser.TenantId == Guid.Empty;
        var baseProperties = (isTenantless ? _context.Properties.IgnoreQueryFilters() : _context.Properties)
            .AsNoTracking()
            .Where(p => p.Status == PropertyStatus.Active);
        var baseRoomTypes = (isTenantless ? _context.RoomTypes.IgnoreQueryFilters() : _context.RoomTypes)
            .AsNoTracking();

        // 3. Query properties and room types from database
        var propertiesQuery = baseProperties;

        if (!isTenantless)
        {
            var currentTenantId = _currentUser.TenantId!.Value;
            propertiesQuery = propertiesQuery.Where(p => p.TenantId == currentTenantId);
        }

        if (!string.IsNullOrWhiteSpace(request.PropertySlug))
        {
            propertiesQuery = propertiesQuery.Where(p => p.Slug == request.PropertySlug);
        }
        else if (!string.IsNullOrWhiteSpace(criteria.City))
        {
            var cityLower = criteria.City.ToLowerInvariant();
            propertiesQuery = propertiesQuery.Where(p =>
                p.City.ToLower().Contains(cityLower) ||
                p.Address.ToLower().Contains(cityLower));
        }

        var properties = await propertiesQuery.ToListAsync(cancellationToken);

        if (properties.Count == 0 && !isTenantless)
        {
            var currentTenantId = _currentUser.TenantId!.Value;
            properties = await baseProperties
                .Where(p => p.TenantId == currentTenantId)
                .ToListAsync(cancellationToken);
        }

        if (properties.Count == 0)
        {
            properties = await baseProperties
                .Take(5)
                .ToListAsync(cancellationToken);
        }

        var propertyIds = properties.Select(p => p.Id).ToList();

        var roomTypesQuery = baseRoomTypes
            .Where(rt => propertyIds.Contains(rt.PropertyId));

        if (criteria.MinGuests.HasValue)
        {
            roomTypesQuery = roomTypesQuery.Where(rt => rt.MaxOccupancy >= criteria.MinGuests.Value);
        }

        var roomTypes = await roomTypesQuery.Take(6).ToListAsync(cancellationToken);

        if (roomTypes.Count == 0 && propertyIds.Count > 0)
        {
            roomTypes = await baseRoomTypes
                .Where(rt => propertyIds.Contains(rt.PropertyId))
                .Take(6)
                .ToListAsync(cancellationToken);
        }

        var primaryProp = properties.FirstOrDefault();
        var defaultPropertyName = primaryProp?.Name
            ?? (await baseProperties
                .Where(p => isTenantless || p.TenantId == _currentUser.TenantId!.Value)
                .Select(p => p.Name)
                .FirstOrDefaultAsync(cancellationToken))
            ?? "Cơ sở lưu trú";

        var defaultPropertySlug = primaryProp?.Slug ?? "property";
        var defaultCity = primaryProp?.City ?? "Việt Nam";

        decimal fallbackBasePrice = 0m;
        if (roomTypes.Any(rt => rt.BasePrice <= 0))
        {
            var dbPrice = await baseRoomTypes
                .Where(rt => propertyIds.Contains(rt.PropertyId) && rt.BasePrice > 0)
                .Select(rt => (decimal?)rt.BasePrice)
                .FirstOrDefaultAsync(cancellationToken);

            fallbackBasePrice = dbPrice
                ?? await baseRoomTypes
                    .Where(rt => rt.BasePrice > 0 && (isTenantless || _context.Properties.Any(p => p.Id == rt.PropertyId && p.TenantId == _currentUser.TenantId!.Value)))
                    .Select(rt => (decimal?)rt.BasePrice)
                    .FirstOrDefaultAsync(cancellationToken)
                ?? 0m;
        }

        // 4. Build room recommendation cards
        var suggestedRooms = new List<SuggestedRoomCardDto>();
        foreach (var rt in roomTypes)
        {
            var prop = properties.FirstOrDefault(p => p.Id == rt.PropertyId);
            suggestedRooms.Add(new SuggestedRoomCardDto
            {
                RoomTypeId = rt.Id,
                RoomTypeName = rt.Name,
                PropertySlug = prop?.Slug ?? defaultPropertySlug,
                PropertyName = prop?.Name ?? defaultPropertyName,
                City = prop?.City ?? defaultCity,
                StandardOccupancy = Math.Max(1, rt.MaxOccupancy - 1),
                MaxOccupancy = rt.MaxOccupancy,
                BasePriceNight = rt.BasePrice > 0 ? rt.BasePrice : fallbackBasePrice,
                Description = string.IsNullOrWhiteSpace(rt.Description)
                    ? "Phòng đầy đủ tiện nghi tiêu chuẩn cao cấp, điều hòa, wifi tốc độ cao, minibar."
                    : rt.Description
            });
        }

        // 5. Generate Vietnamese Hospitality Response (using property check-in/out policy times - T025)
        var reply = GenerateNaturalResponse(
            intent,
            criteria,
            suggestedRooms,
            primaryProp?.Name ?? defaultPropertyName,
            primaryProp);

        // 6. Record AI usage telemetry if tenant context is available
        if (_currentUser.TenantId.HasValue && _currentUser.TenantId.Value != Guid.Empty)
        {
            await AiHelper.TryRecordAiUsageAsync(
                _context,
                _currentUser,
                _currentUser.TenantId.Value,
                "Concierge",
                message,
                reply,
                "gemini-2.5-flash",
                cancellationToken);
        }

        return new AiConciergeResponse
        {
            Intent = intent,
            Reply = reply,
            DetectedCriteria = criteria,
            SuggestedRooms = suggestedRooms
        };
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

        if (lower.Contains("đà nẵng") || lower.Contains("da nang")) criteria.City = "Đà Nẵng";
        else if (lower.Contains("hà nội") || lower.Contains("ha noi")) criteria.City = "Hà Nội";
        else if (lower.Contains("hồ chí minh") || lower.Contains("sài gòn") || lower.Contains("tphcm")) criteria.City = "Hồ Chí Minh";
        else if (lower.Contains("nha trang")) criteria.City = "Nha Trang";
        else if (lower.Contains("đà lạt") || lower.Contains("da lat")) criteria.City = "Đà Lạt";
        else if (lower.Contains("phú quốc") || lower.Contains("phu quoc")) criteria.City = "Phú Quốc";

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

        if (lower.Contains("view biển") || lower.Contains("hướng biển")) criteria.Amenities.Add("View biển");
        if (lower.Contains("bồn tắm")) criteria.Amenities.Add("Bồn tắm nằm");
        if (lower.Contains("ban công")) criteria.Amenities.Add("Ban công");
        if (lower.Contains("hồ bơi") || lower.Contains("bể bơi")) criteria.Amenities.Add("Hồ bơi");
        if (lower.Contains("ăn sáng") || lower.Contains("buffet")) criteria.Amenities.Add("Bao gồm ăn sáng");

        return criteria;
    }

    private static string GenerateNaturalResponse(
        string intent,
        DetectedCriteriaDto criteria,
        List<SuggestedRoomCardDto> rooms,
        string? propertyName,
        Property? primaryProperty)
    {
        var hotelName = propertyName ?? "hệ thống khách sạn của chúng tôi";

        switch (intent)
        {
            case "PolicyInquiry":
                var checkInTime = primaryProperty != null ? primaryProperty.CheckInTime.ToString("HH:mm") : "14:00";
                var checkOutTime = primaryProperty != null ? primaryProperty.CheckOutTime.ToString("HH:mm") : "12:00";
                return $"Dạ chào Quý khách! Tại {hotelName}, giờ nhận phòng tiêu chuẩn (Check-in) là từ {checkInTime} và trả phòng (Check-out) trước {checkOutTime} hôm sau. " +
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
}
