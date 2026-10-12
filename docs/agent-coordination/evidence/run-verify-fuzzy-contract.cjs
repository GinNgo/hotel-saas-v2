const {
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
} = require("./verify-fuzzy-contract.cjs");

const P1 = "11111111-1111-1111-1111-111111111111";
const P2 = "22222222-2222-2222-2222-222222222222";
const P3 = "33333333-3333-3333-3333-333333333333";
const P4 = "44444444-4444-4444-4444-444444444444";
const P5 = "55555555-5555-5555-5555-555555555555";
const P6 = "66666666-6666-6666-6666-666666666666";
const P7 = "77777777-7777-7777-7777-777777777777";
const P2_TIE = "88888888-8888-8888-8888-888888888888";

const SAMPLE_PROPERTIES = [
    {
        id: P1,
        name: "Khách Sạn Biển Đông Đà Nẵng",
        city: "Đà Nẵng",
        address: "200 Võ Nguyên Giáp, Quận Sơn Trà",
        status: "Active"
    },
    {
        id: P2,
        name: "Khách Sạn Central Đà Nẵng",
        city: "Đà Nẵng",
        address: "50 Nguyễn Văn Linh, Quận Hải Châu",
        status: "Active"
    },
    {
        id: P3,
        name: "Khách Sạn Sài Gòn Central",
        city: "TP. Hồ Chí Minh",
        address: "123 Lê Lợi, Phường Bến Thành, Quận 1",
        status: "Active"
    },
    {
        id: P4,
        name: "Khách Sạn Hà Nội Horizon",
        city: "Hà Nội",
        address: "40 Cát Linh, Quận Đống Đa",
        status: "Active"
    },
    {
        id: P5,
        name: "Khách Sạn Hạ Long Bay",
        city: "Quảng Ninh",
        address: "88 Hạ Long, Bãi Cháy",
        status: "Active"
    },
    {
        id: P6,
        name: "Khách Sạn Phú Quốc Sunset Resort",
        city: "Kiên Giang",
        address: "Bãi Trường, Dương Tơ",
        status: "Inactive"
    },
    {
        id: P7,
        name: "Khách Sạn Nha Trang Pearl",
        city: "Nha Trang",
        address: "12 Trần Phú, Phường Lộc Thọ",
        status: "Active"
    },
    {
        id: P2_TIE,
        name: "Khách Sạn Central Đà Nẵng",
        city: "Đà Nẵng",
        address: "100 Bạch Đằng, Quận Hải Châu",
        status: "Active"
    }
];

console.log("================================================================================");
console.log("OFFLINE DETERMINISTIC VERIFIER (BOUNDED ORACLE) — P5-FUZZY-CONTRACT-02 (Round 7)");
console.log("================================================================================\n");

let allPassed = true;

function assertCondition(desc, passed, detail = "") {
    if (passed) {
        console.log(`[PASS] ${desc}`);
    } else {
        console.error(`[FAIL] ${desc} -> ${detail}`);
        allPassed = false;
    }
}

// -----------------------------------------------------------------------------
// SECTION 1: Exact Explanatory Edit Counts & Distance Traces
// -----------------------------------------------------------------------------
console.log(">>> SECTION 1: Explanatory Edit Counts & Distance Traces");

// centxralz (len 9) -> da (len 2): 7 deletions ('c','e','n','t','x','r','l') + 1 substitution ('z'->'d') = 8 operations
const distDa = osaDistance("centxralz", "da");
assertCondition("centxralz -> da OSA is exactly 8 (7 deletions + 1 substitution)", distDa === 8, `Actual: ${distDa}`);

// centxralz (len 9) -> nang (len 4): 5 deletions ('c','e','t','x','l') + 2 substitutions ('r'->'n' or 'd', 'z'->'g') = 7 operations
const distNang = osaDistance("centxralz", "nang");
assertCondition("centxralz -> nang OSA is exactly 7 (5 deletions + 2 substitutions)", distNang === 7, `Actual: ${distNang}`);

// centxralz -> chau (len 4): 7 operations
const distChau = osaDistance("centxralz", "chau");
assertCondition("centxralz -> chau OSA is exactly 7", distChau === 7, `Actual: ${distChau}`);

// centxralz -> central: 2 deletions ('x', 'z') = 2 operations
const distCentral = osaDistance("centxralz", "central");
assertCondition("centxralz -> central OSA is exactly 2 (2 deletions)", distCentral === 2, `Actual: ${distCentral}`);

// Trace across all fields of P2
const p2Prop = SAMPLE_PROPERTIES.find(p => p.id === P2);
const nameTokens = tokenize(normalizeVietnamese(p2Prop.name));
const cityTokens = tokenize(normalizeVietnamese(p2Prop.city));
const addrTokens = tokenize(normalizeVietnamese(p2Prop.address));

const bestName = bestDistance("centxralz", nameTokens);
const bestCity = bestDistance("centxralz", cityTokens);
const bestAddr = bestDistance("centxralz", addrTokens);

assertCondition("P2 Name bestDist('centxralz') == 2", bestName === 2, `Actual: ${bestName}`);
assertCondition("P2 City bestDist('centxralz') == 7 (da=8, nang=7)", bestCity === 7, `Actual: ${bestCity}`);
assertCondition("P2 Address bestDist('centxralz') == 7 (chau=7, hai=8)", bestAddr === 7, `Actual: ${bestAddr}`);

const p2ScoreRes = scoreProperty("centxralz", p2Prop);
assertCondition("P2 Score for 'centxralz' is 50 on field Name", p2ScoreRes.score === 50 && p2ScoreRes.bestField === 'Name', `Actual: ${JSON.stringify(p2ScoreRes)}`);

// Multiword condensed 2: nhxtrangg -> nhatrang (len 8): 2 deletions ('x', 'g') = 2
const distNhaTrang = osaDistance("nhxtrangg", "nhatrang");
assertCondition("nhxtrangg -> nhatrang OSA is exactly 2 (2 deletions)", distNhaTrang === 2, `Actual: ${distNhaTrang}`);

// P3 Name vs City match distinction for "Sài Gòn"
const p3Prop = SAMPLE_PROPERTIES.find(p => p.id === P3);
const p3NameScore = scoreField("Sài Gòn", p3Prop.name);
const p3CityScore = scoreField("Sài Gòn", p3Prop.city);
assertCondition("Query 'Sài Gòn' matches P3 Name (Score 80)", p3NameScore === 80, `Actual: ${p3NameScore}`);
assertCondition("Query 'Sài Gòn' does NOT match P3 City (TP. Hồ Chí Minh, Score 0)", p3CityScore === 0, `Actual: ${p3CityScore}`);

// -----------------------------------------------------------------------------
// SECTION 2: Unicode Normalization & Combining Marks
// -----------------------------------------------------------------------------
console.log("\n>>> SECTION 2: Unicode Normalization & Combining Marks");

// U+1AB0 combining mark: a\u1ab0 normalizes to "a"
const norm1AB0 = normalizeVietnamese("a\u1ab0");
assertCondition("a\\u1ab0 normalizes to 'a' (NonSpacingMark stripped)", norm1AB0 === "a", `Actual: ${norm1AB0}`);

// Isolated combining mark: \u0301 normalizes to empty string ""
const normAcute = normalizeVietnamese("\u0301");
assertCondition("\\u0301 (combining acute) normalizes to empty string", normAcute === "", `Actual: '${normAcute}'`);

// -----------------------------------------------------------------------------
// SECTION 3: Ordinal Comparators & Asymmetric Guid Ordering (Bounded Oracle)
// -----------------------------------------------------------------------------
console.log("\n>>> SECTION 3: Ordinal Comparators & Asymmetric Guid Ordering (Bounded Oracle)");

// 1. OrdinalIgnoreCase puts ASCII uppercase before accented characters (Z < Á)
const ordCmp = compareOrdinalIgnoreCaseApprox("Z Hotel", "Á Hotel");
assertCondition("compareOrdinalIgnoreCaseApprox('Z Hotel', 'Á Hotel') is negative (Z < Á)", ordCmp < 0, `Actual: ${ordCmp}`);

// 2. Non-expanding case ordinal comparison sign: 'Straße' vs 'STRASSE'
// In .NET char.ToUpperInvariant simple 1-to-1 mapping, 'ß' does NOT expand to "SS".
// In JS whole-string toUpperCase it expands, but our char-by-char comparator preserves distinct non-expanding identity.
// In .NET CoreCLR: [StringComparer]::OrdinalIgnoreCase.Compare("Straße", "STRASSE") returns a positive sign (> 0).
const ordStrasse = compareOrdinalIgnoreCaseApprox("Straße", "STRASSE");
assertCondition("compareOrdinalIgnoreCaseApprox('Straße', 'STRASSE') is positive (> 0, non-expanding sign)", ordStrasse > 0, `Actual: ${ordStrasse}`);

// 3. Greek Titlecase/Uppercase Equivalence (Counterexample documenting bounded offline oracle limitation):
// In .NET CoreCLR: [StringComparer]::OrdinalIgnoreCase.Compare(U+1F80, U+1F88) returns 0 (see dotnet-comparator-fixtures.txt).
// In JS ECMAScript (bounded approximation): compareOrdinalIgnoreCaseApprox("\u1F80", "\u1F88") returns -1.
// This proves that the JS oracle is a bounded offline approximation, not a universal Unicode casing engine.
// Production backend C# code strictly requires native .NET StringComparer.OrdinalIgnoreCase.
const greekCmp = compareOrdinalIgnoreCaseApprox("\u1F80", "\u1F88");
assertCondition("Bounded Oracle Limitation Probe: Greek pair (U+1F80 vs U+1F88) is non-zero in JS oracle (-1 vs 0 in .NET CoreCLR)", greekCmp !== 0, `Actual: ${greekCmp}`);

// 4. Asymmetric GUID fixtures exercising individual groups numerically (matching .NET Guid.CompareTo)
// Group 1: 0x00000001 < 0x00000100 (1 < 256)
const guidG1 = compareGuid("00000001-0000-0000-0000-000000000000", "00000100-0000-0000-0000-000000000000");
assertCondition("Asymmetric Guid Group 1 (_a numeric): 0x00000001 < 0x00000100 (-1)", guidG1 === -1, `Actual: ${guidG1}`);

// Group 2: 0x0001 < 0x0100 (1 < 256)
const guidG2 = compareGuid("00000000-0001-0000-0000-000000000000", "00000000-0100-0000-0000-000000000000");
assertCondition("Asymmetric Guid Group 2 (_b numeric): 0x0001 < 0x0100 (-1)", guidG2 === -1, `Actual: ${guidG2}`);

// Group 3: 0x0001 < 0x0100 (1 < 256)
const guidG3 = compareGuid("00000000-0000-0001-0000-000000000000", "00000000-0000-0100-0000-000000000000");
assertCondition("Asymmetric Guid Group 3 (_c numeric): 0x0001 < 0x0100 (-1)", guidG3 === -1, `Actual: ${guidG3}`);

// Group 4 (bytes _d, _e): 0x0001 < 0x0100 (byte 8: 0x00 < 0x01)
const guidG4 = compareGuid("00000000-0000-0000-0001-000000000000", "00000000-0000-0000-0100-000000000000");
assertCondition("Asymmetric Guid Group 4 (_d byte order): 0x00 < 0x01 (-1)", guidG4 === -1, `Actual: ${guidG4}`);

// Group 5 (byte _k): 0x01 < 0x10
const guidG5 = compareGuid("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000010");
assertCondition("Asymmetric Guid Group 5 (_k byte order): 0x01 < 0x10 (-1)", guidG5 === -1, `Actual: ${guidG5}`);

// Sample GUIDs ordering
assertCondition("Guid P1 < P2", compareGuid(P1, P2) < 0);
assertCondition("Guid P2 < P2_TIE", compareGuid(P2, P2_TIE) < 0);

// -----------------------------------------------------------------------------
// SECTION 4: Comprehensive Full-Array Fixture Checking
// -----------------------------------------------------------------------------
console.log("\n>>> SECTION 4: Full-Array Fixture Checks (complete membership, order, and scores)");

const FULL_FIXTURES = [
    {
        name: "ExactMatch (Score 100)",
        query: "Khách Sạn Sài Gòn Central",
        expected: [
            { id: P3, score: 100 }
        ]
    },
    {
        name: "PrefixMatch (Score 90)",
        query: "Khách Sạn Sài Gòn",
        expected: [
            { id: P3, score: 90 }
        ]
    },
    {
        name: "SubstringMatch (Score 80, matches P3 Name only)",
        query: "Sài Gòn",
        expected: [
            { id: P3, score: 80 }
        ]
    },
    {
        name: "AllTokensExactMatch out-of-order (Score 75)",
        query: "Central Sài Gòn",
        expected: [
            { id: P3, score: 75 }
        ]
    },
    {
        name: "Token Reuse (Score 75)",
        query: "central central",
        expected: [
            { id: P2, score: 75 },
            { id: P2_TIE, score: 75 },
            { id: P3, score: 75 }
        ]
    },
    {
        name: "Condensed Tier 1 dist = 0 (Score 60)",
        query: "danang",
        expected: [
            { id: P1, score: 60 },
            { id: P2, score: 60 },
            { id: P2_TIE, score: 60 }
        ]
    },
    {
        name: "Multi-token Typo Tier 1 (Score 60)",
        query: "da nag",
        expected: [
            { id: P1, score: 60 },
            { id: P2, score: 60 },
            { id: P2_TIE, score: 60 }
        ]
    },
    {
        name: "Token Typo Tier 1 single token (Score 60)",
        query: "centraal",
        expected: [
            { id: P2, score: 60 },
            { id: P2_TIE, score: 60 },
            { id: P3, score: 60 }
        ]
    },
    {
        name: "Transposition Condensed Tier 1 (Score 60)",
        query: "Haoni",
        expected: [
            { id: P4, score: 60 }
        ]
    },
    {
        name: "Token Typo Tier 2 dist = 2 (Score 50)",
        query: "centxralz",
        expected: [
            { id: P2, score: 50 },
            { id: P2_TIE, score: 50 },
            { id: P3, score: 50 }
        ]
    },
    {
        name: "Multiword Condensed Tier 2 dist = 2 (Score 50)",
        query: "nhxtrangg",
        expected: [
            { id: P7, score: 50 }
        ]
    },
    {
        name: "Short Substring 'Ha' across full catalog (Score 90 / 80)",
        query: "Ha",
        expected: [
            { id: P4, score: 90 },
            { id: P1, score: 80 },
            { id: P2, score: 80 },
            { id: P2_TIE, score: 80 },
            { id: P5, score: 80 },
            { id: P7, score: 80 },
            { id: P3, score: 80 }
        ]
    },
    {
        name: "Literal punctuation with no match (Token-Empty Guard -> Score 0)",
        query: ", -",
        expected: []
    },
    {
        name: "All-Token Guard Rejection (Score 0)",
        query: "Danang xyz",
        expected: []
    },
    {
        name: "Same-Name Fixed-Guid Tie Break",
        query: "Central Đà Nẵng",
        expected: [
            { id: P2, score: 80 },
            { id: P2_TIE, score: 80 }
        ]
    }
];

for (const fix of FULL_FIXTURES) {
    const results = searchProperties(fix.query, SAMPLE_PROPERTIES);
    let match = results.length === fix.expected.length;
    if (match) {
        for (let i = 0; i < results.length; i++) {
            if (results[i].property.id !== fix.expected[i].id || results[i].score !== fix.expected[i].score) {
                match = false;
                break;
            }
        }
    }
    assertCondition(`Fixture '${fix.name}' (query: '${fix.query}')`, match, 
        `Expected: ${JSON.stringify(fix.expected.map(e => ({ id: e.id.substring(0, 8), score: e.score })))}, Actual: ${JSON.stringify(results.map(r => ({ id: r.property.id.substring(0, 8), score: r.score })))}`);
}

// -----------------------------------------------------------------------------
// SECTION 5: Blank and Normalized-Empty Bypass & Inactive Exclusion
// -----------------------------------------------------------------------------
console.log("\n>>> SECTION 5: Blank, Normalized-Empty Bypass & Inactive Exclusion");

const expectedActiveAll = [
    P1,     // Khách Sạn Biển Đông Đà Nẵng
    P2,     // Khách Sạn Central Đà Nẵng (2222...)
    P2_TIE, // Khách Sạn Central Đà Nẵng (8888...)
    P4,     // Khách Sạn Hà Nội Horizon
    P5,     // Khách Sạn Hạ Long Bay
    P7,     // Khách Sạn Nha Trang Pearl
    P3      // Khách Sạn Sài Gòn Central
];

function checkBypass(desc, query) {
    const results = searchProperties(query, SAMPLE_PROPERTIES);
    let match = results.length === expectedActiveAll.length;
    if (match) {
        for (let i = 0; i < results.length; i++) {
            if (results[i].property.id !== expectedActiveAll[i]) {
                match = false;
                break;
            }
        }
    }
    // Also verify Inactive P6 is NEVER in results
    const hasInactive = results.some(r => r.property.id === P6 || r.property.status === 'Inactive');
    assertCondition(`${desc} returns all 7 Active properties in Name ASC, Id ASC order`, match && !hasInactive,
        `Match: ${match}, HasInactive: ${hasInactive}`);
}

checkBypass("Blank query (empty string '')", "");
checkBypass("Blank query (whitespace only '   ')", "   ");
checkBypass("Normalized-empty query (combining acute '\\u0301')", "\u0301");

// -----------------------------------------------------------------------------
// SECTION 6: Summary & Exit Code
// -----------------------------------------------------------------------------
console.log("\n================================================================================");
if (allPassed) {
    console.log("FINAL RESULT: ALL ASSERTIONS PASSED (BOUNDED OFFLINE DETERMINISTIC VERIFIER)");
    console.log("================================================================================");
    process.exit(0);
} else {
    console.error("FINAL RESULT: VERIFIER FAILED (ONE OR MORE ASSERTIONS FAILED)");
    console.log("================================================================================");
    process.exit(1);
}
