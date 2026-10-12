# Báo Cáo Nghiệm Thu: P5-FUZZY-CONTRACT-02 (Round 2)

- **TaskId:** P5-FUZZY-CONTRACT-02
- **Round:** 2
- **SubmissionId:** sub-p5-fuzzy-contract-02-r2-20261011
- **ReviewedSubmissionId:** sub-p5-fuzzy-contract-02-r1-20261011
- **Workspace:** `C:\Dev\hotel-saas-v2`
- **SubmittedAt:** 2026-10-11T12:58:30+07:00
- **Actor:** antigravity
- **ConversationId:** b24752d6-e881-4372-b79e-186db67e5233

---

## 1. Tuyên Bố Ranh Giới An Toàn (Strict Safety Invariants)

1. **Nhiệm vụ đặc tả hợp đồng kỹ thuật thuần túy (Documentation-only):** Toàn bộ công việc tập trung cập nhật và hoàn thiện bản hợp đồng kỹ thuật tại [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md). Tuyệt đối **không can thiệp mã nguồn backend C#**, không tạo matcher class, không sửa handler hay API trước khi hợp đồng được phê duyệt.
2. **0 kết nối database ngoài:** Không cấu hình và không kết nối tới bất kỳ database dev, staging hay production nào (0 connection strings, 0 migrations).
3. **0 vi phạm quyền sở hữu module của đồng đội:** Giữ nguyên vẹn mã nguồn của các module Nguyên (`Rooms`/`RoomTypes`) và Tân (`Housekeeping`).
4. **Bảo tồn giao diện khách hàng (Angular UI):** Toàn bộ giao diện khách và service client frontend đã được nghiệm thu kỹ thuật và browser verification tại P5/P7 được bảo lưu nguyên vẹn; hợp đồng fuzzy giữ nguyên 100% định dạng mảng `PublicPropertyDto[]`.
5. **Ranh giới nghiệp vụ bất biến:**
   - Tuyệt đối **KHÔNG fuzzy** ngày nhận/trả phòng (`checkInDate`, `checkOutDate`), số lượng khách (`numberOfGuests`), giá phòng (`price`) hay tình trạng phòng trống (`availability`).
   - Chỉ áp dụng lọc trên các cơ sở lưu trú có trạng thái hoạt động: `p.Status == PropertyStatus.Active` (Active-only).
   - Khi không có cơ sở nào thỏa mãn hoặc sau khi lọc điểm = 0, hệ thống trả về **mảng rỗng `[]`** với mã HTTP 200 OK.

---

## 2. Giải Quyết Triệt Để Các Findings Từ Reviewer Codex (Round 1)

Bản hợp đồng kỹ thuật tại [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md) (Phiên bản 4.0) đã giải quyết triệt để và toàn diện cả 3 nhóm findings:

### Finding 1 (P1) — Đánh Giá Toàn Diện Fixture `"Ha"`, Giải Thích Chuỗi Con `"khach"`, Thứ Tự Tie-Break & GUID Cố Định
- **Phân tích bản chất kỹ thuật:**
  - Trong tiếng Việt, hầu như tất cả tên cơ sở lưu trú đều bắt đầu bằng từ "Khách sạn". Sau khi chuẩn hóa không dấu và chữ thường, từ này trở thành `"khach"`.
  - Từ `"khach"` chứa chuỗi con `"ha"` tại vị trí chỉ mục 1 (`k-h-a-c-h`).
  - Do đó, khi người dùng tìm kiếm `"Ha"`, **tất cả các cơ sở lưu trú có chữ "Khách" đều tự nhiên khớp chuỗi con (`SubstringMatch`) với điểm số 80**.
- **Đánh giá chi tiết từng trường của mọi cơ sở Active mẫu:**
  - **P4** ("Khách Sạn Hà Nội Horizon"): $P.\text{City}$ sau chuẩn hóa là `"ha noi"`, bắt đầu bằng `"ha"` $\rightarrow$ đạt **Score = 90** (`PrefixMatch`).
  - **P1** ("Khách Sạn Biển Đông Đà Nẵng"): $P.\text{Name}$ chứa `"khach"` $\rightarrow$ đạt **Score = 80** (`SubstringMatch`).
  - **P2** ("Khách Sạn Central Đà Nẵng"): $P.\text{Name}$ chứa `"khach"` $\rightarrow$ đạt **Score = 80** (`SubstringMatch`).
  - **P3** ("Khách Sạn Sài Gòn Central"): $P.\text{Name}$ chứa `"khach"` $\rightarrow$ đạt **Score = 80** (`SubstringMatch`).
  - **P5** ("Khách Sạn Hạ Long Bay"): $P.\text{Name}$ chứa `"khach"` và từ `"ha"` $\rightarrow$ đạt **Score = 80** (`SubstringMatch`).
- **Thứ tự xếp hạng xác định sau Tie-break Name A-Z:**
  - Vì P4 đạt Score 90 $\rightarrow$ xếp vị trí số **1**.
  - P1, P2, P5, P3 cùng đạt Score 80 $\rightarrow$ áp dụng Tie-break `Name ASC` (`StringComparer.OrdinalIgnoreCase`):
    - **2. P1** ("Khách Sạn Biển Đông...") (chữ B)
    - **3. P2** ("Khách Sạn Central...") (chữ C)
    - **4. P5** ("Khách Sạn Hạ Long Bay...") (chữ H)
    - **5. P3** ("Khách Sạn Sài Gòn Central...") (chữ S)
- **Gán định danh GUID cố định cho toàn bộ fixtures:** P1 (`11111111-...`) đến P6 (`66666666-...`) để đảm bảo tie-break Id ASC hoàn toàn xác định.
- **Ý nghĩa:** Minh họa rõ nét hiện tượng dương tính giả của chuỗi con ngắn (short-substring false positive), bảo toàn đúng hành vi substring hiện có trong source mà không tự ý đặt ra ranh giới từ (word-boundary) ngầm.

### Finding 2 (P2) — Ngân Sách Lỗi Từng Token, Thang Điểm Đóng, Khớp Condensed & Bổ Sung Fixtures Thực Tế
- **Ngân sách lỗi tối đa theo độ dài token (Per-Token Allowed Budget):**
  - Token ngắn ($|q| \le 2$ ký tự, VD `"da"`, `"ha"`): Ngân sách lỗi = **0**, bắt buộc Exact ($q == t$) hoặc Prefix ($t\text{.StartsWith}(q)$).
  - Token trung bình ($3 \le |q| \le 5$ ký tự, VD `"bien"`, `"dong"`): Ngân sách lỗi $\le 1$ ($\text{OSA}(q, t) \le 1$).
  - Token dài ($|q| \ge 6$ ký tự, VD `"central"`, `"horizon"`): Ngân sách lỗi $\le 2$ ($\text{OSA}(q, t) \le 2$).
- **Phân định rõ ràng Tier 1 (Score 60) vs Tier 2 (Score 50):**
  - **`Score = 60` (`TypoTolerantTier1 / CondensedMatch`):**
    - Token: Mọi token trong query đều thỏa mãn ngân sách Tier 1 (token $\le 2$ exact/prefix, token $\ge 3$ distance $\le 1$).
    - Hoặc Condensed: Query từ đơn $\ge 4$ ký tự có condensed distance $\le 1$. Bao gồm:
      - *Condensed distance = 0 (Exact Condensed):* Người dùng gõ liền `"danang"` (len 6) vs trường `"Đà Nẵng"` (condensed `"danang"`, len 6) $\rightarrow$ distance = 0 $\rightarrow$ đạt **Score = 60**.
      - *Condensed distance = 1 trên từ dài $\ge 7$:* Người dùng gõ `"Nhatrangg"` (len 9) vs trường `"Nha Trang"` (condensed `"nhatrang"`, len 8) $\rightarrow$ distance = 1 $\rightarrow$ đạt **Score = 60**, tuyệt đối không bị hạ xuống 50.
  - **`Score = 50` (`TypoTolerantTier2`):**
    - **All-Token Guard:** MỌI token trong query đều phải nằm trong ngân sách lỗi cho phép. Nếu có bất kỳ token nào thất bại $\rightarrow$ `Score = 0`.
    - Có ít nhất một token dài $\ge 6$ ký tự có distance = 2 (hoặc condensed query $\ge 6$ ký tự có condensed distance = 2).
- **Sửa lỗi chính tả trong chuỗi mẫu:** Đã sửa `"khachsansalgoncentral"` $\rightarrow$ `"khachsansaigoncentral"`.
- **Chuẩn hóa truy vấn rỗng/dấu câu:** Nếu truy vấn chỉ chứa toàn khoảng trắng hoặc dấu phân cách (`, . - /`), hệ thống coi là truy vấn rỗng $\rightarrow$ trả về toàn bộ danh sách Active sorted by Name ASC, Id ASC.
- **Bổ sung đầy đủ fixtures thực tế:**
  - Fixture Score 75 (`AllTokensExactMatch` out-of-order): `"Central Sài Gòn"` vs P3 ("Khách Sạn Sài Gòn Central").
  - Fixture Score 60 (`CondensedMatch` dist = 0): `"danang"` vs P1/P2 ("Đà Nẵng").
  - Fixture Score 50 (`TypoTolerantTier2` dist = 2 trên token $\ge 6$): `"centraal"` (len 8, dist 2) vs P2/P3 ("central" len 7).
  - Fixture All-Token Guard Rejection (Score 0): `"Danang xyz"` (token `"xyz"` không khớp từ nào $\rightarrow$ loại bỏ cơ sở).

### Finding 3 (P1) — Loại Bỏ Khẳng Định Hiệu Năng Giả Định, Phân Tích Độ Phức Tạp Ký Hiệu & Kiến Trúc Bộ Nhớ Thread-Safe
- **Loại bỏ triệt để các khẳng định không đo đạc:** Xóa bỏ hoàn toàn các tuyên bố `<1.5ms`, `<60000 operations`, `dozens/hundreds`, và `zero-GC`.
- **Phân tích độ phức tạp ký hiệu hình thức (Symbolic Cost):**
  $$\text{Total Cost} = O\left( N_{\text{active}} \times \sum_{f \in \{\text{Name}, \text{City}, \text{Address}\}} \left[ (L_f + M) + \sum_{k=1}^K \sum_{j=1}^{J_f} (|q_k| \cdot |t_j|) + (M_{cond} \cdot L_{f, cond}) \right] \right) + O(N_{\text{matched}} \log N_{\text{matched}})$$
  Trong đó $N_{\text{active}}$ là số cơ sở Active, $L_f$ là độ dài trường ($L_1 \le 200, L_2 \le 100, L_3 \le 500$), $M$ là độ dài query, $K$ là số token query, $J_f$ là số token trường.
- **Ranh giới độ dài truy vấn đề xuất:** Nêu rõ giới hạn độ dài $\le 100$ ký tự là **ngân sách vận hành đề xuất (Proposed Operational Boundary)** để bảo vệ máy chủ, không phải giới hạn hiện có trong mã nguồn.
- **Kiến trúc bộ nhớ an toàn đa luồng:**
  - Loại bỏ ma trận tĩnh `static int[102, 102]` vì gây race condition khi có nhiều request đồng thời và không chứa được trường Address 500 ký tự.
  - Sử dụng phương án thread-safe:
    - Ở cấp độ Token: Cấp phát stack-local `stackalloc int[...]` trên ngăn xếp luồng (zero heap allocation, thread-isolated).
    - Ở cấp độ Condensed string: Dùng bộ đệm 3 hàng trạng thái ($3 \times (\min(M, L) + 1) \le 303$ ints) cấp phát trên stack hoặc thuê từ `ArrayPool<int>.Shared` và trả lại trong `finally`.
  - Thừa nhận chi phí nạp danh sách cơ sở từ DB vào RAM của Handler là sự đánh đổi có chủ đích để giữ API không phân trang trong Phase A.

---

## 3. Ma Trận Thang Điểm & Bảng Fixtures Mẫu Chuẩn Xác

### 3.1. Thang Điểm Đóng Cố Định
- **`Score = 100` (`ExactMatch`):** $T_{norm} == Q_{norm}$.
- **`Score = 90` (`PrefixMatch`):** $T_{norm}\text{.StartsWith}(Q_{norm})$.
- **`Score = 80` (`SubstringMatch`):** $T_{norm}\text{.Contains}(Q_{norm})$.
- **`Score = 75` (`AllTokensExactMatch`):** Mọi token trong $Q_{tokens}$ đều có mặt trong $T_{tokens}$.
- **`Score = 60` (`TypoTolerantTier1 / CondensedMatch`):** All tokens thỏa mãn dist $\le 1$ (token $\le 2$ phải exact/prefix), HOẶC condensed query $\ge 4$ ký tự (kể cả $\ge 7$) có condensed dist $\le 1$ (bao gồm condensed dist = 0).
- **`Score = 50` (`TypoTolerantTier2`):** All-token guard thỏa mãn, trong đó có ít nhất một token $\ge 6$ ký tự có dist = 2 (hoặc condensed dist = 2).
- **`Score = 0` (`NoMatch`):** Bất kỳ token nào vượt quá ngân sách lỗi hoặc không đạt ngưỡng $\rightarrow$ loại bỏ khỏi kết quả (`[]`).

### 3.2. Bảng Fixtures Chuẩn Mẫu Đầy Đủ

| Query ($Q$) | Cơ sở đánh giá | Cơ chế tính điểm | Điểm gán | Thứ tự trả về |
| :--- | :---: | :--- | :---: | :---: |
| **`"Ha"`** | **P4**<br>**P1**<br>**P2**<br>**P5**<br>**P3** | **P4:** City prefix `"ha noi"` $\rightarrow$ Score 90.<br>**P1:** Name `"khach san bien dong..."` chứa `"ha"` trong `"khach"` $\rightarrow$ Score 80.<br>**P2:** Name `"khach san central..."` chứa `"ha"` trong `"khach"` $\rightarrow$ Score 80.<br>**P5:** Name `"khach san ha long bay"` chứa `"ha"` trong `"khach"` & `"ha"` $\rightarrow$ Score 80.<br>**P3:** Name `"khach san sai gon..."` chứa `"ha"` trong `"khach"` $\rightarrow$ Score 80. | **P4: 90**<br>**P1: 80**<br>**P2: 80**<br>**P5: 80**<br>**P3: 80** | **1. P4** (Score 90)<br>**2. P1** (Score 80, Name: B...)<br>**3. P2** (Score 80, Name: C...)<br>**4. P5** (Score 80, Name: H...)<br>**5. P3** (Score 80, Name: S...) |
| **`"Đà Nẵng"`** | **P1, P2** | City exact match 100% | **100** | **1. P1, 2. P2** (Tie-break Name A-Z) |
| **`"danang"`** | **P1, P2** | City condensed distance = 0 (`"danang"` == `"danang"`, len 6) | **60** | **1. P1, 2. P2** |
| **`"Danag"`** | **P1, P2** | City condensed distance = 1 (`"danag"` $\rightarrow$ `"danang"`, len 5) | **60** | **1. P1, 2. P2** |
| **`"da nag"`** | **P1, P2** | Token `"da"` exact (len 2) + Token `"nag"` dist = 1 | **60** | **1. P1, 2. P2** |
| **`"Nhatrangg"`** | — | Condensed dist = 1 tới `"nhatrang"` (len 9 $\rightarrow$ 8, dist 1) | **60** | — *(Tier 1 Score 60)* |
| **`"Central Sài Gòn"`** | **P3** | Name chứa đủ các token `{"central", "sai", "gon"}` không liên tiếp | **75** | **1. P3** |
| **`"centraal"`** | **P2, P3** | Token `"centraal"` (len 8) có distance = 2 tới token `"central"` (len 7) | **50** | **1. P2, 2. P3** |
| **`"Haoni"`** | **P4** | City condensed hoán vị kề nhau dist = 1 (`"haoni"` $\rightarrow$ `"hanoi"`) | **60** | **1. P4** |
| **`"Central"`** | **P2, P3** | Name substring match liên tiếp | **80** | **1. P2, 2. P3** |
| **`"Danang xyz"`** | — | Token `"xyz"` (len 3) có dist > 1 tới mọi từ $\rightarrow$ Guard Rejection | **0** | `[]` *(Mảng rỗng)* |
| **`"khach san mat trang"`**| — | Không khớp cơ sở nào | **0** | `[]` *(Mảng rỗng)* |
| *(Bất kỳ)* | **P6** | Cơ sở có `Status == PropertyStatus.Inactive` | **—** | *Bị loại bỏ hoàn toàn* |

---

## 4. Danh Mục Bằng Chứng & Bảng Băm (Evidence Artifacts)

| Tệp tin | Kích thước (bytes) | Mã băm SHA-256 | Mô tả |
| :--- | :---: | :--- | :--- |
| [`docs/p5-guest-search-contract-proposal.md`](file:///C:/Dev/hotel-saas-v2/docs/p5-guest-search-contract-proposal.md) | 31,485 | `6eb2d8f4031dd8f018bdb785b7d2f57c2955734a3ae543d404962f56173b6419` | Tài liệu hợp đồng kỹ thuật Fuzzy Search (Phiên bản 4.0, đã sửa triệt để cả 3 nhóm findings) |

---

## 5. Kế Hoạch Cho Lát Cắt Tiếp Theo (Next Implementation Slice)

Sau khi Reviewer Codex phê duyệt bản hợp đồng kỹ thuật này:
1. Tạo class tiện ích thuần túy: `HotelSaas.Application.Common.Utils.FuzzyStringMatcher` sử dụng kiến trúc bộ nhớ `stackalloc` / 3-row buffer và pipeline 5 bước xác định.
2. Viết suite unit tests: `FuzzyStringMatcherTests` kiểm thử đầy đủ các mức điểm 100, 90, 80, 75, 60, 50, 0 và các fixtures chuẩn (`"Ha"`, `"Danag"`, `"danang"`, `"Nhatrangg"`, `"centraal"`, `"Danang xyz"`).
3. Tích hợp nhẹ nhàng vào `GetPublicPropertiesQueryHandler.cs` (chỉ gọi khi `search != null`).
4. Chạy toàn bộ regression test suite của backend và frontend.
