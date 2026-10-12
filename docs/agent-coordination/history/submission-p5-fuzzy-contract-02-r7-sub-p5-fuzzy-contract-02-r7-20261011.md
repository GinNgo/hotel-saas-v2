# Submission P5-FUZZY-CONTRACT-02 — Round 7

- **TaskId:** `P5-FUZZY-CONTRACT-02`
- **Round:** 7
- **SubmissionId:** `sub-p5-fuzzy-contract-02-r7-20261011`
- **Status:** `Submitted`
- **Scope:** Technical Specification & Contract Proposal only (`docs/p5-guest-search-contract-proposal.md` v9.0). Zero backend C# code modifications, zero matcher creation, zero DB mutations, zero unapproved runtime changes, zero modifications to approved Angular UI or API contracts. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Tóm Tắt & Giải Quyết Triệt Để Findings Từ Codex Review Round 6

### Finding (P2) — Xóa Bỏ Khẳng Định Universal Parity, Định Danh Bounded Offline Oracle & Cung Cấp Bằng Chứng Runtime .NET Thực Tế

1. **Xóa bỏ toàn bộ tuyên bố tương đương phổ quát 100% (Universal Parity):**
   - Đã rà soát và loại bỏ hoàn toàn các nhận định về "100% mathematical/.NET parity" trên tài liệu đề xuất (`p5-guest-search-contract-proposal.md` v9.0), kịch bản verifier (`run-verify-fuzzy-contract.cjs`), và bản tường trình submission.
   - Hàm so sánh trong JavaScript verifier được đổi tên và dán nhãn rõ ràng: `compareOrdinalIgnoreCaseApprox` (bộ ước lượng xấp xỉ ngoại tuyến có giới hạn — Bounded Offline Oracle).
   - Không cài đặt lại bảng mã Unicode phức tạp trong JavaScript (tuân thủ chỉ đạo của Codex: không reimplement Unicode tables, giữ nguyên phạm vi bounded oracle).

2. **Khẳng định hợp đồng sản xuất Backend C#:**
   - Đặc tả kỹ thuật tái khẳng định tuyệt đối: Mã nguồn sản xuất backend C# bắt buộc sử dụng `StringComparer.OrdinalIgnoreCase` gốc của .NET và `Guid.CompareTo` theo cấu trúc số của .NET.

3. **Tạo artifact đối chiếu Runtime .NET thực tế (`docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`):**
   - Được sinh trực tiếp từ PowerShell CoreCLR (.NET Runtime) trên môi trường phát triển:
     - **Cặp phản chứng Hy Lạp (Greek Counterexample):** `[StringComparer]::OrdinalIgnoreCase.Compare([string][char]0x1F80, [string][char]0x1F88)` trả về **0** trong .NET (bằng nhau theo bảng Unicode invariant). Trong khi đó, trong JS ECMAScript xấp xỉ, hàm trả về **-1**. Sự khác biệt này được ghi nhận tường minh là giới hạn xấp xỉ có chủ đích của bộ kiểm chứng ngoại tuyến JS so với .NET CoreCLR.
     - **Dấu so sánh không mở rộng (Straße vs STRASSE):** `[StringComparer]::OrdinalIgnoreCase.Compare('Straße', 'STRASSE')` trả về **140** (dương, > 0) trong .NET CoreCLR. Hợp đồng bất biến là **dấu dương (> 0)**, không phải độ lớn số học tuyệt đối. Dấu dương khẳng định 'ß' (mã 223) không bị mở rộng thành 'SS' (mã 83) trong so sánh ordinal và hai chuỗi không bị suy biến thành bằng nhau. Verifier JS `compareOrdinalIgnoreCaseApprox` kiểm tra `> 0` (+1), hoàn toàn phù hợp với hợp đồng dấu.
     - **Thứ tự mã ASCII hoa trước ký tự có dấu:** `[StringComparer]::OrdinalIgnoreCase.Compare('Z Hotel', 'Á Hotel')` trả về **-1** (< 0) vì 'Z' (mã 90) < 'Á' (mã 193).
     - **Tính không phân biệt hoa thường ASCII:** `[StringComparer]::OrdinalIgnoreCase.Compare('Hotel A', 'hotel a')` trả về **0**.
     - **Thứ tự số học nhóm GUID:** Khớp chính xác với cấu trúc `Guid.CompareTo`.

4. **Cập nhật Runner & Verifier Artifacts:**
   - Trong `run-verify-fuzzy-contract.cjs`, Section 3 bổ sung probe kiểm tra phản chứng Hy Lạp (ghi nhận giới hạn oracle ngoại tuyến) và kiểm tra dấu dương `ordStrasse > 0`.
   - Chạy kiểm thực độc lập: `node docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs` trả về exit code **0**, toàn bộ assertions đạt **PASS**.

---

## 2. Mã Giả Tính Điểm Chính Xác (Exact Scoring Pseudocode — Unchanged)

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
| :--- | :--- | :--- | :--- :
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
| Expanding Casing Probe | `"Straße"` vs `"STRASSE"` | `compareOrdinalIgnoreCaseApprox("Straße", "STRASSE") > 0` (Dấu dương > 0) | **PASS** |
| Greek Limitation Probe | U+1F80 vs U+1F88 | Khác biệt -1 trong JS oracle vs 0 trong .NET CoreCLR được ghi nhận minh bạch | **PASS** |
| Asymmetric Guid Probes | 5 nhóm bất đối xứng | Tất cả đều cho kết quả -1 khớp 100% với cấu trúc số của .NET `Guid.CompareTo` | **PASS** |

---

## 4. Danh Mục Minh Chứng (Evidence)

1. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 (loại bỏ universal parity, định danh bounded offline oracle, viện dẫn runtime .NET fixtures).
2. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET thực tế sinh từ PowerShell CoreCLR (Greek counterexample, Straße sign > 0 [140], ASCII case và accent ordering).
3. `docs/agent-coordination/evidence/verify-fuzzy-contract.cjs`: Module Offline Deterministic Verifier (Numeric Group Guid parser, `compareOrdinalIgnoreCaseApprox` bounded offline approximation, `\p{Mn}` full strip, Normalized-Empty bypass, exact DP OSA).
4. `docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`: Kịch bản runner kiểm thử toàn bộ mảng kết quả, asymmetric GUIDs, expanding case counterexample, Greek limitation probe, với exit code 0/1.
5. `docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`: Kết quả thực thi xác nhận 100% assertions đạt kết quả PASS (exit code 0).
6. `docs/agent-coordination/submission.md`: Bản tường trình Round 7 chi tiết.
7. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối.