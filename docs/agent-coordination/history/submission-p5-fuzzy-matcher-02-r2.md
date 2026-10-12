# Submission P5-FUZZY-MATCHER-02 — Round 2

- **TaskId:** `P5-FUZZY-MATCHER-02`
- **Round:** 2
- **SubmissionId:** `sub-p5-fuzzy-matcher-02-r2-20261011`
- **Status:** `Submitted`
- **Dependency:** `P5-FUZZY-CONTRACT-02` Round 7 Approved (`sub-p5-fuzzy-contract-02-r7-20261011`).
- **Scope:** Hoàn thiện helper thuần C# độc lập trong Application (`HotelSaas.Application.Common.Utils.FuzzyPropertyMatcher`) và mở rộng bộ unit test xUnit (`HotelSaas.Application.Tests.Public.FuzzyPropertyMatcherTests`) đáp ứng 100% các tiêu chí review Round 1 từ Codex. **Tuyệt đối không wiring vào Handler/Controller/API runtime, không chạm Database dev/staging/prod, không thay đổi schema/migration/policy/inventory/pricing, không ảnh hưởng Angular UI hay module của đồng đội**. Toàn bộ 5 PO Gates và 2 Business Gates giữ nguyên trạng thái `NeedsPO`.

---

## 1. Giải Quyết Toàn Diện Các Phát Hiện Review Round 1 (Codex Review Resolution)

### Finding 1 (P2): Tối Ưu Hóa Bộ Nhớ Ma Trận OSA Thành 3 Dòng Cuộn $O(\min(l_1, l_2))$
1. **Chuyển đổi từ ma trận toàn phần $(l_1+1)(l_2+1)$ sang 3 dòng cuộn:**
   - Hoán vị chuỗi sao cho chuỗi ngắn hơn luôn là $S_2$ với độ dài $M = \min(l_1, l_2)$.
   - Chiều rộng mỗi dòng là $W = M + 1$.
   - Vì thuật toán Optimal String Alignment (restricted Damerau-Levenshtein) chỉ cần truy cập dòng hiện tại $i$, dòng trước $i-1$, và dòng $i-2$ cho phép chuyển vị liền kề (adjacent transposition), đúng 3 dòng $3 \times W$ là đủ.
   - Dung lượng bộ nhớ giảm từ bậc hai $O(L \cdot M)$ xuống tuyến tính theo chuỗi ngắn $O(\min(l_1, l_2))$.
2. **Số học an toàn (Safe Arithmetic):**
   - Sử dụng `checked(3 * width)` khi tính kích thước bộ đệm `totalSize`, bảo đảm ngăn chặn triệt để integer overflow.
3. **Ngưỡng Stackalloc & Thuê Bộ Đệm An Toàn Luồng:**
   - Ngưỡng stackalloc: nếu `totalSize <= 512` phần tử (tương đương chuỗi ngắn có độ dài lên tới ~169 ký tự), cấp phát trực tiếp trên thread stack bằng `stackalloc int[totalSize]`.
   - Khi `totalSize > 512`: thuê mảng an toàn từ `ArrayPool<int>.Shared.Rent(totalSize)` và trả lại mảng trong khối `finally` (`ArrayPool<int>.Shared.Return(rented)`).
4. **Bảo toàn ngữ nghĩa hoán vị Restricted OSA qua Modulo-3 Indexing:**
   - `currOffset = (i % 3) * W`
   - `prev1Offset = ((i + 2) % 3) * W` (tương ứng $i-1$)
   - `prev2Offset = ((i + 1) % 3) * W` (tương ứng $i-2$)
   - Kết quả cuối cùng tại $i = L$ nằm ở `buffer[(L % 3) * W + M]`.
   - Không áp dụng bất kỳ cơ chế cắt ngắn chuỗi tùy tiện nào (no silent string truncation).

### Finding 2 (P2): Bổ Sung Matcher-Level Tests, Boundary Tests & Test Oracle
1. **Matcher-Level Sorting Tests:**
   - `CompareProperties_GreekEquivalentNames_ResolvedByGuidTieBreak`: Kiểm thử trực tiếp `FuzzyPropertyMatcher.CompareProperties` và `SearchProperties` với hai cơ sở có tên Hy Lạp tương đương (`U+1F80` vs `U+1F88` có `StringComparer.OrdinalIgnoreCase.Compare == 0`), xác nhận thứ tự bắt buộc được phân xử bằng `Guid.CompareTo` tie-break.
   - `CompareProperties_StrasseVsSTRASSE_ResolvedByNameWithoutGuidTieBreak`: Kiểm thử `CompareProperties` với `Straße Hotel` vs `STRASSE Hotel` cho dấu strictly positive (> 0), xác nhận phân xử trực tiếp bằng tên mà không cần rơi vào Guid tie-break.
   - `CompareProperties_AsciiCaseTies_ResolvedByAsymmetricGuidGroups`: Kiểm thử `CompareProperties` với các cặp tên bằng nhau tuyệt đối theo OrdinalIgnoreCase (`"Hotel A"` vs `"hotel a"`) trên toàn bộ 5 nhóm GUID bất đối xứng (Group 1: `_a` numeric, Group 2: `_b` numeric, Group 3: `_c` numeric, Group 4: `_d` byte, Group 5: `_k` byte), xác nhận kết quả < 0 nhất quán.
2. **Score Boundary Rejection/Acceptance Tests (Độ dài 2, 3, 5, 6):**
   - `ScoreField_LengthBoundaryThresholds_RejectionAndAcceptance`: Kiểm thử chi tiết biên phân lớp độ dài token với multi-token queries:
     - Độ dài 2: Ngân sách lỗi 0. Truy vấn `"da nag"` chấp nhận điểm 60; `"dx nag"` (1 lỗi) bị loại (điểm 0).
     - Độ dài 3: Ngân sách lỗi 1. Truy vấn `"dan nag"` (1 lỗi) chấp nhận điểm 60; `"dxx nag"` (2 lỗi) bị loại (điểm 0).
     - Độ dài 5: Ngân sách lỗi 1 cho Tier 1 (điểm 60).
     - Độ dài 6: Ngân sách lỗi 2 cho Tier 2 (điểm 50).
3. **NFC vs NFD Query Equivalence:**
   - `SearchProperties_NfcAndNfdQueries_ProduceIdenticalOutputs`: Kiểm thử `SearchProperties` với chuỗi truy vấn tiếng Việt ở dạng NFC và NFD, xác nhận cả mảng định danh (`Id`) và điểm số (`Score`) giống nhau 100%.
4. **Repeat & Concurrent Test Oracle (Long Buffers):**
   - `OsaDistance_RepeatAndConcurrentComparisonsAgainstFullMatrixOracle`: Tạo private test oracle `FullMatrixOsaDistance` (ma trận 2D đầy đủ).
   - Thực hiện 5 lần lặp tuần tự và 50 tác vụ song song `Parallel.For` trên các chuỗi dài (> 30 ký tự và > 170 ký tự kích hoạt `ArrayPool`), so sánh đối chiếu giữa bộ đệm 3 dòng cuộn và ma trận oracle, xác nhận kết quả khớp 100%, tái sử dụng bộ đệm trơn tru và hoàn toàn thread-safe.
5. **Vệ sinh chú thích mã nguồn (Comment Hygiene):**
   - Loại bỏ toàn bộ các inline comment phân bua mới thêm vào `FuzzyPropertyMatcher.cs`, bảo đảm phong cách mã nguồn sạch, chuyên nghiệp theo chuẩn enterprise.

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
- **Duration:** 2.85s
- **Exit code:** 0

### Bảng phân bổ test cases (46/46 passed):
| Nhóm kiểm thử | Số lượng test | Trạng thái |
|---|---|---|
| Approved Fixtures (15 kịch bản chuẩn từ Contract v9.0) | 15 | PASS |
| Trace khoảng cách OSA & Field Matching (P2, P3, P7) | 7 | PASS |
| Chuẩn hóa Unicode (đ/Đ, NonSpacingMark `\p{Mn}`, Combining Mark) | 4 | PASS |
| Bộ so sánh Native .NET (OrdinalIgnoreCase, Guid groups) | 5 | PASS |
| Matcher-Level Sorting (Greek tie, Straße, ASCII case ties) | 7 | PASS |
| Ngưỡng biên độ dài (Length boundaries 2, 3, 5, 6) | 1 | PASS |
| NFC / NFD Query Equivalence | 1 | PASS |
| Repeat & Concurrent 50 Threads vs Full Matrix Oracle | 1 | PASS |
| Ngữ nghĩa Restricted OSA & Token-Empty Guard & Literal Match | 5 | PASS |

---

## 3. Danh Mục Minh Chứng (Evidence)

1. `backend/src/HotelSaas.Application/Common/Utils/FuzzyPropertyMatcher.cs`: Helper thuần C# với thuật toán 3-row rolling buffer $O(\min(l_1, l_2))$, `checked` arithmetic, stackalloc $\le 512$, `ArrayPool<int>.Shared`.
2. `backend/tests/HotelSaas.Application.Tests/Public/FuzzyPropertyMatcherTests.cs`: 46 unit tests bao phủ toàn diện matcher sorting, boundary budgets, test oracle, và thread safety.
3. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 9.0 Approved.
4. `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`: Bằng chứng so sánh runtime .NET CoreCLR.
5. `docs/agent-coordination/submission.md`: Bản tường trình Submission Round 2.
6. `docs/agent-coordination/assignment.md` & `docs/agent-coordination/decisions.md`: Hồ sơ điều phối dự án.