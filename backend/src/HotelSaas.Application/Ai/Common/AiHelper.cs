using System;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Ai.Common;

internal static class AiHelper
{
    internal static TimeZoneInfo ResolveVietnamTimeZone()
    {
        return TimeZoneInfo.TryFindSystemTimeZoneById("Asia/Ho_Chi_Minh", out var vnTz)
            ? vnTz
            : (TimeZoneInfo.TryFindSystemTimeZoneById("SE Asia Standard Time", out var seTz)
                ? seTz
                : TimeZoneInfo.CreateCustomTimeZone("Asia/Ho_Chi_Minh", TimeSpan.FromHours(7), "ICT", "ICT"));
    }

    internal static async Task TryRecordAiUsageAsync(
        IApplicationDbContext context,
        ICurrentUserContext currentUser,
        Guid tenantId,
        string feature,
        string prompt,
        string response,
        string modelUsed,
        CancellationToken cancellationToken)
    {
        try
        {
            context.AiUsageLogs.Add(new AiUsageLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                UserId = currentUser.UserId != Guid.Empty ? currentUser.UserId : null,
                Feature = feature,
                Prompt = prompt,
                Response = response,
                ModelUsed = modelUsed,
                IsSuccess = true,
                CreatedAtUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Non-critical telemetry logging must not disrupt user workflow
        }
    }

    internal static AiSmartExtractedFiltersDto ExtractSmartSearchCriteria(
        ILocationLookupService locationService,
        string rawQuery,
        string normQuery)
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
                if (decimal.TryParse(numStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var num))
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
        var landmark = locationService.FindLandmark(rawQuery);
        if (landmark != null)
        {
            criteria.LandmarkSlug = landmark.Slug;
            criteria.LandmarkName = landmark.Name;
            criteria.DestinationKeyword = landmark.Name;
            criteria.TouristZoneSlug = landmark.TouristZoneSlug;
            criteria.ProvinceCode = landmark.ProvinceCode;
            criteria.MaxDistanceMeters = 3000.0;
        }
        else
        {
            var zone = locationService.FindTouristZone(rawQuery);
            if (zone != null)
            {
                criteria.TouristZoneSlug = zone.Slug;
                criteria.DestinationKeyword = zone.Name;
                criteria.ProvinceCode = zone.ProvinceCode;
            }
            else
            {
                var prov = locationService.GetProvinces()
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
}
