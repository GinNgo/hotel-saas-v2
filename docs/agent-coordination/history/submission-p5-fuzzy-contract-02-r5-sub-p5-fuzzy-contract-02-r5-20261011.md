# Submission P5-FUZZY-CONTRACT-02 — Round 5

- **TaskId:** `P5-FUZZY-CONTRACT-02`
- **Round:** 5
- **SubmissionId:** `sub-p5-fuzzy-contract-02-r5-20261011`
- **Status:** `Submitted`
- **Scope:** Technical Specification & Contract Proposal only (`docs/p5-guest-search-contract-proposal.md` v7.0). Zero backend C# code modifications, zero DB mutations, zero unapproved matcher/runtime changes, zero changes to approved Angular UI or API contracts.

---

## 1. Tóm Tắt & Giải Quyết Toàn Bộ Findings Từ Codex Review Round 4

### Finding 1 (P2) — Căn Chỉnh Bộ So Sánh Chuẩn OrdinalIgnoreCase & Guid.CompareTo
- **Căn chỉnh StringComparer.OrdinalIgnoreCase:**
  - Thay thế hoàn toàn `localeCompare(name, 'vi')` bằng hàm so sánh ký tự mã Unicode theo chuẩn `StringComparer.OrdinalIgnoreCase` của .NET (`compareOrdinalIgnoreCase`).
  - Trong chuẩn OrdinalIgnoreCase, các ký tự ASCII hoa như `'Z'` (mã 90) đứng trước các ký tự có dấu như `'Á'` (mã 193).
  - Đã bổ sung probe kiểm thử xác nhận: `compareOrdinalIgnoreCase("Z Hotel", "Á Hotel") < 0` (Z Hotel xếp trước Á Hotel, khác biệt hoàn toàn với `localeCompare('vi')`).
- **Căn chỉnh Guid.CompareTo:**
  - Triển khai hàm `compareGuid` đối chiếu chính xác cấu trúc các trường số và byte của .NET Guid (`_a` uint32 LE, `_b` uint16 LE, `_c` uint16 LE, và các byte còn lại).
  - Đã bổ sung probe kiểm thử xác nhận thứ tự: `Guid P1 < P2 < P2_TIE`.

---

### Finding 2 (P2) — Loại Bỏ Toàn Bộ NonSpacingMark (Bao Gồm U+1AB0), Cơ Chế Normalized-Empty Bypass & Delimiters Chuẩn
- **Loại bỏ toàn bộ Unicode NonSpacingMark:**
  - Dùng `\p{Mn}` (Unicode category `Nonspacing_Mark`) trong biểu thức chính quy chuẩn hóa: `s.replace(/\p{Mn}/gu, '')`.
  - Không giới hạn ở dải `U+0300–036F`, đảm bảo loại bỏ hoàn toàn mọi ký tự dấu kết hợp, bao gồm cả `U+1AB0` (`a\u1ab0` chuẩn hóa thành `"a"`).
- **Cơ chế Normalized-Empty Bypass:**
  - Khi truy vấn chỉ chứa ký tự dấu kết hợp đơn lẻ (ví dụ `"\u0301"` — combining acute), quá trình chuẩn hóa lọc bỏ toàn bộ dấu kết hợp khiến chuỗi chuẩn hóa trở thành rỗng (`string.Empty`).
  - Đối chiếu mã nguồn hiện hành `GetPublicPropertiesQueryHandler.cs`: điều kiện `if (!string.IsNullOrEmpty(normalizedSearch))` không được kích hoạt $\rightarrow$ **hệ thống bypass bộ lọc và trả về toàn bộ 7 cơ sở Active** theo đúng thứ tự `Name ASC`, `Id ASC`, hoàn toàn đồng nhất với truy vấn rỗng (`""` hoặc `"   "`).
  - Đã bổ sung fixture và kiểm thử xác thực cả 3 trường hợp: `""`, `"   "`, và `"\u0301"`.
- **Căn chỉnh tập ký tự phân cách (Delimiters):**
  - Biểu thức chính quy tách token được căn chỉnh thành `/[ \t\r\n,.\-_/\\+]+/`, trùng khớp 100% với mảng `char[] delimiters` trong mã giả C#.

---

### Finding 3 (P2) — Kiểm Tra Toàn Bộ Mảng Kết Quả (Full-Array Assertions), Thoát Lỗi Non-Zero & Sửa Chữa Edit Counts
- **Kiểm tra toàn bộ mảng kết quả (Full-Array Assertions):**
  - Kịch bản verifier (`run-verify-fuzzy-contract.cjs`) kiểm tra toàn diện: số lượng phần tử, ID từng cơ sở, thứ tự sắp xếp và điểm số của từng phần tử (không chỉ kiểm tra top 1).
  - Bổ sung cơ sở P7 ("Khách Sạn Nha Trang Pearl") và P2_TIE ("Khách Sạn Central Đà Nẵng", ID `8888...`) vào toàn bộ các fixtures liên quan.
  - Fixture `"Ha"` trả về toàn bộ 7 cơ sở Active trong danh mục:
    1. P4 (Score 90, Hà Nội Horizon)
    2. P1 (Score 80, Biển Đông Đà Nẵng)
    3. P2 (Score 80, Central Đà Nẵng, `2222...`)
    4. P2_TIE (Score 80, Central Đà Nẵng, `8888...`)
    5. P5 (Score 80, Hạ Long Bay)
    6. P7 (Score 80, Nha Trang Pearl)
    7. P3 (Score 80, Sài Gòn Central)
- **Thoát lỗi Non-Zero:**
  - Runner tự động thoát với mã lỗi `process.exit(1)` nếu có bất kỳ assertion nào thất bại; thoát `process.exit(0)` khi toàn bộ 100% assertions thành công.
- **Sửa chính xác số đếm phép biến đổi (Explanatory Edit Counts):**
  - `centxralz` (len 9) $\rightarrow$ `da` (len 2): 7 phép xóa ký tự ('c','e','n','t','x','r','l') + 1 phép thay thế ('z' $\rightarrow$ 'd') = 8 thao tác.
  - `centxralz` (len 9) $\rightarrow$ `nang` (len 4): 5 phép xóa ký tự ('c','e','t','x','l') + 2 phép thay thế ('r' $\rightarrow$ 'n' hoặc 'd', 'z' $\rightarrow$ 'g') = 7 thao tác.
  - `centxralz` $\rightarrow$ `chau` (len 4): 7 thao tác.
  - `centxralz` $\rightarrow$ `central`: 2 phép xóa ('x', 'z') = 2 thao tác.
  - $\implies \text{P2.Name}$ có $\text{bestDist} = 2$, $\text{P2.City}$ có $\text{bestDist} = 7$, $\text{P2.Address}$ có $\text{bestDist} = 7 \rightarrow$ Điểm tối đa RelevanceScore = $\mathbf{50}$ (`Name`).
- **Sửa phân tích trường khớp của `"Sài Gòn"`:**
  - Khẳng định chính xác: `"Sài Gòn"` chỉ khớp `P3.Name` ("Khách Sạn Sài Gòn Central", Score 80), hoàn toàn **KHÔNG** khớp `P3.City` ("TP. Hồ Chí Minh", Score 0).
- **Bổ sung các fixtures kiểm thử đầy đủ:**
  - Hoán vị kế nhau (Transposition): `"Haoni"` $\rightarrow$ Score 60 cho P4.
  - Lặp token (Token Reuse): `"central central"` $\rightarrow$ Score 75 cho P2, P2_TIE, P3.
  - Loại trừ Inactive: Xác nhận P6 (`Inactive`) tuyệt đối không bao giờ xuất hiện trong bất kỳ kết quả tìm kiếm nào, kể cả blank/normalized-empty bypass.

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
| Ordinal Probe | `"Z Hotel"` vs `"Á Hotel"` | `compareOrdinalIgnoreCase("Z Hotel", "Á Hotel") < 0` | **PASS** |

---

## 4. Danh Mục Minh Chứng (Evidence)

1. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 7.0 hoàn chỉnh.
2. `docs/agent-coordination/evidence/verify-fuzzy-contract.cjs`: Module Offline Deterministic Verifier (chuẩn hóa `\p{Mn}`, `StringComparer.OrdinalIgnoreCase`, `Guid.CompareTo`, Normalized-Empty bypass, exact DP OSA).
3. `docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`: Kịch bản runner kiểm thử toàn bộ mảng kết quả với non-zero exit code.
4. `docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`: Kết quả thực thi xác nhận 100% assertions đạt kết quả PASS (exit code 0).
5. `docs/agent-coordination/submission.md`: Bản tường trình Round 5 chi tiết.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối.