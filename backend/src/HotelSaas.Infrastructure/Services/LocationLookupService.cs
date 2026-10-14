using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using HotelSaas.Application.Common.Interfaces;
using HotelSaas.Application.Common.Utils;

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
    public TouristZoneDto? FindTouristZone(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;

        var qTrim = query.Trim();
        if (_touristZonesBySlug.TryGetValue(qTrim, out var zone)) return zone;

        var normQuery = VietnameseTextNormalizer.Normalize(qTrim);
        return _touristZones.FirstOrDefault(z =>
            string.Equals(z.Slug, qTrim, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrEmpty(z.Code) && string.Equals(z.Code, qTrim, StringComparison.OrdinalIgnoreCase)) ||
            VietnameseTextNormalizer.Normalize(z.Name).Contains(normQuery, StringComparison.OrdinalIgnoreCase) ||
            normQuery.Contains(VietnameseTextNormalizer.Normalize(z.Name), StringComparison.OrdinalIgnoreCase));
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

        return result.OrderBy(l => l.PopularSearchRank > 0 ? l.PopularSearchRank : 999).ToList();
    }

    /// <inheritdoc />
    public LandmarkDto? GetLandmarkBySlug(string slug)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        return _landmarksBySlug.TryGetValue(slug.Trim(), out var landmark) ? landmark : null;
    }

    /// <inheritdoc />
    public LandmarkDto? FindLandmark(string query)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;

        var qTrim = query.Trim();
        if (_landmarksBySlug.TryGetValue(qTrim, out var landmark)) return landmark;

        var normQuery = VietnameseTextNormalizer.Normalize(qTrim);

        return _landmarks
            .OrderBy(l => l.PopularSearchRank > 0 ? l.PopularSearchRank : 999)
            .FirstOrDefault(l =>
                string.Equals(l.Slug, qTrim, StringComparison.OrdinalIgnoreCase) ||
                (l.NormalizedName != null && (l.NormalizedName.Contains(normQuery, StringComparison.OrdinalIgnoreCase) || normQuery.Contains(l.NormalizedName, StringComparison.OrdinalIgnoreCase))) ||
                (l.Aliases != null && l.Aliases.Any(a =>
                {
                    var aNorm = VietnameseTextNormalizer.Normalize(a);
                    return aNorm.Contains(normQuery, StringComparison.OrdinalIgnoreCase) || normQuery.Contains(aNorm, StringComparison.OrdinalIgnoreCase);
                })));
    }

    /// <inheritdoc />
    public IReadOnlyList<LandmarkDto> SearchLandmarks(string query, string? provinceCode = null, int maxResults = 10)
    {
        var list = _landmarks.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(provinceCode))
        {
            list = list.Where(l => string.Equals(l.ProvinceCode, provinceCode.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var normQuery = VietnameseTextNormalizer.Normalize(query.Trim());
            list = list.Where(l =>
                string.Equals(l.Slug, query.Trim(), StringComparison.OrdinalIgnoreCase) ||
                (l.NormalizedName != null && (l.NormalizedName.Contains(normQuery, StringComparison.OrdinalIgnoreCase) || normQuery.Contains(l.NormalizedName, StringComparison.OrdinalIgnoreCase))) ||
                (l.Aliases != null && l.Aliases.Any(a =>
                {
                    var aNorm = VietnameseTextNormalizer.Normalize(a);
                    return !string.IsNullOrEmpty(aNorm) &&
                           (aNorm.Contains(normQuery, StringComparison.OrdinalIgnoreCase) || normQuery.Contains(aNorm, StringComparison.OrdinalIgnoreCase));
                })));
        }

        return list
            .OrderBy(l => l.PopularSearchRank > 0 ? l.PopularSearchRank : 999)
            .Take(maxResults)
            .ToList();
    }

    private void LoadTouristZonesAndLandmarks()
    {
        var zones = new List<TouristZoneDto>
        {
            new("da-lat", "Đà Lạt", "68", "Thành phố ngàn hoa với khí hậu se lạnh và cảnh quan đồi thông thơ mộng", "https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=800", 11.9404, 108.4452, null, "DL"),
            new("vung-tau", "Vũng Tàu", "77", "Thành phố biển sôi động với bãi tắm dài và hải sản tươi ngon", "https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800", 10.3460, 107.0843, null, "VT"),
            new("nha-trang", "Nha Trang", "56", "Vịnh biển đẹp bậc nhất Việt Nam với dải cát trắng và đảo san hô", "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800", 12.2388, 109.1967, null, "NT"),
            new("da-nang", "Đà Nẵng", "48", "Thành phố đáng sống với biển Mỹ Khê, cầu Rồng và núi Ngũ Hành Sơn", "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800", 16.0544, 108.2022, null, "DN"),
            new("hoi-an", "Hội An", "49", "Đô thị cổ trầm mặc với đèn lồng lung linh và di sản UNESCO", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800", 15.8801, 108.3263, null, "HA"),
            new("phu-quoc", "Phú Quốc", "91", "Đảo ngọc thiên đường với biển xanh ngọc bích, hoàng hôn Bãi Trường", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800", 10.2289, 103.9572, null, "PQ"),
            new("sa-pa", "Sa Pa", "10", "Xứ sở sương mù Tây Bắc với ruộng bậc thang và đỉnh Fansipan hùng vĩ", "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800", 22.3354, 103.8427, null, "SP"),
            new("ha-noi-pho-co", "Hà Nội - Phố Cổ & Hồ Gươm", "01", "Trái tim nghìn năm văn hiến, phố cổ 36 phố phường và ẩm thực nức tiếng", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800", 21.0285, 105.8542, null, "HN"),
            new("quan-1-tphcm", "TP. Hồ Chí Minh - Trung Tâm Quận 1", "79", "Trung tâm tài chính, mua sắm và giải trí sôi động ngày đêm", "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800", 10.7769, 106.7009, null, "SG"),
            new("ha-long", "Hạ Long", "22", "Kỳ quan thiên nhiên thế giới với hàng nghìn đảo đá vôi kỳ vĩ", "https://images.unsplash.com/photo-1528127269322-539801943592?w=800", 20.9500, 107.0733, null, "HL"),
            new("phan-thiet-mui-ne", "Phan Thiết - Mũi Né", "60", "Thủ phủ resort với đồi cát bay, làng chài và biển xanh nắng vàng", "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800", 10.9333, 108.1000, null, "PT"),
            new("quy-nhon", "Quy Nhơn", "52", "Vẻ đẹp hoang sơ tuyệt mỹ của Kỳ Co, Eo Gió và biển trong vắt", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800", 13.7830, 109.2197, null, "QN")
        };

        foreach (var z in zones)
        {
            _touristZones.Add(z);
            _touristZonesBySlug[z.Slug] = z;
        }

        var rawLandmarks = new List<LandmarkDto>
        {
            // Đà Lạt (68)
            new("cho-dem-da-lat", "Chợ Đêm Đà Lạt", "NightMarket", "68", "da-lat", 11.9424, 108.4373, "Đường Nguyễn Thị Minh Khai, Phường 1, Đà Lạt", null, new[] { "Chợ Đêm", "Chợ Âm Phủ", "Chợ Đà Lạt" }, null, 1),
            new("ho-xuan-huong", "Hồ Xuân Hương", "CityCenter", "68", "da-lat", 11.9404, 108.4452, "Trung tâm TP. Đà Lạt", null, new[] { "Xuân Hương", "Bờ Hồ Đà Lạt", "Ho Xuan Huong" }, null, 2),
            new("quang-truong-lam-vien", "Quảng Trường Lâm Viên", "CityCenter", "68", "da-lat", 11.9366, 108.4456, "Đường Trần Quốc Toản, Phường 1, Đà Lạt", null, new[] { "Lâm Viên", "Nụ Hoa Atiso", "Bông Hoa Dã Quỳ" }, null, 3),
            new("khu-hoa-binh", "Khu Hòa Bình Đà Lạt", "CityCenter", "68", "da-lat", 11.9431, 108.4385, "Phường 1, TP. Đà Lạt", null, new[] { "Hòa Bình Đà Lạt", "Khu Hòa Bình", "Rạp Hòa Bình" }, null, 4),
            new("ho-tuyen-lam", "Hồ Tuyền Lâm", "Heritage", "68", "da-lat", 11.8970, 108.4358, "Phường 4, TP. Đà Lạt", null, new[] { "Tuyền Lâm", "Hồ Tuyền Lâm Đà Lạt" }, null, 5),
            new("thung-lung-tinh-yeu", "Thung Lũng Tình Yêu", "ThemePark", "68", "da-lat", 11.9794, 108.4506, "Số 3-5-7 Đường Mai Anh Đào, Phường 8, Đà Lạt", null, new[] { "Thung Lũng Tình Yêu", "Valley of Love" }, null, 6),

            // TP. Hồ Chí Minh (79)
            new("cho-ben-thanh", "Chợ Bến Thành", "NightMarket", "79", "quan-1-tphcm", 10.7725, 106.6980, "Đường Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM", null, new[] { "Bến Thành", "Ben Thanh Market", "Chợ Bến Thành Quận 1" }, null, 1),
            new("pho-di-bo-nguyen-hue", "Phố Đi Bộ Nguyễn Huệ", "CityCenter", "79", "quan-1-tphcm", 10.7745, 106.7036, "Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM", null, new[] { "Nguyễn Huệ", "Phố đi bộ", "Nguyen Hue Walking Street" }, null, 2),
            new("pho-tay-bui-vien", "Phố Tây Bùi Viện", "NightMarket", "79", "quan-1-tphcm", 10.7674, 106.6938, "Phường Phạm Ngũ Lão, Quận 1, TP.HCM", null, new[] { "Bùi Viện", "Phố Tây", "Bui Vien Street", "Phố đi bộ Bùi Viện" }, null, 3),
            new("san-bay-tan-son-nhat", "Sân bay Quốc tế Tân Sơn Nhất", "Airport", "79", null, 10.8185, 106.6588, "Đường Trường Sơn, Phường 2, Tân Bình, TP.HCM", null, new[] { "Tân Sơn Nhất", "Sân bay TSN", "Tan Son Nhat Airport", "SGN" }, null, 4),
            new("landmark-81", "Tòa nhà Landmark 81", "CityCenter", "79", null, 10.7950, 106.7218, "720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM", null, new[] { "Landmark 81", "Vinhomes Central Park", "Vincom Landmark 81" }, null, 5),
            new("nha-tho-duc-ba", "Nhà Thờ Đức Bà Sài Gòn", "Heritage", "79", "quan-1-tphcm", 10.7798, 106.6990, "01 Công xã Paris, Bến Nghé, Quận 1, TP.HCM", null, new[] { "Đức Bà", "Nhà Thờ Đức Bà", "Notre Dame Saigon" }, null, 6),

            // Vũng Tàu (77)
            new("bai-sau-vung-tau", "Bãi Sau Vũng Tàu (Bãi Thùy Vân)", "Beach", "77", "vung-tau", 10.3347, 107.0898, "Đường Thùy Vân, Vũng Tàu", null, new[] { "Bãi Sau", "Bãi Thùy Vân", "Thùy Vân Vũng Tàu", "Back Beach" }, null, 1),
            new("bai-truoc-vung-tau", "Bãi Trước Vũng Tàu", "Beach", "77", "vung-tau", 10.3475, 107.0734, "Đường Quang Trung, Vũng Tàu", null, new[] { "Bãi Trước", "Front Beach" }, null, 2),
            new("tuong-chua-kito-vung-tau", "Tượng Chúa Kitô Vua", "Heritage", "77", "vung-tau", 10.3264, 107.0847, "Núi Nhỏ, Phường 2, Vũng Tàu", null, new[] { "Tượng Chúa Kito", "Chúa Dang Tay", "Tượng Chúa Núi Nhỏ" }, null, 3),
            new("ngon-hai-dang-vung-tau", "Ngọn Hải Đăng Vũng Tàu", "Heritage", "77", "vung-tau", 10.3340, 107.0765, "Núi Nhỏ, Phường 2, Vũng Tàu", null, new[] { "Hải Đăng Vũng Tàu", "Hải Đăng Núi Nhỏ" }, null, 4),
            new("cho-dem-vung-tau", "Chợ Đêm Vũng Tàu", "NightMarket", "77", "vung-tau", 10.3389, 107.0863, "Phường Thắng Tam, Vũng Tàu", null, new[] { "Chợ Đêm", "Chợ đêm hải sản Vũng Tàu" }, null, 5),

            // Đà Nẵng (48)
            new("bai-bien-my-khe", "Bãi Biển Mỹ Khê", "Beach", "48", "da-nang", 16.0601, 108.2464, "Đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng", null, new[] { "Mỹ Khê", "Biển Mỹ Khê", "My Khe Beach" }, null, 1),
            new("cau-rong-da-nang", "Cầu Rồng Đà Nẵng", "CityCenter", "48", "da-nang", 16.0611, 108.2272, "Đường Nguyễn Văn Linh, Phước Ninh, Hải Châu, Đà Nẵng", null, new[] { "Cầu Rồng", "Dragon Bridge" }, null, 2),
            new("ba-na-hills", "Bà Nà Hills", "ThemePark", "48", "da-nang", 15.9961, 107.9877, "Thôn An Sơn, Hòa Ninh, Hòa Vang, Đà Nẵng", null, new[] { "Bà Nà", "Cầu Vàng", "Sun World Ba Na Hills" }, null, 3),
            new("san-bay-da-nang", "Sân bay Quốc tế Đà Nẵng", "Airport", "48", "da-nang", 16.0538, 108.1994, "Đường Duy Tân, Hải Châu, Đà Nẵng", null, new[] { "Sân bay Đà Nẵng", "DAD", "Da Nang Airport" }, null, 4),
            new("cho-han-da-nang", "Chợ Hàn Đà Nẵng", "NightMarket", "48", "da-nang", 16.0683, 108.2241, "119 Trần Phú, Hải Châu 1, Đà Nẵng", null, new[] { "Chợ Hàn", "Han Market" }, null, 5),

            // Hội An (49)
            new("pho-co-hoi-an", "Phố Cổ Hội An", "Heritage", "49", "hoi-an", 15.8801, 108.3263, "Trung tâm Phố Cổ, Hội An", null, new[] { "Hội An", "Phố Cổ", "Hoi An Ancient Town" }, null, 1),
            new("chua-cau-hoi-an", "Chùa Cầu Nhật Bản", "Heritage", "49", "hoi-an", 15.8772, 108.3260, "Đường Nguyễn Thị Minh Khai, Minh An, Hội An", null, new[] { "Chùa Cầu", "Lai Viễn Kiều", "Japanese Covered Bridge" }, null, 2),

            // Hà Nội (01)
            new("ho-hoan-kiem", "Hồ Hoàn Kiếm (Hồ Gươm)", "CityCenter", "01", "ha-noi-pho-co", 21.0285, 105.8542, "Hàng Trống, Hoàn Kiếm, Hà Nội", null, new[] { "Hồ Gươm", "Hoàn Kiếm", "Hồ Bờ Hồ", "Bờ Hồ", "Sword Lake" }, null, 1),
            new("pho-co-ha-noi", "Phố Cổ Hà Nội", "Heritage", "01", "ha-noi-pho-co", 21.0340, 105.8500, "Hoàn Kiếm, Hà Nội", null, new[] { "Phố Cổ", "36 Phố Phường", "Hanoi Old Quarter" }, null, 2),
            new("lang-bac-ha-noi", "Lăng Chủ tịch Hồ Chí Minh", "Heritage", "01", "ha-noi-pho-co", 21.0368, 105.8346, "Số 2 Hùng Vương, Điện Biên, Ba Đình, Hà Nội", null, new[] { "Lăng Bác", "Lăng Chủ Tịch", "Quảng Trường Ba Đình" }, null, 3),
            new("ho-tay-ha-noi", "Hồ Tây Hà Nội", "CityCenter", "01", "ha-noi-pho-co", 21.0583, 105.8236, "Tây Hồ, Hà Nội", null, new[] { "Hồ Tây", "West Lake", "Đường Thanh Niên" }, null, 4),
            new("cho-dong-xuan", "Chợ Đồng Xuân", "NightMarket", "01", "ha-noi-pho-co", 21.0378, 105.8497, "Đồng Xuân, Hoàn Kiếm, Hà Nội", null, new[] { "Đồng Xuân", "Chợ Đồng Xuân Hà Nội" }, null, 5),
            new("san-bay-noi-bai", "Sân bay Quốc tế Nội Bài", "Airport", "01", null, 21.2212, 105.8072, "Phú Minh, Sóc Sơn, Hà Nội", null, new[] { "Nội Bài", "Sân bay Nội Bài", "HAN", "Noi Bai Airport" }, null, 6),

            // Nha Trang (56)
            new("thap-tram-huong-nha-trang", "Quảng Trường & Tháp Trầm Hương", "CityCenter", "56", "nha-trang", 12.2388, 109.1967, "Đường Trần Phú, Lộc Thọ, Nha Trang", null, new[] { "Quảng trường 2/4", "Tháp Trầm Hương", "Quảng trường 2-4" }, null, 1),
            new("bai-bien-tran-phu", "Bãi Biển Trần Phú", "Beach", "56", "nha-trang", 12.2415, 109.1970, "Dọc đường Trần Phú, Nha Trang", null, new[] { "Bãi biển Trần Phú", "Đường Trần Phú Nha Trang", "Biển Nha Trang" }, null, 2),
            new("vinwonders-nha-trang", "VinWonders Nha Trang", "ThemePark", "56", "nha-trang", 12.2198, 109.2435, "Đảo Hòn Tre, Vĩnh Nguyên, Nha Trang", null, new[] { "Vinpearl Nha Trang", "VinWonders", "Hòn Tre" }, null, 3),

            // Phú Quốc (91)
            new("cho-dem-phu-quoc", "Chợ Đêm Phú Quốc", "NightMarket", "91", "phu-quoc", 10.2185, 103.9610, "Đường Bạch Đằng, Dương Đông, Phú Quốc", null, new[] { "Chợ Đêm Dương Đông", "Chợ Đêm Phú Quốc" }, null, 1),
            new("san-bay-phu-quoc", "Sân bay Quốc tế Phú Quốc", "Airport", "91", "phu-quoc", 10.1698, 103.9930, "Xã Dương Tơ, Phú Quốc", null, new[] { "Sân bay Phú Quốc", "PQC", "Phu Quoc Airport" }, null, 2),
            new("grand-world-phu-quoc", "Grand World Phú Quốc (Thành phố không ngủ)", "ThemePark", "91", "phu-quoc", 10.3235, 103.8580, "Gành Dầu, Phú Quốc", null, new[] { "Grand World", "Thành phố không ngủ", "Vinpearl Phú Quốc" }, null, 3),
            new("bai-sao-phu-quoc", "Bãi Sao Phú Quốc", "Beach", "91", "phu-quoc", 10.0553, 104.0326, "An Thới, Phú Quốc", null, new[] { "Bãi Sao", "Biển Bãi Sao" }, null, 4),

            // Sa Pa (10)
            new("dinh-fansipan", "Đỉnh Fansipan", "Heritage", "10", "sa-pa", 22.3033, 103.7753, "Sa Pa, Lào Cai", null, new[] { "Fansipan", "Nóc nhà Đông Dương", "Cáp treo Fansipan" }, null, 1),
            new("nha-tho-da-sa-pa", "Nhà Thờ Đá Sa Pa", "CityCenter", "10", "sa-pa", 22.3354, 103.8427, "Trung tâm Sa Pa, Lào Cai", null, new[] { "Nhà Thờ Đá", "Nhà thờ Sa Pa", "Quảng trường Sa Pa" }, null, 2),

            // Hạ Long (22)
            new("bai-chay-ha-long", "Bãi Cháy Hạ Long", "Beach", "22", "ha-long", 20.9575, 107.0392, "Bãi Cháy, TP. Hạ Long, Quảng Ninh", null, new[] { "Bãi Cháy", "Bãi biển Bãi Cháy", "Sun World Hạ Long" }, null, 1),
            new("vinh-ha-long", "Vịnh Hạ Long", "Heritage", "22", "ha-long", 20.9101, 107.1839, "TP. Hạ Long, Quảng Ninh", null, new[] { "Vịnh Hạ Long", "Ha Long Bay", "Cảng tàu khách quốc tế Hạ Long" }, null, 2),
            new("dao-tuan-chau", "Đảo Tuần Châu", "Beach", "22", "ha-long", 20.9298, 106.9922, "Tuần Châu, TP. Hạ Long, Quảng Ninh", null, new[] { "Tuần Châu", "Cảng Tuần Châu" }, null, 3),

            // Phan Thiết - Mũi Né (60)
            new("doi-cat-bay-mui-ne", "Đồi Cát Bay Mũi Né", "Heritage", "60", "phan-thiet-mui-ne", 10.9436, 108.2868, "Khu phố 5, Mũi Né, TP. Phan Thiết", null, new[] { "Đồi Cát Bay", "Đồi Cát Đỏ", "Đồi Cát Mũi Né" }, null, 1),

            // Quy Nhơn (52)
            new("eo-gio-quy-nhon", "Eo Gió Quy Nhơn", "Beach", "52", "quy-nhon", 13.9242, 109.2882, "Xã Nhơn Lý, TP. Quy Nhơn, Bình Định", null, new[] { "Eo Gió", "Kỳ Co - Eo Gió" }, null, 1)
        };

        foreach (var l in rawLandmarks)
        {
            var normalizedName = VietnameseTextNormalizer.Normalize(l.Name);
            var item = new LandmarkDto(
                l.Slug,
                l.Name,
                l.Category,
                l.ProvinceCode,
                l.TouristZoneSlug,
                l.Latitude,
                l.Longitude,
                l.Address,
                normalizedName,
                l.Aliases,
                l.WardCode,
                l.PopularSearchRank);

            _landmarks.Add(item);
            _landmarksBySlug[item.Slug] = item;
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
