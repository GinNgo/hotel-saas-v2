# Submission P5-FUZZY-CONTRACT-02 — Round 6

- **TaskId:** `P5-FUZZY-CONTRACT-02`
- **Round:** 6
- **SubmissionId:** `sub-p5-fuzzy-contract-02-r6-20261011`
- **Status:** `Submitted`
- **Scope:** Technical Specification & Contract Proposal only (`docs/p5-guest-search-contract-proposal.md` v8.0). Zero backend C# code modifications, zero DB mutations, zero unapproved matcher/runtime changes, zero changes to approved Angular UI or API contracts.

---

## 1. Tóm Tắt & Giải Quyết Toàn Bộ Findings Từ Codex Review Round 5

### Finding 1 (P2) — Căn Chỉnh compareGuid Theo Cấu Trúc Số .NET (Numeric Group Parsing) & Bổ Sung Asymmetric Fixtures
- **Khắc phục triệt để lỗi Endianness trong phân tích chuỗi GUID:**
  - Trong Round 5, việc đọc byte little-endian trực tiếp từ mảng byte chuỗi hex display đã gây đảo ngược thứ tự số học (ví dụ: chuỗi hex display `00000001` bị đọc thành `0x01000000` thay vì giá trị số 1).
  - Đã tái cấu trúc hàm `compareGuid` theo đúng định nghĩa trường số của cấu trúc .NET `System.Guid`:
    1. **Nhóm 1 (`_a`):** Số nguyên không dấu 32-bit (`uint`) được phân tích trực tiếp từ chuỗi 8 ký tự hex hiển thị: `parseInt(p[0], 16)`. Chuỗi `00000001` (1) so với `00000100` (256) trả về chính xác **-1** (khắc phục hoàn toàn counterexample từ Reviewer).
    2. **Nhóm 2 (`_b`):** Số nguyên không dấu 16-bit (`ushort`) được phân tích trực tiếp từ chuỗi 4 ký tự hex hiển thị: `parseInt(p[1], 16)`.
    3. **Nhóm 3 (`_c`):** Số nguyên không dấu 16-bit (`ushort`) được phân tích trực tiếp từ chuỗi 4 ký tự hex hiển thị: `parseInt(p[2], 16)`.
    4. **Nhóm 4 & 5 (`_d` đến `_k`):** 8 byte riêng lẻ theo thứ tự hiển thị chuỗi hex từ trái sang phải (`parseInt(rest.substring(i, i + 2), 16)`).
- **Bổ sung 5 Fixtures Bất Đối Xứng (Asymmetric Fixtures) kiểm thử độc lập từng nhóm:**
  - **Group 1 (`_a` numeric):** `00000001-0000-0000-0000-000000000000` < `00000100-0000-0000-0000-000000000000` (-1) $\rightarrow$ **PASS**.
  - **Group 2 (`_b` numeric):** `00000000-0001-0000-0000-000000000000` < `00000000-0100-0000-0000-000000000000` (-1) $\rightarrow$ **PASS**.
  - **Group 3 (`_c` numeric):** `00000000-0000-0001-0000-000000000000` < `00000000-0000-0100-0000-000000000000` (-1) $\rightarrow$ **PASS**.
  - **Group 4 (`_d` byte order):** `00000000-0000-0000-0001-000000000000` < `00000000-0000-0000-0100-000000000000` (-1) $\rightarrow$ **PASS** (byte 8 là `0x00` < `0x01`).
  - **Group 5 (`_k` byte order):** `00000000-0000-0000-0000-000000000001` < `00000000-0000-0000-0000-000000000010` (-1) $\rightarrow$ **PASS** (byte 15 là `0x01` < `0x10`).

---

### Finding 2 (P2) — Căn Chỉnh compareOrdinalIgnoreCase 1-to-1 Non-Expanding & Phân Tích Ví Dụ Phản Chứng
- **Căn chỉnh thuật toán so sánh Ordinal từng ký tự 1-to-1:**
  - Trong .NET, `char.ToUpperInvariant` sử dụng ánh xạ chữ hoa đơn giản 1-to-1 từ bảng mã Unicode (Simple Uppercase Mapping), tuyệt đối không mở rộng một ký tự đơn thành chuỗi nhiều ký tự.
  - Ngược lại, hàm toàn chuỗi `.toUpperCase()` trong JavaScript ECMAScript thực hiện mở rộng chuỗi (như `'ß'` mở rộng thành `"SS"`), khiến hai chuỗi `"Straße"` và `"STRASSE"` bị hiểu nhầm là bằng nhau (trả về 0) và vô tình kích hoạt tie-break ID giữa hai tên hoàn toàn khác biệt.
  - Đã triển khai hàm `charToUpperInvariantCode`: nếu ký tự mở rộng độ dài $> 1$, giữ nguyên mã Unicode gốc (1-to-1). So sánh từng ký tự theo thứ tự ordinal.
- **Probe đối kháng xác nhận (Adversarial Expanding-Case Probe):**
  - `compareOrdinalIgnoreCase("Straße", "STRASSE")` trả về **+1** (dương, không bằng 0), đồng nhất 100% với .NET runtime:
    `[StringComparer]::OrdinalIgnoreCase.Compare('Straße', 'STRASSE') == 1` $\rightarrow$ **PASS**.
  - `compareOrdinalIgnoreCase("Z Hotel", "Á Hotel")` trả về **-1** (Z < Á trong bảng mã Ordinal) $\rightarrow$ **PASS**.
  - `compareOrdinalIgnoreCase("Hotel A", "hotel a")` trả về **0** (khớp không phân biệt hoa thường) $\rightarrow$ **PASS**.
- **Quy định hợp đồng:** Đặc tả khẳng định rõ ràng production backend C# sử dụng `StringComparer.OrdinalIgnoreCase`, và bộ verifier ngoại tuyến của JS đã được căn chỉnh để đạt 100% parity toán học với .NET.

---

## 2. Mã Giả Tính Điểm Chính Xác (Exact Scoring Pseudocode)

```csharp
public static int ScoreField(string rawQuery, string rawField)
{
    if (string.IsNullOrEmpty(rawField)) return 0;
    string qNorm = VietnameseTextNormalizer.Normalize(rawQuery);
    string fNorm = VietnameseTextNormalizer.Normalize(rawField);
    if (string.IsNullOrEmpty(qNorm)) return 0;

    // 1. Literal Checks
    if (fNorm == qNorm) return 100;
    if (fNorm.StartsWith(qNorm)) return 90;
    if (fNorm.Contains(qNorm)) return 80;

    // 2. Tokenize & Condense với tập delimiters chuẩn
    char[] delimiters = new[] { ' ', '\t', '\r', '\n', ',', '.', '-', '_', '/', '\\', '+' };
    string[] qTokens = qNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string[] fTokens = fNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string qCondensed = string.Concat(qTokens);
    string fCondensed = string.Concat(fTokens);

    // 3. Token-Empty Guard
    if (qTokens.Length == 0) return 0;

    // 4. Score 75: All-tokens exact match (cho phép token reuse)
    if (qTokens.Length >= 2)
    {
        bool allExact = true;
        foreach (var q in qTokens)
        {
            if (BestDistance(q, fTokens) != 0) { allExact = false; break; }
        }
        if (allExact) return 75;
    }

    // 5. Score 60: Tier 1 (Hai Nhánh Độc Lập)
    bool tokenTier1 = true;
    foreach (var q in qTokens)
    {
        int bd = BestDistance(q, fTokens);
        if (q.Length <= 2) { if (bd != 0) { tokenTier1 = false; break; } }
        else { if (bd > 1) { tokenTier1 = false; break; } }
    }

    bool condensedTier1 = false;
    if (qTokens.Length == 1 && qCondensed.Length >= 4 && fCondensed.Length > 0)
    {
        if (OsaDistance(qCondensed, fCondensed) <= 1) condensedTier1 = true;
    }

    if (tokenTier1 || condensedTier1) return 60;

    // 6. Score 50: Tier 2 (Hai Nhánh Độc Lập)
    bool tokenTier2 = false;
    bool allWithinBudget = true;
    bool hasDist2LongToken = false;
    foreach (var q in qTokens)
    {
        int bd = BestDistance(q, fTokens);
        int b = TokenBudget(q);
        if (bd > b) { allWithinBudget = false; break; }
        if (q.Length >= 6 && bd == 2) hasDist2LongToken = true;
    }
    if (allWithinBudget && hasDist2LongToken) tokenTier2 = true;

    bool condensedTier2 = false;
    if (qTokens.Length == 1 && qCondensed.Length >= 6 && fCondensed.Length > 0)
    {
        if (OsaDistance(qCondensed, fCondensed) == 2) condensedTier2 = true;
    }

    if (tokenTier2 || condensedTier2) return 50;

    return 0;
}
```

---

## 3. Bảng Fixtures & Kết Quả Xác Nhận Từ Offline Verifier (Full-Array Match)

| Tên Fixture | Truy vấn ($Q$) | Kỳ vọng toàn bộ mảng kết quả | Verifier Result |
| :--- | :--- | :--- | :---: |
| ExactMatch (100) | `"Khách Sạn Sài Gòn Central"` | `[{ P3, 100 }]` | **PASS** |
| PrefixMatch (90) | `"Khách Sạn Sài Gòn"` | `[{ P3, 90 }]` | **PASS** |
| SubstringMatch (80) | `"Sài Gòn"` | `[{ P3, 80 }]` *(Khớp Name, không khớp City)* | **PASS** |
| AllTokensExactMatch (75) | `"Central Sài Gòn"` | `[{ P3, 75 }]` | **PASS** |
| Token Reuse (75) | `"central central"` | `[{ P2, 75 }, { P2_TIE, 75 }, { P3, 75 }]` | **PASS** |
| Condensed Tier 1 (60) | `"danang"` | `[{ P1, 60 }, { P2, 60 }, { P2_TIE, 60 }]` | **PASS** |
| Multi-token Typo 1 (60) | `"da nag"` | `[{ P1, 60 }, { P2, 60 }, { P2_TIE, 60 }]` | **PASS** |
| Token Typo 1 (60) | `"centraal"` | `[{ P2, 60 }, { P2_TIE, 60 }, { P3, 60 }]` | **PASS** |
| Transposition Tier 1 (60) | `"Haoni"` | `[{ P4, 60 }]` | **PASS** |
| Token Typo 2 (50) | `"centxralz"` | `[{ P2, 50 }, { P2_TIE, 50 }, { P3, 50 }]` | **PASS** |
| Condensed Tier 2 (50) | `"nhxtrangg"` | `[{ P7, 50 }]` | **PASS** |
| Short Substring "Ha" | `"Ha"` | `[{ P4, 90 }, { P1, 80 }, { P2, 80 }, { P2_TIE, 80 }, { P5, 80 }, { P7, 80 }, { P3, 80 }]` | **PASS** |
| Literal Punctuation (0) | `", -"` | `[]` *(Token-Empty Guard dừng, không match vacuously)* | **PASS** |
| Guard Rejection (0) | `"Danang xyz"` | `[]` *(Token "xyz" vượt ngân sách)* | **PASS** |
| Same-Name Tie Break | `"Central Đà Nẵng"` | `[{ P2, 80 }, { P2_TIE, 80 }]` *(Xếp Id ASC: 2222... < 8888...)* | **PASS** |
| Blank Query Bypass | `""` hoặc `"   "` | Toàn bộ 7 Active theo `Name ASC` (Ordinal), `Id ASC` | **PASS** |
| Normalized-Empty Bypass | `"\u0301"` | Toàn bộ 7 Active theo `Name ASC` (Ordinal), `Id ASC` | **PASS** |
| Expanding Casing Probe | `"Straße"` vs `"STRASSE"` | `compareOrdinalIgnoreCase("Straße", "STRASSE") == 1` (Không bị collapse) | **PASS** |
| Asymmetric Guid Probes | 5 nhóm bất đối xứng | Tất cả đều cho kết quả -1 khớp 100% với `Guid.CompareTo` | **PASS** |

---

## 4. Danh Mục Minh Chứng (Evidence)

1. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 8.0 hoàn chỉnh.
2. `docs/agent-coordination/evidence/verify-fuzzy-contract.cjs`: Module Offline Deterministic Verifier (Numeric Group Guid parser, non-expanding 1-to-1 `OrdinalIgnoreCase`, `\p{Mn}` full strip, Normalized-Empty bypass, exact DP OSA).
3. `docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`: Kịch bản runner kiểm thử toàn bộ mảng kết quả, asymmetric GUIDs, expanding case counterexample, với exit code 0/1.
4. `docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`: Kết quả thực thi xác nhận 100% assertions đạt kết quả PASS (exit code 0).
5. `docs/agent-coordination/submission.md`: Bản tường trình Round 6 chi tiết.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối.