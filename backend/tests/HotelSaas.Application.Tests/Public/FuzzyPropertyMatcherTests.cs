using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using HotelSaas.Application.Common.Utils;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;
using Xunit;

namespace HotelSaas.Application.Tests.Public;

public sealed class FuzzyPropertyMatcherTests
{
    private static readonly Guid P1 = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid P2 = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid P3 = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid P4 = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid P5 = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid P6 = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly Guid P7 = Guid.Parse("77777777-7777-7777-7777-777777777777");
    private static readonly Guid P2_TIE = Guid.Parse("88888888-8888-8888-8888-888888888888");

    private static readonly List<Property> SampleProperties = new()
    {
        new Property
        {
            Id = P1,
            Name = "Khách Sạn Biển Đông Đà Nẵng",
            City = "Đà Nẵng",
            Address = "200 Võ Nguyên Giáp, Quận Sơn Trà",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P2,
            Name = "Khách Sạn Central Đà Nẵng",
            City = "Đà Nẵng",
            Address = "50 Nguyễn Văn Linh, Quận Hải Châu",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P3,
            Name = "Khách Sạn Sài Gòn Central",
            City = "TP. Hồ Chí Minh",
            Address = "123 Lê Lợi, Phường Bến Thành, Quận 1",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P4,
            Name = "Khách Sạn Hà Nội Horizon",
            City = "Hà Nội",
            Address = "40 Cát Linh, Quận Đống Đa",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P5,
            Name = "Khách Sạn Hạ Long Bay",
            City = "Quảng Ninh",
            Address = "88 Hạ Long, Bãi Cháy",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P6,
            Name = "Khách Sạn Phú Quốc Sunset Resort",
            City = "Kiên Giang",
            Address = "Bãi Trường, Dương Tơ",
            Status = PropertyStatus.Inactive
        },
        new Property
        {
            Id = P7,
            Name = "Khách Sạn Nha Trang Pearl",
            City = "Nha Trang",
            Address = "12 Trần Phú, Phường Lộc Thọ",
            Status = PropertyStatus.Active
        },
        new Property
        {
            Id = P2_TIE,
            Name = "Khách Sạn Central Đà Nẵng",
            City = "Đà Nẵng",
            Address = "100 Bạch Đằng, Quận Hải Châu",
            Status = PropertyStatus.Active
        }
    };

    [Fact]
    public void OsaDistance_CentxralzToDa_IsExactly8()
    {
        int dist = FuzzyPropertyMatcher.OsaDistance("centxralz", "da");
        Assert.Equal(8, dist);
    }

    [Fact]
    public void OsaDistance_CentxralzToNang_IsExactly7()
    {
        int dist = FuzzyPropertyMatcher.OsaDistance("centxralz", "nang");
        Assert.Equal(7, dist);
    }

    [Fact]
    public void OsaDistance_CentxralzToChau_IsExactly7()
    {
        int dist = FuzzyPropertyMatcher.OsaDistance("centxralz", "chau");
        Assert.Equal(7, dist);
    }

    [Fact]
    public void OsaDistance_CentxralzToCentral_IsExactly2()
    {
        int dist = FuzzyPropertyMatcher.OsaDistance("centxralz", "central");
        Assert.Equal(2, dist);
    }

    [Fact]
    public void Trace_CentxralzAcrossFieldsOfP2_ReturnsScore50OnName()
    {
        var p2Prop = SampleProperties.First(p => p.Id == P2);
        var nameTokens = FuzzyPropertyMatcher.Tokenize(VietnameseTextNormalizer.Normalize(p2Prop.Name));
        var cityTokens = FuzzyPropertyMatcher.Tokenize(VietnameseTextNormalizer.Normalize(p2Prop.City));
        var addrTokens = FuzzyPropertyMatcher.Tokenize(VietnameseTextNormalizer.Normalize(p2Prop.Address));

        int bestName = FuzzyPropertyMatcher.BestDistance("centxralz", nameTokens);
        int bestCity = FuzzyPropertyMatcher.BestDistance("centxralz", cityTokens);
        int bestAddr = FuzzyPropertyMatcher.BestDistance("centxralz", addrTokens);

        Assert.Equal(2, bestName);
        Assert.Equal(7, bestCity);
        Assert.Equal(7, bestAddr);

        var (score, bestField, sName, sCity, sAddr) = FuzzyPropertyMatcher.ScoreProperty(
            "centxralz", p2Prop.Name, p2Prop.City, p2Prop.Address);

        Assert.Equal(50, score);
        Assert.Equal("Name", bestField);
        Assert.Equal(50, sName);
        Assert.Equal(0, sCity);
        Assert.Equal(0, sAddr);
    }

    [Fact]
    public void OsaDistance_NhxtranggToNhatrang_IsExactly2()
    {
        int dist = FuzzyPropertyMatcher.OsaDistance("nhxtrangg", "nhatrang");
        Assert.Equal(2, dist);
    }

    [Fact]
    public void SaiGonQuery_MatchesP3NameScore80_AndDoesNotMatchP3City()
    {
        var p3Prop = SampleProperties.First(p => p.Id == P3);
        int scoreName = FuzzyPropertyMatcher.ScoreField("Sài Gòn", p3Prop.Name);
        int scoreCity = FuzzyPropertyMatcher.ScoreField("Sài Gòn", p3Prop.City);

        Assert.Equal(80, scoreName);
        Assert.Equal(0, scoreCity);
    }

    [Fact]
    public void Normalize_U1AB0_NonSpacingMarkStrippedToA()
    {
        string normalized = VietnameseTextNormalizer.Normalize("a\u1ab0");
        Assert.Equal("a", normalized);
    }

    [Fact]
    public void Normalize_IsolatedCombiningAcute_ReturnsEmptyString()
    {
        string normalized = VietnameseTextNormalizer.Normalize("\u0301");
        Assert.Equal(string.Empty, normalized);
    }

    [Fact]
    public void Normalize_DWithStroke_BothCasesMapToD()
    {
        Assert.Equal("d", VietnameseTextNormalizer.Normalize("đ"));
        Assert.Equal("d", VietnameseTextNormalizer.Normalize("Đ"));
    }

    [Fact]
    public void CompareProperties_GreekEquivalentNames_ResolvedByGuidTieBreak()
    {
        var pGreekA = new Property
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "\u1F80 Hotel",
            Status = PropertyStatus.Active
        };
        var pGreekB = new Property
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Name = "\u1F88 Hotel",
            Status = PropertyStatus.Active
        };

        Assert.Equal(0, StringComparer.OrdinalIgnoreCase.Compare(pGreekA.Name, pGreekB.Name));

        int cmpAB = FuzzyPropertyMatcher.CompareProperties(pGreekA, pGreekB);
        int cmpBA = FuzzyPropertyMatcher.CompareProperties(pGreekB, pGreekA);

        Assert.True(cmpAB < 0);
        Assert.True(cmpBA > 0);

        var searchResults = FuzzyPropertyMatcher.SearchProperties("Hotel", new[] { pGreekB, pGreekA });
        Assert.Equal(2, searchResults.Count);
        Assert.Equal(pGreekA.Id, searchResults[0].Property.Id);
        Assert.Equal(pGreekB.Id, searchResults[1].Property.Id);
    }

    [Fact]
    public void CompareProperties_StrasseVsSTRASSE_ResolvedByNameWithoutGuidTieBreak()
    {
        var pStrasse = new Property
        {
            Id = Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name = "Straße Hotel",
            Status = PropertyStatus.Active
        };
        var pStrasseUpper = new Property
        {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Name = "STRASSE Hotel",
            Status = PropertyStatus.Active
        };

        int nameCmp = StringComparer.OrdinalIgnoreCase.Compare(pStrasse.Name, pStrasseUpper.Name);
        Assert.True(nameCmp > 0);

        int cmp = FuzzyPropertyMatcher.CompareProperties(pStrasse, pStrasseUpper);
        Assert.True(cmp > 0);

        var searchResults = FuzzyPropertyMatcher.SearchProperties("Hotel", new[] { pStrasse, pStrasseUpper });
        Assert.Equal(2, searchResults.Count);
        Assert.Equal(pStrasseUpper.Id, searchResults[0].Property.Id);
        Assert.Equal(pStrasse.Id, searchResults[1].Property.Id);
    }

    [Theory]
    [InlineData("00000001-0000-0000-0000-000000000000", "00000100-0000-0000-0000-000000000000")]
    [InlineData("00000000-0001-0000-0000-000000000000", "00000000-0100-0000-0000-000000000000")]
    [InlineData("00000000-0000-0001-0000-000000000000", "00000000-0000-0100-0000-000000000000")]
    [InlineData("00000000-0000-0000-0001-000000000000", "00000000-0000-0000-0100-000000000000")]
    [InlineData("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000010")]
    public void CompareProperties_AsciiCaseTies_ResolvedByAsymmetricGuidGroups(string guidStrA, string guidStrB)
    {
        var pA = new Property
        {
            Id = Guid.Parse(guidStrA),
            Name = "Hotel Central",
            Status = PropertyStatus.Active
        };
        var pB = new Property
        {
            Id = Guid.Parse(guidStrB),
            Name = "HOTEL CENTRAL",
            Status = PropertyStatus.Active
        };

        Assert.Equal(0, StringComparer.OrdinalIgnoreCase.Compare(pA.Name, pB.Name));

        int cmp = FuzzyPropertyMatcher.CompareProperties(pA, pB);
        Assert.True(cmp < 0);

        var searchResults = FuzzyPropertyMatcher.SearchProperties("Hotel", new[] { pB, pA });
        Assert.Equal(2, searchResults.Count);
        Assert.Equal(pA.Id, searchResults[0].Property.Id);
        Assert.Equal(pB.Id, searchResults[1].Property.Id);
    }

    [Theory]
    [InlineData("Khách Sạn Sài Gòn Central", new[] { "33333333-3333-3333-3333-333333333333" }, new[] { 100 })]
    [InlineData("Khách Sạn Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" }, new[] { 90 })]
    [InlineData("Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" }, new[] { 80 })]
    [InlineData("Central Sài Gòn", new[] { "33333333-3333-3333-3333-333333333333" }, new[] { 75 })]
    [InlineData("central central", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" }, new[] { 75, 75, 75 })]
    [InlineData("danang", new[] { "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" }, new[] { 60, 60, 60 })]
    [InlineData("da nag", new[] { "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" }, new[] { 60, 60, 60 })]
    [InlineData("centraal", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" }, new[] { 60, 60, 60 })]
    [InlineData("Haoni", new[] { "44444444-4444-4444-4444-444444444444" }, new[] { 60 })]
    [InlineData("centxralz", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888", "33333333-3333-3333-3333-333333333333" }, new[] { 50, 50, 50 })]
    [InlineData("nhxtrangg", new[] { "77777777-7777-7777-7777-777777777777" }, new[] { 50 })]
    [InlineData(", -", new string[0], new int[0])]
    [InlineData("Danang xyz", new string[0], new int[0])]
    [InlineData("Central Đà Nẵng", new[] { "22222222-2222-2222-2222-222222222222", "88888888-8888-8888-8888-888888888888" }, new[] { 80, 80 })]
    public void SearchProperties_ApprovedFixtures_MatchesCompleteResultArrays(
        string query, string[] expectedIds, int[] expectedScores)
    {
        var results = FuzzyPropertyMatcher.SearchProperties(query, SampleProperties);

        Assert.Equal(expectedIds.Length, results.Count);

        for (int i = 0; i < expectedIds.Length; i++)
        {
            Assert.Equal(Guid.Parse(expectedIds[i]), results[i].Property.Id);
            Assert.Equal(expectedScores[i], results[i].Score);
        }
    }

    [Fact]
    public void SearchProperties_ShortSubstringHa_MatchesFullCatalogOrder()
    {
        var results = FuzzyPropertyMatcher.SearchProperties("Ha", SampleProperties);

        var expectedIds = new[]
        {
            P4,
            P1,
            P2,
            P2_TIE,
            P5,
            P7,
            P3
        };

        var expectedScores = new[] { 90, 80, 80, 80, 80, 80, 80 };

        Assert.Equal(expectedIds.Length, results.Count);

        for (int i = 0; i < expectedIds.Length; i++)
        {
            Assert.Equal(expectedIds[i], results[i].Property.Id);
            Assert.Equal(expectedScores[i], results[i].Score);
        }

        Assert.DoesNotContain(results, r => r.Property.Id == P6);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\u0301")]
    public void SearchProperties_BlankOrNormalizedEmpty_ReturnsAll7ActivePropertiesInNameAscIdAsc(string query)
    {
        var results = FuzzyPropertyMatcher.SearchProperties(query, SampleProperties);

        var expectedOrder = new[]
        {
            P1,
            P2,
            P2_TIE,
            P4,
            P5,
            P7,
            P3
        };

        Assert.Equal(7, results.Count);

        for (int i = 0; i < expectedOrder.Length; i++)
        {
            Assert.Equal(expectedOrder[i], results[i].Property.Id);
            Assert.Equal(PropertyStatus.Active, results[i].Property.Status);
        }

        Assert.DoesNotContain(results, r => r.Property.Id == P6);
    }

    [Fact]
    public void SearchProperties_NfcAndNfdQueries_ProduceIdenticalOutputs()
    {
        string[] queries = new[]
        {
            "Khách Sạn Sài Gòn Central",
            "Đà Nẵng",
            "Hà Nội",
            "Nha Trang",
            "Biển Đông",
            "Bạch Đằng"
        };

        foreach (var qNfc in queries)
        {
            string qNfd = qNfc.Normalize(NormalizationForm.FormD);

            var resNfc = FuzzyPropertyMatcher.SearchProperties(qNfc, SampleProperties);
            var resNfd = FuzzyPropertyMatcher.SearchProperties(qNfd, SampleProperties);

            Assert.Equal(resNfc.Count, resNfd.Count);

            for (int i = 0; i < resNfc.Count; i++)
            {
                Assert.Equal(resNfc[i].Property.Id, resNfd[i].Property.Id);
                Assert.Equal(resNfc[i].Score, resNfd[i].Score);
            }
        }
    }

    [Fact]
    public void ScoreField_LengthBoundaryThresholds_RejectionAndAcceptance()
    {
        const string target = "Khu du lich bien hoang resort";

        int sLen2Accepted = FuzzyPropertyMatcher.ScoreField("biex du", target);
        int sLen2Rejected = FuzzyPropertyMatcher.ScoreField("biex dx", target);
        Assert.Equal(60, sLen2Accepted);
        Assert.Equal(0, sLen2Rejected);

        int sLen3Accepted = FuzzyPropertyMatcher.ScoreField("bien khx", target);
        int sLen3Rejected = FuzzyPropertyMatcher.ScoreField("bien kxx", target);
        Assert.Equal(60, sLen3Accepted);
        Assert.Equal(0, sLen3Rejected);

        int sLen5Accepted = FuzzyPropertyMatcher.ScoreField("bien hxang", target);
        int sLen5Rejected = FuzzyPropertyMatcher.ScoreField("bien hxxng", target);
        Assert.Equal(60, sLen5Accepted);
        Assert.Equal(0, sLen5Rejected);

        int sLen6Tier1 = FuzzyPropertyMatcher.ScoreField("bien resorx", target);
        int sLen6Tier2 = FuzzyPropertyMatcher.ScoreField("bien rexxrt", target);
        int sLen6Rejected = FuzzyPropertyMatcher.ScoreField("bien rexxxt", target);
        Assert.Equal(60, sLen6Tier1);
        Assert.Equal(50, sLen6Tier2);
        Assert.Equal(0, sLen6Rejected);
    }

    [Fact]
    public void BestDistance_EmptyTargetTokens_ReturnsIntMaxValue()
    {
        int dist = FuzzyPropertyMatcher.BestDistance("query", Array.Empty<string>());
        Assert.Equal(int.MaxValue, dist);
    }

    [Fact]
    public void OsaDistance_RestrictedVsUnrestrictedDamerau_DemonstratesRestrictedSemantics()
    {
        Assert.Equal(1, FuzzyPropertyMatcher.OsaDistance("CA", "AC"));
        Assert.Equal(3, FuzzyPropertyMatcher.OsaDistance("CA", "ABC"));
    }

    [Theory]
    [InlineData("ab", 0)]
    [InlineData("abc", 1)]
    [InlineData("abcde", 1)]
    [InlineData("abcdef", 2)]
    [InlineData("abcdefghij", 2)]
    public void TokenBudget_LengthThresholds_ReturnCorrectBudgets(string token, int expectedBudget)
    {
        Assert.Equal(expectedBudget, FuzzyPropertyMatcher.TokenBudget(token));
    }

    [Fact]
    public void LiteralContains_Punctuation_MatchesIfPresentInTarget()
    {
        int score = FuzzyPropertyMatcher.ScoreField(", -", "Khach San, - Da Nang");
        Assert.Equal(80, score);
    }

    [Fact]
    public void OsaDistance_RepeatAndConcurrentComparisonsAgainstFullMatrixOracle()
    {
        string trans180A = string.Concat(Enumerable.Repeat("abcdef", 30));
        string trans180B = string.Concat(Enumerable.Repeat("abdcfe", 30));

        string mixed180 = string.Concat(Enumerable.Repeat("alpha", 36));
        string mixed210 = string.Concat(Enumerable.Repeat("alpha", 42));

        string mixedEdits175 = string.Concat(Enumerable.Repeat("hotel", 35));
        string mixedEdits192 = string.Concat(Enumerable.Repeat("hoetl", 38)) + "xx";

        var testPairs = new (string S1, string S2)[]
        {
            ("a", "b"),
            ("abc", "acb"),
            ("CA", "ABC"),
            ("centxralz", "central"),
            ("nhxtrangg", "nhatrang"),
            ("Khach San Nghi Duong Cao Cap Bien Dong Da Nang Viet Nam Resort", "Khach San Nghi Duong Cao Cap Bien Dong Da Nang Viet Nam Resorx"),
            ("The quick brown fox jumps over the lazy dog", "The quick brown fox jumped over a lazy dog"),
            (new string('a', 50), new string('b', 50)),
            (new string('x', 70), new string('x', 68) + "yz"),
            ("abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", "badcfehgjilknmporqtsvuxwzy1032547698BADCFEHGJILKNMPORQTSVUXWZY"),
            ("Short", "Very long string exceeding standard threshold and exercising buffer rotation"),
            ("Very long string exceeding standard threshold and exercising buffer rotation", "Short"),
            (new string('a', 175), new string('a', 173) + "ba"),
            (trans180A, trans180B),
            (mixed180, mixed210),
            (mixedEdits175, mixedEdits192)
        };

        for (int iteration = 0; iteration < 5; iteration++)
        {
            foreach (var (s1, s2) in testPairs)
            {
                int actual = FuzzyPropertyMatcher.OsaDistance(s1, s2);
                int expected = FullMatrixOsaDistance(s1, s2);
                Assert.Equal(expected, actual);

                int actualSym = FuzzyPropertyMatcher.OsaDistance(s2, s1);
                Assert.Equal(expected, actualSym);
            }
        }

        Parallel.For(0, 50, _ =>
        {
            foreach (var (s1, s2) in testPairs)
            {
                int actual = FuzzyPropertyMatcher.OsaDistance(s1, s2);
                int expected = FullMatrixOsaDistance(s1, s2);
                Assert.Equal(expected, actual);
            }
        });
    }

    private static int FullMatrixOsaDistance(string s1, string s2)
    {
        int l1 = s1.Length;
        int l2 = s2.Length;
        var d = new int[l1 + 1, l2 + 1];

        for (int i = 0; i <= l1; i++) d[i, 0] = i;
        for (int j = 0; j <= l2; j++) d[0, j] = j;

        for (int i = 1; i <= l1; i++)
        {
            for (int j = 1; j <= l2; j++)
            {
                int cost = s1[i - 1] == s2[j - 1] ? 0 : 1;
                int del = d[i - 1, j] + 1;
                int ins = d[i, j - 1] + 1;
                int sub = d[i - 1, j - 1] + cost;

                int min = Math.Min(del, Math.Min(ins, sub));

                if (i > 1 && j > 1 && s1[i - 1] == s2[j - 2] && s1[i - 2] == s2[j - 1])
                {
                    min = Math.Min(min, d[i - 2, j - 2] + 1);
                }

                d[i, j] = min;
            }
        }

        return d[l1, l2];
    }
}
