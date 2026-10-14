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

    private readonly List<TouristZoneDto> _touristZones = new();
    private readonly Dictionary<string, TouristZoneDto> _touristZonesBySlug = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<LandmarkDto> _landmarks = new();
    private readonly Dictionary<string, LandmarkDto> _landmarksBySlug = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Initializes a new instance of <see cref="LocationLookupService"/> and parses the embedded CSV data.
    /// </summary>
    public LocationLookupService()
    {
        LoadProvinces();
        LoadWards();
        LoadTouristZonesAndLandmarks();
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

    /// <inheritdoc />
    public IReadOnlyList<TouristZoneDto> GetTouristZones(string? provinceCode = null)
    {
        if (string.IsNullOrWhiteSpace(provinceCode))
        {
            return _touristZones;
        }

        return _touristZones
            .Where(z => string.Equals(z.ProvinceCode, provinceCode.Trim(), StringComparison.OrdinalIgnoreCase))
            .ToList();
    }

    /// <inheritdoc />
    public TouristZoneDto? GetTouristZoneBySlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        return _touristZonesBySlug.TryGetValue(slug.Trim(), out var zone) ? zone : null;
    }

    /// <inheritdoc />
    public IReadOnlyList<LandmarkDto> GetLandmarks(string? provinceCode = null, string? touristZoneSlug = null)
    {
        var result = _landmarks.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(provinceCode))
        {
            result = result.Where(l => string.Equals(l.ProvinceCode, provinceCode.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(touristZoneSlug))
        {
            result = result.Where(l => string.Equals(l.TouristZoneSlug, touristZoneSlug.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        return result.ToList();
    }

    /// <inheritdoc />
    public LandmarkDto? GetLandmarkBySlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        return _landmarksBySlug.TryGetValue(slug.Trim(), out var landmark) ? landmark : null;
    }

    private void LoadTouristZonesAndLandmarks()
    {
        var zones = new List<TouristZoneDto>
        {
            new("da-lat", "Đà Lạt", "68", "Thành phố ngàn hoa với khí hậu se lạnh và cảnh quan đồi thông thơ mộng", "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=800"),
            new("vung-tau", "Vũng Tàu", "77", "Thành phố biển sôi động với bãi tắm dài và hải sản tươi ngon", "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800"),
            new("nha-trang", "Nha Trang", "56", "Vịnh biển đẹp bậc nhất Việt Nam với dải cát trắng và đảo san hô", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800"),
            new("da-nang", "Đà Nẵng", "48", "Thành phố đáng sống với biển Mỹ Khê, cầu Rồng và núi Ngũ Hành Sơn", "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800"),
            new("hoi-an", "Hội An", "49", "Đô thị cổ trầm mặc với đèn lồng lung linh và di sản UNESCO", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800"),
            new("phu-quoc", "Phú Quốc", "91", "Đảo ngọc thiên đường với biển xanh ngọc bích, hoàng hôn Bãi Trường", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800"),
            new("sa-pa", "Sa Pa", "10", "Xứ sở sương mù Tây Bắc với ruộng bậc thang và đỉnh Fansipan hùng vĩ", "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800"),
            new("ha-noi-pho-co", "Hà Nội - Phố Cổ & Hồ Gươm", "01", "Trái tim nghìn năm văn hiến, phố cổ 36 phố phường và ẩm thực nức tiếng", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800"),
            new("quan-1-tphcm", "TP. Hồ Chí Minh - Trung Tâm Quận 1", "79", "Trung tâm tài chính, mua sắm và giải trí sôi động ngày đêm", "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800"),
            new("ha-long", "Hạ Long", "22", "Kỳ quan thiên nhiên thế giới với hàng nghìn đảo đá vôi kỳ vĩ", "https://images.unsplash.com/photo-1528127269322-539801943592?w=800"),
            new("phan-thiet-mui-ne", "Phan Thiết - Mũi Né", "60", "Thủ phủ resort với đồi cát bay, làng chài và biển xanh nắng vàng", "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800"),
            new("quy-nhon", "Quy Nhơn", "52", "Vẻ đẹp hoang sơ tuyệt mỹ của Kỳ Co, Eo Gió và biển trong vắt", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800")
        };

        foreach (var z in zones)
        {
            _touristZones.Add(z);
            _touristZonesBySlug[z.Slug] = z;
        }

        var landmarks = new List<LandmarkDto>
        {
            // Đà Lạt
            new("cho-dem-da-lat", "Chợ Đêm Đà Lạt", "Chợ & Ẩm thực", "68", "da-lat", 11.9424, 108.4373, "Đường Nguyễn Thị Minh Khai, Phường 1, Đà Lạt"),
            new("ho-xuan-huong", "Hồ Xuân Hương", "Điểm tham quan", "68", "da-lat", 11.9404, 108.4452, "Trung tâm TP. Đà Lạt"),
            new("quang-truong-lam-vien", "Quảng Trường Lâm Viên", "Quảng trường", "68", "da-lat", 11.9366, 108.4456, "Đường Trần Quốc Toản, Phường 1, Đà Lạt"),
            new("thung-lung-tinh-yeu", "Thung Lũng Tình Yêu", "Thắng cảnh", "68", "da-lat", 11.9794, 108.4506, "Số 3-5-7 Đường Mai Anh Đào, Phường 8, Đà Lạt"),

            // Vũng Tàu
            new("bai-sau-vung-tau", "Bãi Sau Vũng Tàu (Bãi Thùy Vân)", "Bãi biển", "77", "vung-tau", 10.3347, 107.0898, "Đường Thùy Vân, Vũng Tàu"),
            new("bai-truoc-vung-tau", "Bãi Trước Vũng Tàu", "Bãi biển", "77", "vung-tau", 10.3475, 107.0734, "Đường Quang Trung, Vũng Tàu"),
            new("tuong-chua-kito-vung-tau", "Tượng Chúa Kito Vua", "Di tích tôn giáo", "77", "vung-tau", 10.3264, 107.0847, "Núi Nhỏ, Phường 2, Vũng Tàu"),
            new("cho-dem-vung-tau", "Chợ Đêm Vũng Tàu", "Chợ & Ẩm thực", "77", "vung-tau", 10.3389, 107.0863, "Phường Thắng Tam, Vũng Tàu"),

            // Đà Nẵng
            new("bai-bien-my-khe", "Bãi Biển Mỹ Khê", "Bãi biển", "48", "da-nang", 16.0601, 108.2464, "Đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng"),
            new("cau-rong-da-nang", "Cầu Rồng Đà Nẵng", "Điểm check-in", "48", "da-nang", 16.0611, 108.2272, "Đường Nguyễn Văn Linh, Phước Ninh, Hải Châu, Đà Nẵng"),
            new("san-bay-da-nang", "Sân bay Quốc tế Đà Nẵng", "Sân bay", "48", "da-nang", 16.0538, 108.1994, "Đường Duy Tân, Hải Châu, Đà Nẵng"),
            new("cho-han-da-nang", "Chợ Hàn Đà Nẵng", "Chợ & Mua sắm", "48", "da-nang", 16.0683, 108.2241, "119 Trần Phú, Hải Châu 1, Đà Nẵng"),

            // Hội An
            new("pho-co-hoi-an", "Phố Cổ Hội An", "Di sản UNESCO", "49", "hoi-an", 15.8801, 108.3263, "Trung tâm Phố Cổ, Hội An"),
            new("chua-cau-hoi-an", "Chùa Cầu Nhật Bản", "Di tích lịch sử", "49", "hoi-an", 15.8772, 108.3260, "Đường Nguyễn Thị Minh Khai, Minh An, Hội An"),

            // Nha Trang
            new("thap-tram-huong-nha-trang", "Quảng Trường & Tháp Trầm Hương", "Quảng trường biển", "56", "nha-trang", 12.2388, 109.1967, "Đường Trần Phú, Lộc Thọ, Nha Trang"),
            new("bai-bien-tran-phu", "Bãi Biển Trần Phú", "Bãi biển", "56", "nha-trang", 12.2415, 109.1970, "Dọc đường Trần Phú, Nha Trang"),
            new("vinwonders-nha-trang", "VinWonders Nha Trang", "Khu vui chơi", "56", "nha-trang", 12.2198, 109.2435, "Đảo Hòn Tre, Vĩnh Nguyên, Nha Trang"),

            // Phú Quốc
            new("cho-dem-phu-quoc", "Chợ Đêm Phú Quốc", "Chợ & Ẩm thực", "91", "phu-quoc", 10.2185, 103.9610, "Đường Bạch Đằng, Dương Đông, Phú Quốc"),
            new("san-bay-phu-quoc", "Sân bay Quốc tế Phú Quốc", "Sân bay", "91", "phu-quoc", 10.1698, 103.9930, "Xã Dương Tơ, Phú Quốc"),
            new("grand-world-phu-quoc", "Grand World Phú Quốc (Thành phố không ngủ)", "Điểm giải trí", "91", "phu-quoc", 10.3235, 103.8580, "Gành Dầu, Phú Quốc"),

            // TP. Hồ Chí Minh
            new("cho-ben-thanh", "Chợ Bến Thành", "Chợ & Mua sắm", "79", "quan-1-tphcm", 10.7725, 106.6980, "Đường Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM"),
            new("pho-di-bo-nguyen-hue", "Phố Đi Bộ Nguyễn Huệ", "Quảng trường", "79", "quan-1-tphcm", 10.7745, 106.7036, "Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM"),
            new("nha-tho-duc-ba", "Nhà Thờ Đức Bà Sài Gòn", "Di tích kiến trúc", "79", "quan-1-tphcm", 10.7798, 106.6990, "01 Công xã Paris, Bến Nghé, Quận 1, TP.HCM"),
            new("san-bay-tan-son-nhat", "Sân bay Quốc tế Tân Sơn Nhất", "Sân bay", "79", null, 10.8185, 106.6588, "Đường Trường Sơn, Phường 2, Tân Bình, TP.HCM"),

            // Hà Nội
            new("ho-hoan-kiem", "Hồ Hoàn Kiếm (Hồ Gươm)", "Thắng cảnh & Lịch sử", "01", "ha-noi-pho-co", 21.0285, 105.8542, "Hàng Trống, Hoàn Kiếm, Hà Nội"),
            new("cho-dong-xuan", "Chợ Đồng Xuân", "Chợ & Mua sắm", "01", "ha-noi-pho-co", 21.0378, 105.8497, "Đồng Xuân, Hoàn Kiếm, Hà Nội"),
            new("san-bay-noi-bai", "Sân bay Quốc tế Nội Bài", "Sân bay", "01", null, 21.2212, 105.8072, "Phú Minh, Sóc Sơn, Hà Nội")
        };

        foreach (var l in landmarks)
        {
            _landmarks.Add(l);
            _landmarksBySlug[l.Slug] = l;
        }
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
