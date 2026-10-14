using System.Collections.Generic;

namespace HotelSaas.Application.Common.Interfaces;

/// <summary>
/// Data transfer object representing a 2-level administrative province/city in Vietnam.
/// </summary>
public sealed record ProvinceDto(string Code, string Name, string Type);

/// <summary>
/// Data transfer object representing an administrative ward/commune in Vietnam directly mapped to a province.
/// </summary>
public sealed record WardDto(string Code, string Name, string Type, string ProvinceCode, string ProvinceName);

/// <summary>
/// Data transfer object representing a recognized tourist zone or destination area.
/// </summary>
public sealed record TouristZoneDto(
    string Slug,
    string Name,
    string ProvinceCode,
    string? Description = null,
    string? ImageUrl = null,
    double? CenterLatitude = null,
    double? CenterLongitude = null,
    IReadOnlyList<string>? WardCodes = null,
    string? Code = null);

/// <summary>
/// Data transfer object representing a prominent tourist landmark or point of interest.
/// </summary>
public sealed record LandmarkDto(
    string Slug,
    string Name,
    string Category,
    string ProvinceCode,
    string? TouristZoneSlug,
    double Latitude,
    double Longitude,
    string? Address = null,
    string? NormalizedName = null,
    IReadOnlyList<string>? Aliases = null,
    string? WardCode = null,
    int PopularSearchRank = 0);

/// <summary>
/// Interface for reading and resolving standardized 2-level Vietnamese administrative locations,
/// as well as prominent tourist zones and landmarks.
/// </summary>
public interface ILocationLookupService
{
    /// <summary>
    /// Gets all 63 standardized Vietnamese provinces and centrally-governed cities.
    /// </summary>
    IReadOnlyList<ProvinceDto> GetProvinces();

    /// <summary>
    /// Gets all administrative wards/communes belonging to the specified province code.
    /// </summary>
    /// <param name="provinceCode">Standardized province code.</param>
    IReadOnlyList<WardDto> GetWardsByProvince(string provinceCode);

    /// <summary>
    /// Finds a province by its code.
    /// </summary>
    ProvinceDto? GetProvinceByCode(string provinceCode);

    /// <summary>
    /// Finds a ward by province and ward codes.
    /// </summary>
    WardDto? GetWardByCode(string provinceCode, string wardCode);

    /// <summary>
    /// Validates whether a province code exists.
    /// </summary>
    bool IsValidProvince(string provinceCode);

    /// <summary>
    /// Validates whether a ward code belongs to the specified province.
    /// </summary>
    bool IsValidWard(string provinceCode, string wardCode);

    /// <summary>
    /// Gets all recognized tourist zones, optionally filtered by province.
    /// </summary>
    IReadOnlyList<TouristZoneDto> GetTouristZones(string? provinceCode = null);

    /// <summary>
    /// Finds a tourist zone by its unique URL slug.
    /// </summary>
    TouristZoneDto? GetTouristZoneBySlug(string slug);

    /// <summary>
    /// Finds a recognized tourist zone by slug, name, or normalized text.
    /// </summary>
    TouristZoneDto? FindTouristZone(string query);

    /// <summary>
    /// Gets prominent landmarks, optionally filtered by province or tourist zone.
    /// </summary>
    IReadOnlyList<LandmarkDto> GetLandmarks(string? provinceCode = null, string? touristZoneSlug = null);

    /// <summary>
    /// Finds a landmark by its unique URL slug.
    /// </summary>
    LandmarkDto? GetLandmarkBySlug(string slug);

    /// <summary>
    /// Searches for a recognized landmark by slug, name, normalized name, or common aliases.
    /// </summary>
    LandmarkDto? FindLandmark(string query);

    /// <summary>
    /// Searches prominent landmarks matching query keyword and optional province code.
    /// </summary>
    IReadOnlyList<LandmarkDto> SearchLandmarks(string query, string? provinceCode = null, int maxResults = 10);
}
