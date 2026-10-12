# Submission P5-FUZZY-MATCHER-02 — Round 1

- **TaskId:** `P5-FUZZY-MATCHER-02`
- **Round:** 1
- **SubmissionId:** `sub-p5-fuzzy-matcher-02-r1-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Triển khai helper thuần C# độc lập trong Application (`HotelSaas.Application.Common.Utils.FuzzyPropertyMatcher`) và bộ unit test xUnit đầy đủ (`HotelSaas.Application.Tests.Public.FuzzyPropertyMatcherTests`). **Tuyệt đối không wiring vào Handler/Controller/API runtime, không chạm Database dev/staging/prod, không thay đổi schema/migration/policy/inventory/pricing, không ảnh hưởng Angular UI hay module của đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Baseline Checkout & Tình Trạng Mã Nguồn
- **Môi trường:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` | **HEAD:** `3f95339` (`feat(auth): implement Auth + RBAC - Phase 1A complete`).
- **Dirty Baseline:** Tồn tại các file untracked/modified từ các lát cắt trước đã được nghiệm thu (P1A, P1B, P2A, P5, P7).
- **Ranh giới cô lập:** Chỉ thêm 1 file production helper thuần (`backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`) và 1 file unit test (`backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`). Không có bất kỳ thay đổi nào lên DI container, middleware, controller hay handler.

---

## 2. Triển Khai Helper Thuần C# (`FuzzyPropertyMatcher.cs`)

File: [`backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`](file:///C:/Dev/hotel-saas-v2/backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs)

### Các tính năng cốt lõi:
1. **Chuẩn hóa tái sử dụng (Normalization):**
   - Tái sử dụng `VietnameseTextNormalizer.Normalize`: xử lý `đ`/`Đ` $\rightarrow$ `d`, phân rã Form D (NFD), loại bỏ toàn bộ `\p{Mn}` NonSpacingMark, tái cấu trúc Form C (NFC), `ToLowerInvariant()`, `Trim()`.
2. **So khớp Literal bằng Ordinal tuyệt đối:**
   - ExactMatch (100): `fNorm.Equals(qNorm, StringComparison.Ordinal)`
   - PrefixMatch (90): `fNorm.StartsWith(qNorm, StringComparison.Ordinal)`
   - SubstringMatch (80): `fNorm.Contains(qNorm, StringComparison.Ordinal)`
   - Loại trừ hoàn toàn phụ thuộc văn hóa (culture-insensitive, pure ordinal).
3. **Phân tách Token & Chuỗi Condensed:**
   - Delimiters chuẩn C#: `char[] { ' ', '\t', '\r', '\n', ',', '.', '-', '_', '/', '\\', '+' }`.
   - Tokenize: `qNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries)`.
   - Condense: `string.Concat(tokens)`.
4. **Token-Empty Guard:**
   - Khi truy vấn chỉ chứa dấu câu (ví dụ `", -"`), sau khi tokenize mảng token rỗng (`qTokens.Length == 0`). Hệ thống lập tức trả về `0`, ngăn chặn việc khớp rỗng chân không (vacuous match) vào các nhánh 75/60/50.
5. **Score 75 — All-tokens exact match (Token Reuse):**
   - Áp dụng khi `qTokens.Length >= 2`. Mỗi query token $q$ có `BestDistance(q, fTokens) == 0`. Hỗ trợ tái sử dụng token (ví dụ `"central central"` khớp cơ sở chỉ có 1 từ `"central"`).
6. **Score 60 — TypoTolerantTier1 / Condensed Tier 1 (Hai Nhánh Độc Lập):**
   - *Nhánh Token:* Mọi token đều thỏa mãn ngân sách lỗi (độ dài $\le 2$: dist = 0; độ dài $\ge 3$: dist $\le 1$).
   - *Nhánh Condensed:* Áp dụng khi truy vấn là 1 token đơn lẻ, `qCondensed.Length >= 4`, `fCondensed.Length > 0`, và `OsaDistance(qCondensed, fCondensed) <= 1`.
7. **Score 50 — TypoTolerantTier2 / Condensed Tier 2 (Hai Nhánh Độc Lập):**
   - *Nhánh Token:* Mọi token đều trong ngân sách (độ dài $\le 2$: 0; 3..5: 1; $\ge 6$: 2), VÀ có ít nhất một token dài $\ge 6$ đạt khoảng cách = 2.
   - *Nhánh Condensed:* Áp dụng khi truy vấn là 1 token đơn lẻ, `qCondensed.Length >= 6`, `fCondensed.Length > 0`, và `OsaDistance(qCondensed, fCondensed) == 2`.
8. **Khoảng cách Tối ưu Xếp hàng Chuỗi (Restricted Damerau-Levenshtein / OSA):**
   - Hỗ trợ thêm, xóa, sửa, và hoán vị 2 ký tự liền kề kề nhau.
   - Tuân thủ chặt chẽ ngữ nghĩa restricted OSA: một đoạn ký tự không được sửa đổi quá 1 lần (ví dụ `"CA"` $\rightarrow$ `"ABC"` khoảng cách là 3, không phải 2 như unrestricted Damerau).
   - **Tối ưu bộ nhớ & an toàn luồng:**
     - Với các chuỗi thông thường (tổng số ô ma trận $\le 1024$, tương ứng độ dài token $\le 30$), sử dụng `stackalloc int[...]` trên thread stack.
     - Với chuỗi dài hơn, thuê mảng từ `ArrayPool<int>.Shared.Rent(...)` và hoàn trả trong khối `finally`.
     - Không sử dụng bất kỳ mảng tĩnh (`static[,]`) hay tài nguyên chia sẻ nào.
     - Bảo toàn toàn bộ chiều dài truy vấn, không âm thầm cắt ngắn chuỗi (no silent truncation).
9. **Cơ chế Tie-Breaking & Sắp xếp Kết quả bằng Native .NET Comparators:**
   - Thứ tự sắp xếp tuyệt đối: `Score DESC`, `Name ASC` (`StringComparer.OrdinalIgnoreCase`), `Id ASC` (`Guid.CompareTo`).
   - Sử dụng các bộ so sánh gốc của .NET CoreCLR, bảo đảm sự tương thích 100% với môi trường backend thực tế.
10. **Bypass Truy vấn Rỗng & Normalized-Empty:**
    - Truy vấn null/whitespace hoặc truy vấn sau chuẩn hóa rỗng (như dấu thanh đơn lẻ `"\u0301"`): trả về toàn bộ các cơ sở có `Status == PropertyStatus.Active` theo thứ tự `Name ASC`, `Id ASC`.
    - Cơ sở có `Status == PropertyStatus.Inactive` luôn bị loại trừ 100%.

---

## 3. Bộ Unit Test Đầy Đủ & Kết Quả Thực Thi (`FuzzyPropertyMatcherTests.cs`)

File: [`backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`](file:///C:/Dev/hotel-saas-v2/backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs)

### Lệnh thực thi:
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --filter "FullyQualifiedName~FuzzyPropertyMatcherTests" --logger "console;verbosity=normal"
```

### Kết quả:
- **Total tests:** 42
- **Passed:** 42 (100%)
- **Failed:** 0
- **Duration:** 5.04s
- **Exit code:** 0

### Chi tiết các nhóm test:
1. **Trace số bước chỉnh sửa & khoảng cách OSA:**
   - `centxralz` $\rightarrow$ `da`: OSA = 8 (7 xóa + 1 thay thế) $\rightarrow$ **PASS**
   - `centxralz` $\rightarrow$ `nang`: OSA = 7 (5 xóa + 2 thay thế) $\rightarrow$ **PASS**
   - `centxralz` $\rightarrow$ `chau`: OSA = 7 $\rightarrow$ **PASS**
   - `centxralz` $\rightarrow$ `central`: OSA = 2 (2 xóa) $\rightarrow$ **PASS**
   - Trace P2 ("Khách Sạn Central Đà Nẵng"): Name bestDist = 2, City bestDist = 7, Address bestDist = 7 $\rightarrow$ Điểm 50 trên field Name $\rightarrow$ **PASS**
   - `nhxtrangg` $\rightarrow$ `nhatrang`: OSA = 2 (2 xóa) $\rightarrow$ **PASS**
   - Truy vấn `"Sài Gòn"`: khớp P3 Name (Score 80), không khớp P3 City (Score 0) $\rightarrow$ **PASS**
2. **Chuẩn hóa Unicode & NonSpacingMark:**
   - `a\u1ab0` chuẩn hóa thành `"a"` (NonSpacingMark stripped) $\rightarrow$ **PASS**
   - Ký tự dấu thanh rời rạc `\u0301` chuẩn hóa thành chuỗi rỗng `""` $\rightarrow$ **PASS**
   - `đ` và `Đ` đều chuẩn hóa thành `"d"` $\rightarrow$ **PASS**
3. **Bộ so sánh Native .NET:**
   - `StringComparer.OrdinalIgnoreCase.Compare("Z Hotel", "Á Hotel") < 0` (ASCII đứng trước ký tự có dấu) $\rightarrow$ **PASS**
   - `StringComparer.OrdinalIgnoreCase.Compare("Straße", "STRASSE") > 0` (Dấu dương 140 trong CoreCLR) $\rightarrow$ **PASS**
   - `StringComparer.OrdinalIgnoreCase.Compare("\u1F80", "\u1F88") == 0` (Cặp Hy Lạp bằng nhau trong bảng mã invariant của .NET) $\rightarrow$ **PASS**
   - `StringComparer.OrdinalIgnoreCase.Compare("Hotel A", "hotel a") == 0` $\rightarrow$ **PASS**
   - 5 nhóm bất đối xứng Guid (`Guid.CompareTo`): Group 1 (_a numeric), Group 2 (_b numeric), Group 3 (_c numeric), Group 4 (_d byte), Group 5 (_k byte) đều có kết quả < 0 $\rightarrow$ **PASS**
4. **Kiểm tra Toàn Bộ Mảng Kết Quả (All 15 Approved Fixtures):**
   - `Khách Sạn Sài Gòn Central` $\rightarrow$ `[{ P3, 100 }]`
   - `Khách Sạn Sài Gòn` $\rightarrow$ `[{ P3, 90 }]`
   - `Sài Gòn` $\rightarrow$ `[{ P3, 80 }]`
   - `Central Sài Gòn` $\rightarrow$ `[{ P3, 75 }]`
   - `central central` $\rightarrow$ `[{ P2, 75 }, { P2_TIE, 75 }, { P3, 75 }]`
   - `danang` $\rightarrow$ `[{ P1, 60 }, { P2, 60 }, { P2_TIE, 60 }]`
   - `da nag` $\rightarrow$ `[{ P1, 60 }, { P2, 60 }, { P2_TIE, 60 }]`
   - `centraal` $\rightarrow$ `[{ P2, 60 }, { P2_TIE, 60 }, { P3, 60 }]`
   - `Haoni` $\rightarrow$ `[{ P4, 60 }]`
   - `centxralz` $\rightarrow$ `[{ P2, 50 }, { P2_TIE, 50 }, { P3, 50 }]`
   - `nhxtrangg` $\rightarrow$ `[{ P7, 50 }]`
   - `Ha` $\rightarrow$ `[{ P4, 90 }, { P1, 80 }, { P2, 80 }, { P2_TIE, 80 }, { P5, 80 }, { P7, 80 }, { P3, 80 }]`
   - `", -"` $\rightarrow$ `[]` (Token-Empty Guard)
   - `Danang xyz` $\rightarrow$ `[]` (All-Token Guard)
   - `Central Đà Nẵng` $\rightarrow$ `[{ P2, 80 }, { P2_TIE, 80 }]` (Tie-break Id ASC: 2222... < 8888...)
   - Tất cả 15 fixtures đều đạt **PASS** 100%.
5. **Bypass Truy vấn Rỗng & Loại trừ Inactive:**
   - Truy vấn `""`, `"   "`, `"\u0301"` trả về toàn bộ 7 cơ sở Active, đúng thứ tự `Name ASC`, `Id ASC`. P6 (`Inactive`) bị loại trừ hoàn toàn $\rightarrow$ **PASS**.
6. **Kiểm tra Biên, Ngữ Nghĩa OSA & Quản lý Bộ Nhớ:**
   - Empty target tokens: `BestDistance` trả về `int.MaxValue` $\rightarrow$ **PASS**.
   - Phân biệt OSA (Restricted) vs Unrestricted Damerau: `"CA"` $\rightarrow$ `"AC"` = 1; `"CA"` $\rightarrow$ `"ABC"` = 3 $\rightarrow$ **PASS**.
   - Ngưỡng ngân sách lỗi theo độ dài token (TokenBudget): len $\le$ 2 là 0, len 3..5 là 1, len $\ge$ 6 là 2 $\rightarrow$ **PASS**.
   - Chuỗi dài > 30 ký tự: kích hoạt nhánh `ArrayPool<int>.Shared`, tính toán chính xác, không tràn stack, không cắt chuỗi $\rightarrow$ **PASS**.
   - Literal matching cho dấu câu: nếu trường chứa đúng literal `", -"`, trả về điểm 80 $\rightarrow$ **PASS**.

---

## 4. Danh Mục Minh Chứng (Evidence)

1. `backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`: Production helper thuần C#.
2. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: Toàn bộ 42 unit tests kiểm thực.
3. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 Approved.
4. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET.
5. `docs/agent-coordination/submission.md`: Bản tường trình Submission Round 1.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.