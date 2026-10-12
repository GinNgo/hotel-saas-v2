const fs = require('fs');

// 1. Vietnamese Text Normalizer (replicates VietnameseTextNormalizer.cs exactly)
function normalizeVietnamese(text) {
    if (!text || !text.trim()) return "";
    let s = text.replace(/đ/g, 'd').replace(/Đ/g, 'd');
    // Normalize Form D to decompose accents
    s = s.normalize('NFD');
    // Remove ALL Unicode Nonspacing_Mark characters (Unicode category Mn, including U+0300-036F and U+1AB0-1AFF)
    s = s.replace(/\p{Mn}/gu, '');
    // Normalize Form C
    s = s.normalize('NFC');
    // Lowercase invariant and trim
    return s.toLowerCase().trim();
}

// 2. Exact OSA Distance (restricted Damerau-Levenshtein)
function osaDistance(s1, s2) {
    const l1 = s1.length;
    const l2 = s2.length;
    const d = Array.from({length: l1 + 1}, () => Array(l2 + 1).fill(0));
    for (let i = 0; i <= l1; i++) d[i][0] = i;
    for (let j = 0; j <= l2; j++) d[0][j] = j;

    for (let i = 1; i <= l1; i++) {
        for (let j = 1; j <= l2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,        // deletion
                d[i][j - 1] + 1,        // insertion
                d[i - 1][j - 1] + cost   // substitution
            );
            if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
            }
        }
    }
    return d[l1][l2];
}

// 3. Tokenization & Condensed — aligned with C# char[] delimiters
const DELIMITERS = /[ \t\r\n,.\-_/\\+]+/;

function tokenize(normalizedStr) {
    if (!normalizedStr) return [];
    return normalizedStr.split(DELIMITERS).filter(t => t.length > 0);
}

function condense(tokens) {
    return tokens.join('');
}

// 4. Effective distance for query token q and target token t
function effectiveDistance(q, t) {
    if (q.length <= 2 && t.startsWith(q)) {
        return 0;
    }
    return osaDistance(q, t);
}

function bestDistance(q, targetTokens) {
    if (!targetTokens || targetTokens.length === 0) return Infinity;
    let min = Infinity;
    for (const t of targetTokens) {
        const dist = effectiveDistance(q, t);
        if (dist < min) min = dist;
    }
    return min;
}

function tokenBudget(q) {
    if (q.length <= 2) return 0;
    if (q.length <= 5) return 1;
    return 2;
}

// 5. Comparators
// Bounded Offline Approximation (Limited Oracle):
// Replicates simple 1-to-1 character uppercase mapping for ASCII, Vietnamese diacritics, and basic Latin scripts.
// NOTE: This JS comparator is a bounded offline approximation and does NOT claim 100% universal Unicode parity with .NET.
// Full Unicode casing edge cases (e.g., Greek U+1F80 vs U+1F88 = 0 in .NET) differ in JS (-1) due to ECMAScript casing table differences.
// Production backend C# code STRICTLY requires .NET's native StringComparer.OrdinalIgnoreCase.
function charToUpperInvariantCode(code) {
    const ch = String.fromCharCode(code);
    const upper = ch.toUpperCase();
    // In .NET char.ToUpperInvariant, Unicode simple 1-to-1 uppercase mapping is used.
    // Expanding mappings (such as German 'ß' -> "SS") do NOT expand a single char into multiple chars.
    if (upper.length === 1) {
        return upper.charCodeAt(0);
    }
    return code; // Retain original code point when expansion would occur
}

function compareOrdinalIgnoreCaseApprox(a, b) {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ca = charToUpperInvariantCode(a.charCodeAt(i));
        const cb = charToUpperInvariantCode(b.charCodeAt(i));
        if (ca !== cb) {
            return ca < cb ? -1 : 1;
        }
    }
    if (a.length !== b.length) {
        return a.length < b.length ? -1 : 1;
    }
    return 0;
}
const compareOrdinalIgnoreCase = compareOrdinalIgnoreCaseApprox;

// Replicates C# Guid.CompareTo by parsing canonical text groups numerically
function compareGuid(g1, g2) {
    const p1 = g1.split('-');
    const p2 = g2.split('-');

    // Group 1: 32-bit unsigned integer (_a)
    const a1 = parseInt(p1[0], 16);
    const a2 = parseInt(p2[0], 16);
    if (a1 !== a2) return a1 < a2 ? -1 : 1;

    // Group 2: 16-bit unsigned integer (_b)
    const b1 = parseInt(p1[1], 16);
    const b2 = parseInt(p2[1], 16);
    if (b1 !== b2) return b1 < b2 ? -1 : 1;

    // Group 3: 16-bit unsigned integer (_c)
    const c1 = parseInt(p1[2], 16);
    const c2 = parseInt(p2[2], 16);
    if (c1 !== c2) return c1 < c2 ? -1 : 1;

    // Groups 4 and 5: 8 individual bytes (_d through _k) in big-endian hex display order
    const rest1 = p1[3] + p1[4];
    const rest2 = p2[3] + p2[4];
    for (let i = 0; i < 16; i += 2) {
        const byte1 = parseInt(rest1.substring(i, i + 2), 16);
        const byte2 = parseInt(rest2.substring(i, i + 2), 16);
        if (byte1 !== byte2) return byte1 < byte2 ? -1 : 1;
    }
    return 0;
}

// 6. Score a single field
function scoreField(qRaw, fieldRaw) {
    if (!fieldRaw) return 0;
    const qNorm = normalizeVietnamese(qRaw);
    const fNorm = normalizeVietnamese(fieldRaw);
    if (!qNorm) return 0;

    // Literal checks
    if (fNorm === qNorm) return 100;
    if (fNorm.StartsWith ? fNorm.StartsWith(qNorm) : fNorm.startsWith(qNorm)) return 90;
    if (fNorm.includes(qNorm)) return 80;

    const qTokens = tokenize(qNorm);
    const fTokens = tokenize(fNorm);
    const qCondensed = condense(qTokens);
    const fCondensed = condense(fTokens);

    // Token-Empty Guard
    if (qTokens.length === 0) return 0;

    // Score 75: All-tokens exact match (out of order, allow token reuse)
    if (qTokens.length >= 2) {
        let allExact = true;
        for (const q of qTokens) {
            if (bestDistance(q, fTokens) !== 0) {
                allExact = false;
                break;
            }
        }
        if (allExact) return 75;
    }

    // Score 60: TypoTolerantTier1 / Condensed Tier 1 (Independent Alternatives)
    // Alternative 1: Token Tier 1
    let tokenTier1 = true;
    for (const q of qTokens) {
        const bd = bestDistance(q, fTokens);
        if (q.length <= 2) {
            if (bd !== 0) { tokenTier1 = false; break; }
        } else {
            if (bd > 1) { tokenTier1 = false; break; }
        }
    }
    // Alternative 2: Condensed Tier 1 (single query token, len >= 4, dist <= 1)
    let condensedTier1 = false;
    if (qTokens.length === 1 && qCondensed.length >= 4 && fCondensed.length > 0) {
        if (osaDistance(qCondensed, fCondensed) <= 1) {
            condensedTier1 = true;
        }
    }
    if (tokenTier1 || condensedTier1) return 60;

    // Score 50: TypoTolerantTier2 / Condensed Tier 2 (Independent Alternatives)
    // Alternative 1: Token Tier 2
    let tokenTier2 = false;
    let allTokensWithinBudget = true;
    let hasDist2OnLongToken = false;
    for (const q of qTokens) {
        const bd = bestDistance(q, fTokens);
        const b = tokenBudget(q);
        if (bd > b) {
            allTokensWithinBudget = false;
            break;
        }
        if (q.length >= 6 && bd === 2) {
            hasDist2OnLongToken = true;
        }
    }
    if (allTokensWithinBudget && hasDist2OnLongToken) {
        tokenTier2 = true;
    }

    // Alternative 2: Condensed Tier 2 (single query token, len >= 6, dist == 2)
    let condensedTier2 = false;
    if (qTokens.length === 1 && qCondensed.length >= 6 && fCondensed.length > 0) {
        if (osaDistance(qCondensed, fCondensed) === 2) {
            condensedTier2 = true;
        }
    }
    if (tokenTier2 || condensedTier2) return 50;

    return 0;
}

// Score a property (max score across Name, City, Address)
function scoreProperty(qRaw, property) {
    const scoreName = scoreField(qRaw, property.name);
    const scoreCity = scoreField(qRaw, property.city);
    const scoreAddress = scoreField(qRaw, property.address);

    let maxScore = Math.max(scoreName, scoreCity, scoreAddress);
    let bestField = 'None';
    if (maxScore === scoreName && maxScore > 0) bestField = 'Name';
    else if (maxScore === scoreCity && maxScore > 0) bestField = 'City';
    else if (maxScore === scoreAddress && maxScore > 0) bestField = 'Address';

    return {
        score: maxScore,
        bestField,
        scores: { name: scoreName, city: scoreCity, address: scoreAddress }
    };
}

// Deterministic property comparator for sorting
function compareProperties(a, b) {
    const nameCmp = compareOrdinalIgnoreCase(a.name, b.name);
    if (nameCmp !== 0) return nameCmp;
    return compareGuid(a.id, b.id);
}

// Search Properties
function searchProperties(query, properties) {
    // 1. Raw null/empty/whitespace check
    if (!query || !query.trim()) {
        return properties
            .filter(p => p.status === 'Active')
            .sort(compareProperties)
            .map(p => ({ property: p, score: 'N/A (Blank Query)' }));
    }

    // 2. Normalized-empty check: replicates current handler's string.IsNullOrEmpty(normalizedSearch) bypass
    const qNorm = normalizeVietnamese(query);
    if (!qNorm) {
        return properties
            .filter(p => p.status === 'Active')
            .sort(compareProperties)
            .map(p => ({ property: p, score: 'N/A (Normalized-Empty Bypass)' }));
    }

    // 3. Search and score Active properties
    const results = [];
    for (const p of properties) {
        if (p.status !== 'Active') continue;
        const res = scoreProperty(query, p);
        if (res.score > 0) {
            results.push({ property: p, score: res.score, details: res });
        }
    }

    // 4. Deterministic sorting: Score DESC, Name ASC (OrdinalIgnoreCase), Id ASC (Guid.CompareTo)
    results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const nameCmp = compareOrdinalIgnoreCase(a.property.name, b.property.name);
        if (nameCmp !== 0) return nameCmp;
        return compareGuid(a.property.id, b.property.id);
    });

    return results;
}

module.exports = {
    normalizeVietnamese,
    osaDistance,
    tokenize,
    condense,
    effectiveDistance,
    bestDistance,
    tokenBudget,
    charToUpperInvariantCode,
    compareOrdinalIgnoreCase,
    compareOrdinalIgnoreCaseApprox,
    compareGuid,
    scoreField,
    scoreProperty,
    compareProperties,
    searchProperties
};
