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
/// Interface for reading and resolving standardized 2-level Vietnamese administrative locations.
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
}
