# Submission P5-FUZZY-MATCHER-02 — Round 3

- **TaskId:** `P5-FUZZY-MATCHER-02`
- **Round:** 3
- **SubmissionId:** `sub-p5-fuzzy-matcher-02-r3-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Hoàn thiện kiểm thử và minh chứng cho helper thuần C# độc lập trong Application (`HotelSaas.Application.Common.Utils.FuzzyPropertyMatcher`) và bộ unit test xUnit (`HotelSaas.Application.Tests.Public.FuzzyPropertyMatcherTests`) đáp ứng 100% các tiêu chí review Round 2 từ Codex. **Tuyệt đối không wiring vào Handler/Controller/API runtime, không chạm Database dev/staging/prod, không thay đổi schema/migration/policy/inventory/pricing, không ảnh hưởng Angular UI hay module của đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Giải Quyết Toàn Diện Các Phát Hiện Review Round 2 (Codex Review Resolution)

### Finding 1 (P2): Xác Minh Thực Tế Nhánh Bộ Đệm ArrayPool (Both Lengths $\ge 170$)
1. **Làm rõ và nhất quán ngưỡng bộ đệm:**
   - Ngưỡng `totalCells = checked(3 * width)` với `width = min(len1, len2) + 1`.
   - `totalCells <= 512` (~2KiB stack) cấp phát trên thread stack (`stackalloc int[totalCells]`). Ngưỡng này tương ứng với chuỗi ngắn hơn có độ dài $\le 169$ ký tự.
   - Nhánh `ArrayPool<int>.Shared.Rent(totalCells)` bắt đầu kích hoạt khi chuỗi ngắn hơn có độ dài $\ge 170$ ký tự (`totalCells = 3 * 171 = 513 > 512`), và luôn được trả lại trong khối `finally`.
2. **Bổ sung các cặp test có CẢ HAI chuỗi độ dài $\ge 170$:**
   - Cặp chuỗi đồng độ dài 175: `(new string('a', 175), new string('a', 173) + "ba")` kích hoạt `totalCells = 528 > 512`.
   - Cặp chuỗi hoán vị liền kề 180 ký tự: `trans180A` (30 khối `"abcdef"`) vs `trans180B` (30 khối `"abdcfe"`), kích hoạt `totalCells = 543 > 512`, kiểm thử 60 hoán vị liền kề vượt qua các chu kỳ xoay dòng cuộn modulo 3 trên bộ nhớ thuê.
   - Cặp chuỗi lệch kích thước (mixed widths) với cả hai $\ge 170$: độ dài 180 vs 210 ký tự (`mixed180` vs `mixed210`), kích hoạt `totalCells = 543 > 512`.
   - Cặp chuỗi lệch kích thước có hoán vị và sửa ký tự: độ dài 175 vs 192 ký tự (`mixedEdits175` vs `mixedEdits192`), kích hoạt `totalCells = 528 > 512`.
   - Giữ lại các cặp độ dài ngắn và trung bình để đồng thời kiểm thực nhánh `stackalloc`.
3. **Kiểm thử đối chiếu tuần tự và đồng thời với Test Oracle:**
   - Kiểm thử 5 lần lặp tuần tự (đối xứng cả hai chiều `(s1, s2)` và `(s2, s1)`) so sánh với `FullMatrixOsaDistance`.
   - Kiểm thử đồng thời qua `Parallel.For(0, 50, ...)` với 50 tác vụ chạy song song trên toàn bộ các cặp test bao gồm các cặp $\ge 170$, xác nhận không xảy ra race condition, tái sử dụng mảng trong pool an toàn và kết quả luôn khớp 100% với oracle ma trận đầy đủ.

### Finding 2 (P2): Kiểm Thử Đúng Biên Độ Dài 6, Độ Dài 5 & Vệ Sinh Chú Thích
1. **Kiểm thử chính xác độ dài 6 (Score 60, Score 50, Score 0):**
   - Sử dụng multi-token query (`qTokens.Length == 2`) với anchor token `"bien"` (độ dài 4, khớp chính xác trong mục tiêu `"Khu du lich bien hoang resort"`):
     - Chấp nhận Tier 1 (khoảng cách 1): query `"bien resorx"` (`"resorx"` độ dài 6, dist 1 $\le 1$) $\rightarrow$ đạt **Score 60**.
     - Chấp nhận Tier 2 (khoảng cách 2): query `"bien rexxrt"` (`"rexxrt"` độ dài 6, dist 2 $\le 2$, thỏa mãn điều kiện có token độ dài $\ge 6$ với dist = 2) $\rightarrow$ đạt **Score 50**.
     - Loại bỏ (khoảng cách 3): query `"bien rexxxt"` (`"rexxxt"` độ dài 6, dist 3 > 2) $\rightarrow$ trả về **Score 0**.
2. **Kiểm thử chính xác độ dài 5 (Score 60 vs Score 0):**
   - Chấp nhận Tier 1 (khoảng cách 1): query `"bien hxang"` (`"hxang"` độ dài 5, dist 1 $\le 1$) $\rightarrow$ đạt **Score 60**.
   - Loại bỏ khi khoảng cách 2: query `"bien hxxng"` (`"hxxng"` độ dài 5, dist 2 > 1). Vì độ dài 5 chỉ có ngân sách tối đa là 1 (không có ngân sách 2 ở Tier 2) $\rightarrow$ trả về **Score 0**.
3. **Kiểm thử độ dài 2 và độ dài 3 qua multi-token:**
   - Độ dài 2: `"biex du"` (dist 0) đạt **Score 60**; `"biex dx"` (dist 1 > 0) trả về **Score 0**.
   - Độ dài 3: `"bien khx"` (dist 1 $\le 1$) đạt **Score 60**; `"bien kxx"` (dist 2 > 1) trả về **Score 0**.
   - Việc dùng multi-token loại trừ hoàn toàn nhánh Condensed (`qTokens.Length == 1`), bảo đảm cô lập và kiểm thực chính xác nhánh tính điểm token.
4. **Vệ sinh chú thích mã nguồn (Comment Hygiene):**
   - Loại bỏ toàn bộ inline comments trong phương thức test `ScoreField_LengthBoundaryThresholds_RejectionAndAcceptance`, tuân thủ nghiêm ngặt quy tắc mã nguồn sạch.

---

## 2. Kết Quả Kiểm Thử Toàn Diện (Unit Test Execution)

### Lệnh thực thi:
```powershell
dotnet test backend/tests/HotelSaas.Application.Tests/HotelSaas.Application.Tests.csproj --no-restore --filter "FullyQualifiedName~FuzzyPropertyMatcherTests" --logger "console;verbosity=normal"
```

### Kết quả:
- **Total tests:** 46
- **Passed:** 46 (100%)
- **Failed:** 0
- **Duration:** 2.66s
- **Exit code:** 0

### Bảng phân bổ test cases (46/46 passed):
| Nhóm kiểm thử | Số lượng test | Trạng thái |
|---|---|---|
| Approved Fixtures (15 kịch bản chuẩn từ Contract v9.0) | 15 | PASS |
| Trace khoảng cách OSA & Field Matching (P2, P3, P7) | 7 | PASS |
| Chuẩn hóa Unicode (đ/Đ, NonSpacingMark `\p{Mn}`, Combining Mark) | 4 | PASS |
| Bộ so sánh Native .NET (OrdinalIgnoreCase, Guid groups) | 5 | PASS |
| Matcher-Level Sorting (Greek tie, Straße, ASCII case ties) | 7 | PASS |
| Ngưỡng biên độ dài token 2, 3, 5, 6 (Multi-token isolated branches) | 1 | PASS |
| NFC / NFD Query Equivalence | 1 | PASS |
| Sequential & Concurrent 50 Threads vs Full Matrix Oracle (exercising ArrayPool $\ge 170$) | 1 | PASS |
| Ngữ nghĩa Restricted OSA & Token-Empty Guard & Literal Match | 5 | PASS |

---

## 3. Danh Mục Minh Chứng (Evidence)

1. `backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`: Helper thuần C# với thuật toán 3-row rolling buffer $O(\min(l_1, l_2))$, `checked` arithmetic, stackalloc $\le 512$, `ArrayPool<int>.Shared`.
2. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests bao phủ toàn diện matcher sorting, boundary budgets (2, 3, 5, 6), test oracle tuần tự và đồng thời với chuỗi $\ge 170$.
3. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 Approved.
4. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET CoreCLR.
5. `docs/agent-coordination/submission.md`: Bản tường trình Submission Round 3.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.