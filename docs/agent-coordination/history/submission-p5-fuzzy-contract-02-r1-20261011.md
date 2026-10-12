# Báo Cáo Nghiệm Thu: P5-FUZZY-CONTRACT-02 (Round 1)

- **TaskId:** P5-FUZZY-CONTRACT-02
- **Round:** 1
- **SubmissionId:** sub-p5-fuzzy-contract-02-r1-20261011
- **ReviewedSubmissionId:** sub-p7-guest-search-verify-02-r3-20261011
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** 2026-10-11T12:53:00+07:00
- **Actor:** antigravity
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Invariants)

1. **Nhiệm vụ đặc tả hợp đồng thuần túy (Documentation-only):** Toàn bộ công việc tập trung cập nhật và đóng kín tài liệu hợp đồng kỹ thuật tại [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md). Tuyệt đối **không can thiệp mã nguồn backend C#**, không tạo class matcher mới, không sửa handler hay API trước khi hợp đồng được review và phê duyệt.
2. **0 kết nối database ngoài:** Không cấu hình và không gửi yêu cầu tới bất kỳ database dev, staging hay production nào (0 connection strings, 0 migrations).
3. **0 vi phạm quyền sở hữu module của đồng đội:** Giữ nguyên vẹn mã nguồn của các module Nguyên (`Rooms`/`RoomTypes`) và Tân (`Housekeeping`).
4. **Bảo tồn giao diện khách hàng (Angular UI):** Toàn bộ giao diện khách và service client frontend đã được nghiệm thu kỹ thuật và browser verification tại P5/P7 được bảo lưu nguyên vẹn; hợp đồng fuzzy giữ nguyên 100% định dạng mảng `PublicPropertyDto[]`.
5. **Ranh giới nghiệp vụ bất biến:**
   - Tuyệt đối **KHÔNG fuzzy** ngày nhận/trả phòng (`checkInDate`, `checkOutDate`), số lượng khách (`numberOfGuests`), giá phòng (`price`) hay tình trạng phòng trống (`availability`).
   - Chỉ áp dụng lọc trên các cơ sở lưu trú có trạng thái hoạt động: `p.Status == PropertyStatus.Active` (Active-only).
   - Khi không có cơ sở nào thỏa mãn, trả về **mảng rỗng `[]`** với mã HTTP 200 OK.

---

## 2. Giải Quyết Triệt Để 5 Yêu Cầu Kỹ Thuật Từ Reviewer Codex

Bản hợp đồng kỹ thuật tại [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md) (Phiên bản 3.0) đã hiệu chỉnh toàn diện và chính xác cả 5 điểm kỹ thuật được Reviewer Codex chỉ ra:

### Finding 1: Fixture `"Ha"` $\rightarrow$ P5 Đạt Substring 80 Theo Max-Score Rule
- **Hiện tượng bản cũ:** Fixture `"Ha"` ghi nhận P5 nhận điểm 75 do xem xét token match `"ha"`.
- **Khắc phục chuẩn xác:**
  - P5 ("Khách Sạn Hạ Long Bay") sau khi qua pipeline chuẩn hóa có tên: `"khach san ha long bay"`.
  - Chuỗi `"ha"` xuất hiện như một chuỗi con liên tiếp nằm trong Name $\rightarrow$ thỏa mãn quy tắc `SubstringMatch` (Score = 80).
  - Áp dụng **Max-Score Rule** $\text{RelevanceScore}(P) = \max(\text{Score}(P.\text{Name}), \dots)$: giá trị cao nhất đạt được giữa Substring (80) và AllTokensExact (75) là $\mathbf{80}$.
  - Do đó P5 nhận **Score = 80**.
  - P4 ("Khách Sạn Hà Nội Horizon", City = "Hà Nội") đạt City prefix match `"ha noi"` $\rightarrow$ nhận **Score = 90** (`PrefixMatch`).
  - Thứ tự xếp hạng trả về chuẩn xác: **1. P4 (Score 90), 2. P5 (Score 80)**.

### Finding 2: Khoảng Cách Cho `"Nhatrangg"` $\rightarrow$ `"nhatrang"` Là 1 (Không Phải 2)
- **Hiện tượng bản cũ:** Ví dụ `"Nhatrangg"` bị ghi nhầm là distance 2.
- **Khắc phục chuẩn xác:**
  - Chuỗi truy vấn condensed: `"nhatrangg"` (độ dài 9 ký tự).
  - Chuỗi mục tiêu condensed: `"nhatrang"` (độ dài 8 ký tự).
  - Chênh lệch duy nhất là 1 ký tự `'g'` thừa ở cuối $\rightarrow$ Khoảng cách Optimal String Alignment (OSA) / Levenshtein **đúng bằng 1** (không phải 2).

### Finding 3: Điểm 50 Bắt Buộc ALL Tokens Đạt Ngưỡng (All-Query-Tokens Guard)
- **Quy tắc chuẩn xác cho `Score = 50` (`TypoTolerantMatchTier2`):**
  - Bắt buộc **TẤT CẢ các token trong $Q_{tokens}$ đều phải đạt ngưỡng khớp** với ít nhất một token trong trường mục tiêu. Tuyệt đối không chấp nhận truy vấn có chứa token thừa không khớp.
  - Cụ thể: các token ngắn $\le 2$ ký tự phải Exact/Prefix; các token $\ge 3$ ký tự có distance $\le 1$; và ít nhất một token $\ge 6$ ký tự có distance = 2 (hoặc condensed distance = 2 cho chuỗi condensed $\ge 6$ ký tự).
  - Nếu tồn tại bất kỳ token nào trong query không đạt ngưỡng $\rightarrow$ loại bỏ hoàn toàn (`Score = 0`).

### Finding 4: Chuỗi Condensed Dài $\ge 7$ Với Distance 1 Đạt Score 60 (Không Tự Hạ Xuống 50)
- **Quy tắc chuẩn xác cho Condensed Query:**
  - Áp dụng cho truy vấn từ đơn duy nhất (1 token không chứa khoảng trắng).
  - Với mọi chuỗi condensed có độ dài $\ge 4$ ký tự (bao gồm cả các từ dài $\ge 7$ ký tự như `"nhatrangg"`, `"danangg"`, `"saigonnn"`): nếu khoảng cách OSA distance tới condensed string của trường mục tiêu bằng 1 $\rightarrow$ gán **Score = 60** (`TypoTolerantMatchTier1`), tuyệt đối không bị hạ xuống 50.
  - Chỉ khi condensed distance bằng 2 trên chuỗi dài $\ge 6$ ký tự mới rơi vào **Score = 50** (`TypoTolerantMatchTier2`).

### Finding 5: Quy Trình Tiền Xử Lý Chuỗi Thực Thi Xác Định (Executable Preprocessing Pipeline)
Pipeline 5 bước chuẩn hóa xác định (deterministic) được mô tả đầy đủ:
1. `Unicode Normalization Form C`: `String.Normalize(NormalizationForm.FormC)`.
2. `Diacritics Removal`: Phân rã Form D, loại bỏ `NonSpacingMark`, chuẩn hóa rõ ràng `'đ'`/`'Đ'` $\rightarrow$ `'d'`.
3. `Case Folding`: `ToLowerInvariant()`.
4. `Delimiter Tokenization`: Tách mảng token bằng tập dấu phân cách `[\s,.\-_/\\+]+` và loại bỏ token rỗng.
5. `Condensed String`: Ghép liền mạch các token (`string.Concat(tokens)`).

---

## 3. Ma Trận Thang Điểm Đóng & Phân Định Thứ Hạng (Scoring & Ranking)

### 3.1. Thang Điểm Rời Rạc Cố Định (Discrete Scores)
- **`Score = 100` (`ExactMatch`):** $T_{norm} == Q_{norm}$.
- **`Score = 90` (`PrefixMatch`):** $T_{norm}\text{.StartsWith}(Q_{norm})$.
- **`Score = 80` (`SubstringMatch`):** $T_{norm}\text{.Contains}(Q_{norm})$.
- **`Score = 75` (`AllTokensExactMatch`):** Mọi token trong $Q_{tokens}$ đều có mặt trong $T_{tokens}$.
- **`Score = 60` (`TypoTolerantTier1`):** All tokens thỏa mãn dist $\le 1$ (token ngắn $\le 2$ phải exact/prefix), HOẶC condensed query $\ge 4$ ký tự (kể cả $\ge 7$) có condensed dist = 1.
- **`Score = 50` (`TypoTolerantTier2`):** All tokens thỏa mãn ngưỡng khớp, trong đó có ít nhất một token $\ge 6$ ký tự có dist = 2 (hoặc condensed dist = 2 cho chuỗi condensed $\ge 6$).
- **`Score = 0` (`NoMatch`):** Không thỏa mãn ngưỡng, loại bỏ khỏi kết quả (`[]`).

### 3.2. Thuật Toán Tie-Breaking Tuyệt Đối
1. `RelevanceScore` Giảm dần (`DESC`).
2. `Name` Tăng dần (`StringComparer.OrdinalIgnoreCase`) (`ASC`).
3. `Id` Tăng dần (`Guid.CompareTo`) (`ASC`).

---

## 4. Bảng Fixtures Mẫu Đối Chiếu (Gold Fixtures Matrix)

| Query ($Q$) | Cơ sở khớp | Cơ chế tính điểm | Điểm gán | Thứ tự trả về |
| :--- | :---: | :--- | :---: | :---: |
| `"Đà Nẵng"` | P1, P2 | City exact match 100% | **100** | **1. P1, 2. P2** (Tie-break Name A-Z) |
| `"Danag"` | P1, P2 | City condensed dist = 1 (`"danag"` $\rightarrow$ `"danang"`, len 5) | **60** | **1. P1, 2. P2** |
| `"da nag"` | P1, P2 | Token `"da"` exact (len 2) + Token `"nag"` dist = 1 | **60** | **1. P1, 2. P2** |
| `"Nhatrangg"` | — | Condensed dist = 1 tới `"nhatrang"` (len 9 $\rightarrow$ 8, dist 1) | **60** *(nếu có)* | — *(Tier 1 Score 60)* |
| `"Ha"` | P4, P5 | **P4:** City prefix `"ha noi"` (Score 90)<br>**P5:** Name substring `"khach san ha long bay"` (Score 80) | **P4: 90**<br>**P5: 80** | **1. P4, 2. P5** |
| `"Haoni"` | P4 | City condensed adjacent transposition dist = 1 (`"haoni"` $\rightarrow$ `"hanoi"`) | **60** | **1. P4** |
| `"Central"` | P2, P3 | Name substring match liên tiếp | **80** | **1. P2, 2. P3** (Tie-break Name A-Z) |
| `"biển"` | P1 | Name substring match ("Biển Đông") | **80** | **1. P1** |
| `"khach san mat trang"`| — | Không khớp cơ sở nào | **0** | `[]` *(Mảng rỗng HTTP 200 OK)* |
| *(bất kỳ)* | P6 | Cơ sở `Status == Inactive` | **—** | *Bị loại bỏ hoàn toàn* |

---

## 5. Bằng Chứng & Bảng Băm Tài Liệu (Evidence Artifacts)

| Tệp tin | Kích thước (bytes) | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md) | 23,496 | `b54ef79c0957eb3acedfbcf0879c4916d9e748f023d2d8bbdab7affa18ea24e0` | Tài liệu hợp đồng & đặc tả kỹ thuật Fuzzy Search (Phiên bản 3.0) |

---

## 6. Kế Hoạch Cho Lát Cắt Tiếp Theo (Next Implementation Slice)

Sau khi Reviewer Codex phê duyệt bản hợp đồng này:
1. Tạo class tiện ích thuần túy: `HotelSaas.Application.Common.Utils.FuzzyStringMatcher` (zero external dependencies).
2. Viết suite unit tests: `FuzzyStringMatcherTests` kiểm thử đầy đủ các mức điểm 100, 90, 80, 75, 60, 50, 0 và các edge cases (`"Ha"`, `"Danag"`, `"Nhatrangg"`, `"Haoni"`).
3. Tích hợp nhẹ nhàng vào `GetPublicPropertiesQueryHandler.cs` (chỉ kích hoạt khi `search != null`).
4. Chạy toàn bộ regression test suite của backend và frontend.
