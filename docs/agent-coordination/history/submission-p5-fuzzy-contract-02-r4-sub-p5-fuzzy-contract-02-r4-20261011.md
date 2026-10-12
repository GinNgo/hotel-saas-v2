# Submission P5-FUZZY-CONTRACT-02 — Round 4

- **TaskId:** `P5-FUZZY-CONTRACT-02`
- **Round:** 4
- **SubmissionId:** `sub-p5-fuzzy-contract-02-r4-20261011`
- **Status:** `Submitted`
- **Scope:** Technical Specification & Contract Proposal only (`docs/p5-guest-search-contract-proposal.md` v6.0). Zero backend C# code modifications, zero DB mutations, zero unapproved matcher/runtime changes, zero changes to approved Angular UI or API contracts.

---

## 1. Tóm Tắt & Giải Quyết Toàn Bộ Findings Từ Codex Review Round 3

### Finding 1 (P2) — Hai Nhánh Độc Lập Cho Condensed Tier 2 / Tier 1, Token-Empty Guard & Multiword Condensed Fixture
- **Tách biệt hoàn toàn hai nhánh độc lập (Independent Disjunction):**
  - **Nhánh Token Tier 2 (Score 50):**
    - Mọi token $q \in Q_{tokens}$ đều thỏa mãn ngân sách lỗi ($\text{bestDist}(q, T) \le \text{budget}(q)$).
    - Có ít nhất một token $|q| \ge 6$ có $\text{bestDist}(q, T) == 2$.
  - **HOẶC Nhánh Condensed Tier 2 (Score 50):**
    - Truy vấn là token đơn ($|Q_{tokens}| == 1$).
    - Độ dài chuỗi $|Q_{condensed}| \ge 6$, trường đích có $|T_{condensed}| > 0$.
    - Khoảng cách $\text{OSA}(Q_{condensed}, T_{condensed}) == 2$.
  - *Ý nghĩa:* Nhánh Condensed Tier 2 **hoàn toàn KHÔNG kế thừa All-Token Guard**. Điều này cho phép một truy vấn gõ liền duy nhất (như `"nhxtrangg"`) khớp khoảng cách 2 với một trường nhiều từ (như City `"Nha Trang"` có condensed `"nhatrang"`).
  - Tương tự, **Tier 1 (Score 60)** cũng được cấu trúc thành 2 nhánh độc lập:
    - Nhánh Token Tier 1: Tất cả token thỏa mãn budget Tier 1 (token $\le 2$ có bestDist = 0, token $\ge 3$ có bestDist $\le 1$).
    - HOẶC Nhánh Condensed Tier 1: Truy vấn token đơn ($|Q_{tokens}| == 1$), $|Q_{condensed}| \ge 4$, $|T_{condensed}| > 0$, và $\text{OSA}(Q_{condensed}, T_{condensed}) \le 1$.
- **Token-Empty Guard:**
  - Áp dụng ngay trước các nhánh tính điểm theo token (Score 75, 60, 50).
  - Nếu truy vấn người dùng không rỗng nhưng phân tách token cho ra mảng rỗng ($|Q_{tokens}| == 0$, ví dụ $Q = \text{", -"}$):
    - Sau khi kiểm tra chuỗi con literal trên $Q_{norm}$ không khớp: **Dừng ngay lập tức và gán Score = 0**.
    - Tuyệt đối không cho phép truy vấn rỗng token đi tiếp vào các vòng lặp token để ngăn ngừa việc khớp "vacuously" ($\forall q \in \emptyset$ luôn true).
- **Trường đích rỗng (Empty Target Definition):**
  - Nếu trường dữ liệu $T$ rỗng hoặc $|T_{tokens}| == 0$, định nghĩa $\text{bestDist}(q, T) = \infty$.
- **Bảo lưu Token Reuse/Multiplicity & Chuẩn hóa Literal:**
  - Mỗi token truy vấn $q \in Q_{tokens}$ tìm kiếm độc lập token đích $t \in T_{tokens}$ có khoảng cách nhỏ nhất. Các token truy vấn khác nhau được phép khớp vào cùng một token đích (cho phép token reuse).
  - Giữ nguyên 100% ngữ nghĩa của `VietnameseTextNormalizer.cs` (không xóa dấu câu).
- **Bổ sung Fixture Multiword Condensed 2 Thực Tế:**
  - Cơ sở mẫu P7 ("Khách Sạn Nha Trang Pearl", City "Nha Trang", condensed "nhatrang" len 8).
  - Truy vấn `"nhxtrangg"` (token đơn len 9, thừa 'x' và 'g' so với "nhatrang").
  - Phép biến đổi: Xóa 'x' và xóa 'g' $\rightarrow \text{OSA}(\text{"nhxtrangg"}, \text{"nhatrang"}) = 2$.
  - Khớp qua Nhánh Condensed Tier 2 độc lập $\rightarrow$ **Score = 50**!

---

### Finding 2 (P2) — Sửa Chữa Toàn Bộ Ma Trận Khoảng Cách OSA Theo Thuật Toán DP Chính Xác & Công Cụ Offline Verifier
- **Hiệu chỉnh toàn bộ bảng khoảng cách OSA bằng thuật toán ma trận DP chuẩn xác:**
  - Truy vấn `"centxralz"` (độ dài 9) đối chiếu với các token của P2:
    - Token `"da"`: OSA = 8 (thay vì 9) vì ký tự `'a'` ở vị trí 6 của `"centxralz"` khớp với `'a'` của `"da"` (chi phí: xóa 8 ký tự, thay thế 1 ký tự $\rightarrow$ tổng chi phí = 8).
    - Token `"nang"`: OSA = 7 (thay vì 8) vì các ký tự `'n'` và `'a'` trùng khớp (chi phí: xóa 7 ký tự, thay thế 1 ký tự $\rightarrow$ tổng chi phí = 7).
    - Token `"chau"`: OSA = 7 (thay vì 8) vì các ký tự `'c'` và `'a'` trùng khớp (tổng chi phí = 7).
    - $\implies \text{bestDist}(\text{"centxralz"}, \text{City}) = \min(8, 7) = \mathbf{7}$ (không phải 8 hay 9).
    - $\implies \text{bestDist}(\text{"centxralz"}, \text{Address}) = \min(9, 8, 8, 8, 8, 8, 7) = \mathbf{7}$ (không phải 8).
    - $\implies \text{bestDist}(\text{"centxralz"}, \text{Name}) = \mathbf{2}$ (khớp với token `"central"` qua 2 phép xóa 'x' và 'z').
    - Điểm RelevanceScore cho P2: $\max(50, 0, 0) = \mathbf{50}$ (`Name`).
- **Xây dựng Công cụ Kiểm chứng Ngoại tuyến Độc lập (Offline Deterministic Verifier Artifact):**
  - File mã nguồn verifier: [`docs/agent-coordination/evidence/verify-fuzzy-contract.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/verify-fuzzy-contract.cjs).
  - File kịch bản runner: [`docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs).
  - File kết quả thực thi: [`docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`](file:///C:/Dev/hotel-saas-v2/docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt).
  - **Kết quả xác thực:** 100% test fixtures (12/12) và Same-Name Tie Break đều đạt kết quả **PASS (100% Deterministic)**.
- **Fixture Cùng Điểm Cùng Tên (Same-Name Fixed-Guid Tie Break):**
  - P2 (`22222222-2222-2222-2222-222222222222`): "Khách Sạn Central Đà Nẵng".
  - P2_TIE (`88888888-8888-8888-8888-888888888888`): "Khách Sạn Central Đà Nẵng".
  - Truy vấn `"Central Đà Nẵng"`: Cả hai cơ sở cùng đạt Score 80, cùng có chuỗi Name giống nhau.
  - Sắp xếp xác định theo `Id ASC`: P2 (`22222222-...`) đứng trước P2_TIE (`88888888-...`) (PASS).

---

### Implementation Thresholds & Scope Invariants
- **Ngưỡng cấp phát Stackalloc:** Ngưỡng $|q|, |t| \le 30$ cho `stackalloc` được khẳng định rõ trong đặc tả là **ngưỡng điều kiện phân nhánh thực thi (conditional implementation threshold)**, không phải tuyên bố rằng mọi token trong database đều $\le 30$. Khi token $> 30$, bộ đệm tự động chuyển sang thuê an toàn từ `ArrayPool<int>.Shared`.
- **Zero Code / DB / UI changes:** Không sửa đổi mã nguồn C# hay Angular, không tạo matcher hay can thiệp DB trong lát cắt hợp đồng này.
- **PO Gates giữ nguyên:** Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

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

    // 2. Tokenize & Condense
    char[] delimiters = new[] { ' ', '\t', '\r', '\n', ',', '.', '-', '_', '/', '\\', '+' };
    string[] qTokens = qNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string[] fTokens = fNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string qCondensed = string.Concat(qTokens);
    string fCondensed = string.Concat(fTokens);

    // 3. Token-Empty Guard (Tránh vacuously match khi query chỉ chứa dấu phân cách)
    if (qTokens.Length == 0) return 0;

    // 4. Score 75: All-tokens exact match (out-of-order)
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

## 3. Bảng Fixtures & Kết Quả Xác Nhận Từ Offline Verifier

| Truy vấn ($Q$) | Kỳ vọng | Chi tiết phân nhánh & Điểm số | Verifier | Thứ tự sắp xếp (Tie-Break: Score DESC, Name ASC, Id ASC) |
| :--- | :---: | :--- | :---: | :--- |
| **`"Khách Sạn Sài Gòn Central"`** | **P3** | ExactMatch Name = 100 | **PASS** | **1. P3** |
| **`"Khách Sạn Sài Gòn"`** | **P3** | PrefixMatch Name = 90 | **PASS** | **1. P3** |
| **`"Sài Gòn"`** | **P3** | SubstringMatch Name & City = 80 | **PASS** | **1. P3** |
| **`"Ha"`** *(Short Substring)* | **P4, P1, P2, P5, P3** | P4 Prefix City (90); P1, P2, P5, P3 Substring Name (80) | **PASS** | **1. P4 (90)**, **2. P1 (80)**, **3. P2 (80)**, **4. P5 (80)**, **5. P3 (80)** |
| **`"Central Sài Gòn"`** | **P3** | AllTokensExactMatch Name out-of-order = 75 | **PASS** | **1. P3** |
| **`"danang"`** *(Condensed 0)* | **P1, P2** | Condensed Tier 1 City dist = 0 | **PASS** | **1. P1, 2. P2** |
| **`"da nag"`** *(Multi-token)* | **P1, P2** | Token Tier 1: "da" (eff 0) + "nag" (dist 1) | **PASS** | **1. P1, 2. P2** |
| **`"centraal"`** *(Xóa 1 'a')* | **P2, P3** | Token Tier 1: "centraal" dist = 1 tới "central" | **PASS** | **1. P2, 2. P3** |
| **`"centxralz"`** *(Lỗi cấp 2)* | **P2, P3** | Token Tier 2: "centxralz" dist = 2 tới "central" | **PASS** | **1. P2, 2. P3** |
| **`"nhxtrangg"`** *(Multiword)* | **P7** | Condensed Tier 2: dist = 2 tới "nhatrang" | **PASS** | **1. P7** |
| **`", -"`** *(Punctuation)* | **—** | Literal Substring 0; Token-Empty Guard dừng | **PASS** | `[]` (Mảng rỗng) |
| **`"Danang xyz"`** *(Rejection)* | **—** | "xyz" bestDist > 1; All-Token Guard loại bỏ | **PASS** | `[]` (Mảng rỗng) |
| **`"Central Đà Nẵng"`** *(Tie)* | **P2, P2_TIE** | Cùng Score 80, cùng Name $\rightarrow$ Sort Id ASC | **PASS** | **1. P2 (22222222-...), 2. P2_TIE (88888888-...)** |

---

## 4. Danh Mục Minh Chứng (Evidence)

1. `docs/p5-guest-search-contract-proposal.md`: Đặc tả kỹ thuật Version 6.0 hoàn chỉnh (Round 4 - Final Executable Consistency Pass).
2. `docs/agent-coordination/evidence/verify-fuzzy-contract.cjs`: Mã nguồn module Offline Deterministic Verifier.
3. `docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`: Kịch bản runner kiểm chứng toàn bộ fixtures và ma trận khoảng cách.
4. `docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`: Kết quả thực thi verifier xác nhận 100% test fixtures PASS.
5. `docs/agent-coordination/submission.md`: Tường trình Round 4 chi tiết giải quyết toàn diện 2 findings từ Codex Review Round 3.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối.