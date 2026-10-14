using System;
using System.Text;
using HotelSaas.Application.Common.Utils;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

public sealed class VietnameseTextNormalizerTests
{
    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("   ", "")]
    [InlineData("\t\n", "")]
    public void Normalize_NullOrWhitespace_ReturnsEmpty(string? input, string expected)
    {
        var result = VietnameseTextNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Khách sạn Sài Gòn Central", "khach san sai gon central")]
    [InlineData("Đà Nẵng", "da nang")]
    [InlineData("ĐÀ NẴNG", "da nang")]
    [InlineData("đắk lắk", "dak lak")]
    [InlineData("ĐỒNG NAI", "dong nai")]
    [InlineData("Hồ Chí Minh", "ho chi minh")]
    [InlineData("Phú Quốc", "phu quoc")]
    [InlineData("Vũng Tàu", "vung tau")]
    [InlineData("Nha Trang", "nha trang")]
    [InlineData("Cần Thơ", "can tho")]
    [InlineData("Huế", "hue")]
    public void Normalize_VietnameseCharactersAndTones_NormalizesCorrectly(string input, string expected)
    {
        var result = VietnameseTextNormalizer.Normalize(input);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Normalize_DecomposedNfdUnicode_ProducesSameCanonicalOutputAsNfc()
    {
        var composedNfc = "Khách sạn Sài Gòn";
        var decomposedNfd = composedNfc.Normalize(NormalizationForm.FormD);

        // Ensure test verifies actual decomposed representation
        Assert.NotEqual(composedNfc, decomposedNfd);

        var resultFromNfc = VietnameseTextNormalizer.Normalize(composedNfc);
        var resultFromNfd = VietnameseTextNormalizer.Normalize(decomposedNfd);

        Assert.Equal("khach san sai gon", resultFromNfc);
        Assert.Equal("khach san sai gon", resultFromNfd);
        Assert.Equal(resultFromNfc, resultFromNfd);
    }

    [Theory]
    [InlineData("Khách sạn Sài Gòn Central", "sai gon", true)]
    [InlineData("Khách sạn Sài Gòn Central", "SÀI GÒN", true)]
    [InlineData("Khách sạn Sài Gòn Central", "Sài Gòn", true)]
    [InlineData("Khách sạn Sài Gòn Central", "khach san", true)]
    [InlineData("Khách sạn Sài Gòn Central", "central", true)]
    [InlineData("Khách sạn Sài Gòn Central", "Hà Nội", false)]
    [InlineData("Khách sạn Sài Gòn Central", "Đà Nẵng", false)]
    public void Matches_NameSearch_MatchesDiacriticsAndCase(string source, string search, bool expected)
    {
        var result = VietnameseTextNormalizer.Matches(source, search);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "le loi", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "LÊ LỢI", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "ben thanh", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "BẾN THÀNH", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "quan 1", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "ho chi minh", true)]
    [InlineData("123 Lê Lợi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh", "quận 7", false)]
    public void Matches_AddressSearch_MatchesSubstringsCorrectly(string source, string search, bool expected)
    {
        var result = VietnameseTextNormalizer.Matches(source, search);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Đà Nẵng", "da nang", true)]
    [InlineData("Đà Nẵng", "ĐÀ NẴNG", true)]
    [InlineData("Đà Nẵng", "đà nẵng", true)]
    [InlineData("TP. Hồ Chí Minh", "ho chi minh", true)]
    [InlineData("TP. Hồ Chí Minh", "HỒ CHÍ MINH", true)]
    [InlineData("Hà Nội", "ha noi", true)]
    [InlineData("Hà Nội", "HÀ NỘI", true)]
    public void Matches_CitySearch_HandlesLatinWithStrokeAndAccents(string source, string search, bool expected)
    {
        var result = VietnameseTextNormalizer.Matches(source, search);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Khách sạn Biển Đông", null, true)]
    [InlineData("Khách sạn Biển Đông", "", true)]
    [InlineData("Khách sạn Biển Đông", "   ", true)]
    [InlineData(null, "bien dong", false)]
    [InlineData("", "bien dong", false)]
    public void Matches_EdgeCases_NullOrWhitespaceHandledSafely(string? source, string? search, bool expected)
    {
        var result = VietnameseTextNormalizer.Matches(source, search);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData("Khách sạn Sài Gòn Central", "sai gon", true)]
    [InlineData("Khách sạn Sài Gòn Central", "da nang", false)]
    [InlineData("Đà Nẵng", "da nang", true)]
    [InlineData(null, "da nang", false)]
    [InlineData("Đà Nẵng", "", true)]
    public void MatchesNormalized_WithPreNormalizedQuery_MatchesAccurately(string? source, string normalizedQuery, bool expected)
    {
        var result = VietnameseTextNormalizer.MatchesNormalized(source, normalizedQuery);
        Assert.Equal(expected, result);
    }
}
