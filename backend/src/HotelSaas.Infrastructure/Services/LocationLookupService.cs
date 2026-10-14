using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using HotelSaas.Application.Common.Interfaces;

namespace HotelSaas.Infrastructure.Services;

/// <summary>
/// In-memory singleton service that loads and indexes the official 2-level Vietnamese administrative divisions
/// from embedded CSV resources at startup.
/// </summary>
public sealed class LocationLookupService : ILocationLookupService
{
    private readonly List<ProvinceDto> _provinces = new();
    private readonly Dictionary<string, ProvinceDto> _provincesByCode = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<WardDto>> _wardsByProvinceCode = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, WardDto> _wardsByCompositeKey = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Initializes a new instance of <see cref="LocationLookupService"/> and parses the embedded CSV data.
    /// </summary>
    public LocationLookupService()
    {
        LoadProvinces();
        LoadWards();
    }

    /// <inheritdoc />
    public IReadOnlyList<ProvinceDto> GetProvinces() => _provinces;

    /// <inheritdoc />
    public IReadOnlyList<WardDto> GetWardsByProvince(string provinceCode)
    {
        if (string.IsNullOrWhiteSpace(provinceCode))
        {
            return Array.Empty<WardDto>();
        }

        return _wardsByProvinceCode.TryGetValue(provinceCode.Trim(), out var wards)
            ? wards
            : Array.Empty<WardDto>();
    }

    /// <inheritdoc />
    public ProvinceDto? GetProvinceByCode(string provinceCode)
    {
        if (string.IsNullOrWhiteSpace(provinceCode))
        {
            return null;
        }

        return _provincesByCode.TryGetValue(provinceCode.Trim(), out var province)
            ? province
            : null;
    }

    /// <inheritdoc />
    public WardDto? GetWardByCode(string provinceCode, string wardCode)
    {
        if (string.IsNullOrWhiteSpace(provinceCode) || string.IsNullOrWhiteSpace(wardCode))
        {
            return null;
        }

        var key = $"{provinceCode.Trim()}_{wardCode.Trim()}";
        return _wardsByCompositeKey.TryGetValue(key, out var ward)
            ? ward
            : null;
    }

    /// <inheritdoc />
    public bool IsValidProvince(string provinceCode)
    {
        if (string.IsNullOrWhiteSpace(provinceCode)) return false;
        return _provincesByCode.ContainsKey(provinceCode.Trim());
    }

    /// <inheritdoc />
    public bool IsValidWard(string provinceCode, string wardCode)
    {
        if (string.IsNullOrWhiteSpace(provinceCode) || string.IsNullOrWhiteSpace(wardCode)) return false;
        return _wardsByCompositeKey.ContainsKey($"{provinceCode.Trim()}_{wardCode.Trim()}");
    }

    private void LoadProvinces()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("DMTinhThanh_2Cap.csv", StringComparison.OrdinalIgnoreCase));

        if (resourceName == null)
        {
            return;
        }

        using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null) return;

        using var reader = new StreamReader(stream, Encoding.UTF8);
        string? header = reader.ReadLine(); // "MaTinh","TenTinh","Loai"

        while (!reader.EndOfStream)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) continue;

            var parts = ParseCsvLine(line);
            if (parts.Count >= 3)
            {
                var code = parts[0].Trim();
                var name = parts[1].Trim();
                var type = parts[2].Trim();

                var dto = new ProvinceDto(code, name, type);
                _provinces.Add(dto);
                _provincesByCode[code] = dto;
            }
        }
    }

    private void LoadWards()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(n => n.EndsWith("DMXaPhuong_2Cap.csv", StringComparison.OrdinalIgnoreCase));

        if (resourceName == null)
        {
            return;
        }

        using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null) return;

        using var reader = new StreamReader(stream, Encoding.UTF8);
        string? header = reader.ReadLine(); // "MaXa","TenXa","Loai","MaTinh","TenTinh"

        while (!reader.EndOfStream)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line)) continue;

            var parts = ParseCsvLine(line);
            if (parts.Count >= 5)
            {
                var wardCode = parts[0].Trim();
                var wardName = parts[1].Trim();
                var type = parts[2].Trim();
                var provinceCode = parts[3].Trim();
                var provinceName = parts[4].Trim();

                var dto = new WardDto(wardCode, wardName, type, provinceCode, provinceName);

                if (!_wardsByProvinceCode.TryGetValue(provinceCode, out var wardList))
                {
                    wardList = new List<WardDto>();
                    _wardsByProvinceCode[provinceCode] = wardList;
                }
                wardList.Add(dto);

                var compositeKey = $"{provinceCode}_{wardCode}";
                _wardsByCompositeKey[compositeKey] = dto;
            }
        }
    }

    private static List<string> ParseCsvLine(string line)
    {
        var result = new List<string>();
        var sb = new StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];
            if (c == '"')
            {
                inQuotes = !inQuotes;
            }
            else if (c == ',' && !inQuotes)
            {
                result.Add(sb.ToString().Trim());
                sb.Clear();
            }
            else
            {
                sb.Append(c);
            }
        }
        result.Add(sb.ToString().Trim());
        return result;
    }
}
