using System;
using System.Buffers;
using System.Collections.Generic;
using System.Linq;
using HotelSaas.Application.Public.DTOs;
using HotelSaas.Domain.Entities;
using HotelSaas.Domain.Enums;

namespace HotelSaas.Application.Common.Utils;

/// <summary>
/// Result container for a scored property search match.
/// </summary>
public sealed record PropertyMatchResult(
    Property Property,
    int Score,
    string BestField,
    int NameScore,
    int CityScore,
    int AddressScore);

/// <summary>
/// Result container for a scored public property DTO search match.
/// </summary>
public sealed record PublicPropertyMatchResult(
    PublicPropertyDto Property,
    int Score,
    string BestField,
    int NameScore,
    int CityScore,
    int AddressScore);

/// <summary>
/// Isolated pure C# fuzzy property matcher and relevance ranker.
/// Implements bounded typo-tolerant matching using restricted Damerau-Levenshtein (OSA) distance,
/// multi-token scoring, condensed matching, and deterministic native .NET tie-breaking.
/// </summary>
public static class FuzzyPropertyMatcher
{
    private static readonly char[] Delimiters = new[]
    {
        ' ', '\t', '\r', '\n', ',', '.', '-', '_', '/', '\\', '+'
    };

    /// <summary>
    /// Computes the Optimal String Alignment (OSA) distance (restricted Damerau-Levenshtein distance),
    /// which allows insertion, deletion, substitution, and transposition of two adjacent characters.
    /// Memory allocation uses three rolling rows sized to the shorter input plus one.
    /// Small allocations use stackalloc; longer allocations rent from ArrayPool and return in finally.
    /// </summary>
    public static int OsaDistance(string? s1, string? s2)
    {
        if (s1 == null) return s2?.Length ?? 0;
        if (s2 == null) return s1.Length;
        if (string.Equals(s1, s2, StringComparison.Ordinal)) return 0;

        int l1 = s1.Length;
        int l2 = s2.Length;

        if (l1 == 0) return l2;
        if (l2 == 0) return l1;

        string str1 = s1;
        string str2 = s2;
        if (l1 < l2)
        {
            str1 = s2;
            str2 = s1;
        }

        int len1 = str1.Length;
        int len2 = str2.Length;

        int width = checked(len2 + 1);
        int totalCells = checked(3 * width);

        int[]? rented = null;
        Span<int> buffer = totalCells <= 512
            ? stackalloc int[totalCells]
            : (rented = ArrayPool<int>.Shared.Rent(totalCells)).AsSpan(0, totalCells);

        try
        {
            for (int j = 0; j <= len2; j++)
            {
                buffer[j] = j;
            }

            for (int i = 1; i <= len1; i++)
            {
                int currOffset = (i % 3) * width;
                int prev1Offset = ((i + 2) % 3) * width;
                int prev2Offset = ((i + 1) % 3) * width;

                buffer[currOffset] = i;

                char c1 = str1[i - 1];

                for (int j = 1; j <= len2; j++)
                {
                    char c2 = str2[j - 1];
                    int cost = c1 == c2 ? 0 : 1;

                    int del = buffer[prev1Offset + j] + 1;
                    int ins = buffer[currOffset + (j - 1)] + 1;
                    int sub = buffer[prev1Offset + (j - 1)] + cost;

                    int min = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);

                    if (i > 1 && j > 1 && c1 == str2[j - 2] && str1[i - 2] == c2)
                    {
                        int trans = buffer[prev2Offset + (j - 2)] + 1;
                        if (trans < min) min = trans;
                    }

                    buffer[currOffset + j] = min;
                }
            }

            return buffer[(len1 % 3) * width + len2];
        }
        finally
        {
            if (rented != null)
            {
                ArrayPool<int>.Shared.Return(rented);
            }
        }
    }

    /// <summary>
    /// Splits normalized text into tokens using standard delimiters without empty entries.
    /// </summary>
    public static string[] Tokenize(string? normalizedStr)
    {
        if (string.IsNullOrEmpty(normalizedStr)) return Array.Empty<string>();
        return normalizedStr.Split(Delimiters, StringSplitOptions.RemoveEmptyEntries);
    }

    /// <summary>
    /// Combines tokens into a contiguous condensed string without whitespace or delimiters.
    /// </summary>
    public static string Condense(string[]? tokens)
    {
        if (tokens == null || tokens.Length == 0) return string.Empty;
        return string.Concat(tokens);
    }

    /// <summary>
    /// Computes the allowed typo budget for a query token based on its length.
    /// len &lt;= 2: 0 budget; len 3..5: 1 budget; len &gt;= 6: 2 budget.
    /// </summary>
    public static int TokenBudget(string queryToken)
    {
        if (string.IsNullOrEmpty(queryToken)) return 0;
        int len = queryToken.Length;
        if (len <= 2) return 0;
        if (len <= 5) return 1;
        return 2;
    }

    /// <summary>
    /// Computes effective distance for a query token against a target token.
    /// For short query tokens (len &lt;= 2), if the target token starts with query, distance is 0.
    /// Otherwise returns OSA distance.
    /// </summary>
    public static int EffectiveDistance(string q, string t)
    {
        if (string.IsNullOrEmpty(q)) return string.IsNullOrEmpty(t) ? 0 : t.Length;
        if (string.IsNullOrEmpty(t)) return q.Length;

        if (q.Length <= 2 && t.StartsWith(q, StringComparison.Ordinal))
        {
            return 0;
        }

        return OsaDistance(q, t);
    }

    /// <summary>
    /// Finds the minimum effective distance between a query token and an array of target tokens.
    /// Returns int.MaxValue if targetTokens is null or empty.
    /// </summary>
    public static int BestDistance(string q, string[]? targetTokens)
    {
        if (targetTokens == null || targetTokens.Length == 0) return int.MaxValue;
        int min = int.MaxValue;
        foreach (var t in targetTokens)
        {
            int dist = EffectiveDistance(q, t);
            if (dist < min) min = dist;
            if (min == 0) break;
        }
        return min;
    }

    /// <summary>
    /// Computes fuzzy relevance score (0..100) for a single field against raw query.
    /// </summary>
    public static int ScoreField(string? rawQuery, string? rawField)
    {
        if (string.IsNullOrEmpty(rawField)) return 0;
        string qNorm = VietnameseTextNormalizer.Normalize(rawQuery);
        string fNorm = VietnameseTextNormalizer.Normalize(rawField);
        if (string.IsNullOrEmpty(qNorm)) return 0;

        if (fNorm.Equals(qNorm, StringComparison.Ordinal)) return 100;
        if (fNorm.StartsWith(qNorm, StringComparison.Ordinal)) return 90;
        if (fNorm.Contains(qNorm, StringComparison.Ordinal)) return 80;

        string[] qTokens = Tokenize(qNorm);
        string[] fTokens = Tokenize(fNorm);
        string qCondensed = Condense(qTokens);
        string fCondensed = Condense(fTokens);

        if (qTokens.Length == 0) return 0;

        if (qTokens.Length >= 2)
        {
            bool allExact = true;
            foreach (var q in qTokens)
            {
                if (BestDistance(q, fTokens) != 0)
                {
                    allExact = false;
                    break;
                }
            }
            if (allExact) return 75;
        }

        bool tokenTier1 = true;
        foreach (var q in qTokens)
        {
            int bd = BestDistance(q, fTokens);
            if (q.Length <= 2)
            {
                if (bd != 0) { tokenTier1 = false; break; }
            }
            else
            {
                if (bd > 1) { tokenTier1 = false; break; }
            }
        }

        bool condensedTier1 = false;
        if (qTokens.Length == 1 && qCondensed.Length >= 4 && fCondensed.Length > 0)
        {
            if (OsaDistance(qCondensed, fCondensed) <= 1)
            {
                condensedTier1 = true;
            }
        }

        if (tokenTier1 || condensedTier1) return 60;

        bool tokenTier2 = false;
        bool allWithinBudget = true;
        bool hasDist2LongToken = false;
        foreach (var q in qTokens)
        {
            int bd = BestDistance(q, fTokens);
            int b = TokenBudget(q);
            if (bd > b)
            {
                allWithinBudget = false;
                break;
            }
            if (q.Length >= 6 && bd == 2)
            {
                hasDist2LongToken = true;
            }
        }
        if (allWithinBudget && hasDist2LongToken)
        {
            tokenTier2 = true;
        }

        bool condensedTier2 = false;
        if (qTokens.Length == 1 && qCondensed.Length >= 6 && fCondensed.Length > 0)
        {
            if (OsaDistance(qCondensed, fCondensed) == 2)
            {
                condensedTier2 = true;
            }
        }

        if (tokenTier2 || condensedTier2) return 50;

        return 0;
    }

    /// <summary>
    /// Computes match score and field breakdown for a property across Name, City, Address, and optional TouristZone / Landmarks.
    /// </summary>
    public static (int Score, string BestField, int NameScore, int CityScore, int AddressScore) ScoreProperty(
        string? rawQuery, string? name, string? city, string? address, string? touristZone = null, string? landmarks = null)
    {
        int scoreName = ScoreField(rawQuery, name);
        int scoreCity = ScoreField(rawQuery, city);
        int scoreAddress = ScoreField(rawQuery, address);
        int scoreZone = ScoreField(rawQuery, touristZone);
        int scoreLandmarks = ScoreField(rawQuery, landmarks);

        int maxScore = Math.Max(scoreName, Math.Max(scoreCity, Math.Max(scoreAddress, Math.Max(scoreZone, scoreLandmarks))));
        string bestField = "None";
        if (maxScore == scoreName && maxScore > 0) bestField = "Name";
        else if (maxScore == scoreZone && maxScore > 0) bestField = "TouristZone";
        else if (maxScore == scoreLandmarks && maxScore > 0) bestField = "Landmarks";
        else if (maxScore == scoreCity && maxScore > 0) bestField = "City";
        else if (maxScore == scoreAddress && maxScore > 0) bestField = "Address";

        return (maxScore, bestField, scoreName, scoreCity, scoreAddress);
    }

    /// <summary>
    /// Computes match score and field breakdown for a property across Name, City, Address.
    /// Preserved for backward compatibility.
    /// </summary>
    public static (int Score, string BestField, int NameScore, int CityScore, int AddressScore) ScoreProperty(
        string? rawQuery, string? name, string? city, string? address)
        => ScoreProperty(rawQuery, name, city, address, null, null);

    /// <summary>
    /// Deterministic tie-breaking comparator for properties:
    /// Name ASC (native StringComparer.OrdinalIgnoreCase), then Id ASC (native Guid.CompareTo).
    /// </summary>
    public static int CompareProperties(Property a, Property b)
    {
        if (ReferenceEquals(a, b)) return 0;
        if (a is null) return -1;
        if (b is null) return 1;

        int nameCmp = StringComparer.OrdinalIgnoreCase.Compare(a.Name, b.Name);
        if (nameCmp != 0) return nameCmp;
        return a.Id.CompareTo(b.Id);
    }

    /// <summary>
    /// Searches and scores Active properties using fuzzy typo tolerance contract.
    /// Handles blank query and normalized-empty query bypasses.
    /// Sorts results deterministically: Score DESC, Name ASC (OrdinalIgnoreCase), Id ASC (Guid.CompareTo).
    /// </summary>
    public static List<PropertyMatchResult> SearchProperties(string? query, IEnumerable<Property>? properties)
    {
        if (properties == null) return new List<PropertyMatchResult>();

        if (string.IsNullOrWhiteSpace(query))
        {
            return properties
                .Where(p => p.Status == PropertyStatus.Active)
                .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(p => p.Id)
                .Select(p => new PropertyMatchResult(p, 0, "None", 0, 0, 0))
                .ToList();
        }

        string qNorm = VietnameseTextNormalizer.Normalize(query);
        if (string.IsNullOrEmpty(qNorm))
        {
            return properties
                .Where(p => p.Status == PropertyStatus.Active)
                .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(p => p.Id)
                .Select(p => new PropertyMatchResult(p, 0, "None", 0, 0, 0))
                .ToList();
        }

        var results = new List<PropertyMatchResult>();
        foreach (var p in properties)
        {
            if (p.Status != PropertyStatus.Active) continue;

            var (score, bestField, sName, sCity, sAddress) = ScoreProperty(query, p.Name, p.City, p.Address);
            if (score > 0)
            {
                results.Add(new PropertyMatchResult(p, score, bestField, sName, sCity, sAddress));
            }
        }

        results.Sort((a, b) =>
        {
            int scoreCmp = b.Score.CompareTo(a.Score);
            if (scoreCmp != 0) return scoreCmp;

            int nameCmp = StringComparer.OrdinalIgnoreCase.Compare(a.Property.Name, b.Property.Name);
            if (nameCmp != 0) return nameCmp;

            return a.Property.Id.CompareTo(b.Property.Id);
        });

        return results;
    }

    /// <summary>
    /// Deterministic tie-breaking comparator for public property DTOs:
    /// Name ASC (native StringComparer.OrdinalIgnoreCase), then Id ASC (native Guid.CompareTo).
    /// </summary>
    public static int CompareProperties(PublicPropertyDto a, PublicPropertyDto b)
    {
        if (ReferenceEquals(a, b)) return 0;
        if (a is null) return -1;
        if (b is null) return 1;

        int nameCmp = StringComparer.OrdinalIgnoreCase.Compare(a.Name, b.Name);
        if (nameCmp != 0) return nameCmp;
        return a.Id.CompareTo(b.Id);
    }

    /// <summary>
    /// Searches and scores public property DTOs using fuzzy typo tolerance contract.
    /// Handles blank query and normalized-empty query bypasses.
    /// Sorts results deterministically: Score DESC, Name ASC (OrdinalIgnoreCase), Id ASC (Guid.CompareTo).
    /// </summary>
    public static List<PublicPropertyMatchResult> SearchProperties(string? query, IEnumerable<PublicPropertyDto>? properties)
    {
        if (properties == null) return new List<PublicPropertyMatchResult>();

        if (string.IsNullOrWhiteSpace(query))
        {
            return properties
                .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(p => p.Id)
                .Select(p => new PublicPropertyMatchResult(p, 0, "None", 0, 0, 0))
                .ToList();
        }

        string qNorm = VietnameseTextNormalizer.Normalize(query);
        if (string.IsNullOrEmpty(qNorm))
        {
            return properties
                .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ThenBy(p => p.Id)
                .Select(p => new PublicPropertyMatchResult(p, 0, "None", 0, 0, 0))
                .ToList();
        }

        var results = new List<PublicPropertyMatchResult>();
        foreach (var p in properties)
        {
            var landmarksText = p.NearbyLandmarks != null && p.NearbyLandmarks.Count > 0
                ? string.Join(", ", p.NearbyLandmarks.Select(l => l.Name))
                : null;
            var (score, bestField, sName, sCity, sAddress) = ScoreProperty(query, p.Name, p.City, p.Address, p.TouristZoneName, landmarksText);
            if (score > 0)
            {
                results.Add(new PublicPropertyMatchResult(p, score, bestField, sName, sCity, sAddress));
            }
        }

        results.Sort((a, b) =>
        {
            int scoreCmp = b.Score.CompareTo(a.Score);
            if (scoreCmp != 0) return scoreCmp;

            int nameCmp = StringComparer.OrdinalIgnoreCase.Compare(a.Property.Name, b.Property.Name);
            if (nameCmp != 0) return nameCmp;

            return a.Property.Id.CompareTo(b.Property.Id);
        });

        return results;
    }
}
