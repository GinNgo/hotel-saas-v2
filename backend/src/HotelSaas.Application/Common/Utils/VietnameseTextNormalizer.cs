using System;
using System.Globalization;
using System.Text;

namespace HotelSaas.Application.Common.Utils;

/// <summary>
/// Utility for canonical Vietnamese text normalization and diacritics-insensitive matching.
/// Correctly handles NFC/NFD decomposition, non-spacing combining marks, and Vietnamese-specific characters (đ/Đ).
/// </summary>
public static class VietnameseTextNormalizer
{
    /// <summary>
    /// Normalizes Vietnamese text by replacing đ/Đ with d, decomposing combining diacritical marks,
    /// stripping non-spacing marks, and converting to lowercase invariant for uniform matching.
    /// Handles both precomposed (NFC) and decomposed (NFD) inputs.
    /// </summary>
    public static string Normalize(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        // 1. Explicitly replace Vietnamese Latin characters with stroke: đ -> d, Đ -> d
        var preprocessed = text
            .Replace('đ', 'd')
            .Replace('Đ', 'd');

        // 2. Normalize to FormD (Canonical Decomposition: separate base characters from combining diacritics)
        var decomposed = preprocessed.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(decomposed.Length);

        // 3. Filter out combining diacritical marks (tones, accents, circumflexes, breves, hooks)
        foreach (var c in decomposed)
        {
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category != UnicodeCategory.NonSpacingMark)
            {
                builder.Append(c);
            }
        }

        // 4. Return canonical FormC, lowercase invariant, trimmed string
        return builder
            .ToString()
            .Normalize(NormalizationForm.FormC)
            .ToLowerInvariant()
            .Trim();
    }

    /// <summary>
    /// Determines whether the <paramref name="source"/> text contains the <paramref name="search"/> text,
    /// ignoring case, diacritics, and Unicode canonical composition differences.
    /// Returns true if <paramref name="search"/> is null, empty, or whitespace.
    /// </summary>
    public static bool Matches(string? source, string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(source))
        {
            return false;
        }

        var normalizedSearch = Normalize(search);
        if (normalizedSearch.Length == 0)
        {
            return true;
        }

        var normalizedSource = Normalize(source);
        return normalizedSource.Contains(normalizedSearch, StringComparison.Ordinal);
    }

    /// <summary>
    /// Determines whether the <paramref name="source"/> text contains the already-normalized search term,
    /// avoiding redundant normalization of the search query across multiple fields and items.
    /// </summary>
    public static bool MatchesNormalized(string? source, string normalizedSearch)
    {
        if (string.IsNullOrEmpty(normalizedSearch))
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(source))
        {
            return false;
        }

        var normalizedSource = Normalize(source);
        return normalizedSource.Contains(normalizedSearch, StringComparison.Ordinal);
    }
}
