# Submission P5-FUZZY-CONTRACT-02 — Round 3

- **TaskId:** `P5-FUZZY-CONTRACT-02`
- **Round:** 3
- **SubmissionId:** `sub-p5-fuzzy-contract-02-r3-20261011`
- **Status:** `Submitted`
- **Scope:** Technical Specification & Contract Proposal only (`docs/p5-guest-search-contract-proposal.md` v5.0). Zero backend C# code modifications, zero DB mutations, zero unapproved matcher/runtime changes, zero changes to approved Angular UI or API contracts.

---

## 1. Tóm Tắt & Giải Quyết Toàn Bộ 3 Phát Hiện Từ Codex Review Round 2

### Finding 1 (P1) — Sửa chữa toán học Fixture Score 50 & Bổ sung chuỗi khoảng cách OSA = 2 thực sự (`"centxralz"` vs `"centraal"`)
- **Phân tích toán học chính xác:**
  - Trong Round 2, fixture đề xuất `"centraal"` (độ dài 8) so với `"central"` (độ dài 7) chỉ cần **1 phép xóa ký tự `'a'` thừa** $\rightarrow \text{OSA distance} = 1$. Do đó, `"centraal"` thuộc Tier 1 và đạt **Score = 60**, hoàn toàn KHÔNG PHẢI Score 50.
  - Theo hợp đồng phân tầng:
    - **Tier 1 (Score 60):** Cho phép sai số tối đa 1 ký tự trên token $\ge 3$ ký tự (hoặc condensed distance $\le 1$ trên condensed $\ge 4$).
    - **Tier 2 (Score 50):** Yêu cầu tồn tại ít nhất một token có độ dài $\ge 6$ ký tự với $\text{bestDist}(q, T) = 2$ (hoặc condensed distance = 2 trên condensed query $\ge 6$), đồng thời thỏa mãn All-Token Guard.
- **Fixture Score 50 chuẩn xác:**
  - Sử dụng truy vấn `"centxralz"` (độ dài 9, chứa thêm hai ký tự `'x'` và `'z'` so với `"central"`).
  - Phép biến đổi OSA: Xóa ký tự `'x'` và xóa ký tự `'z'` $\rightarrow \text{OSA distance} = 2$ trên token độ dài $\ge 6$.
  - Đạt **Score = 50** (`TypoTolerantTier2`).
- **Trace chi tiết khoảng cách tốt nhất (`bestDist`) trên tất cả các trường dữ liệu của toàn bộ sample properties:**
  - Đối với P2 ("Khách Sạn Central Đà Nẵng"):
    - `Name`: tokens = `["khach", "san", "central", "da", "nang"]`.
      - OSA("centxralz", "khach") = 8
      - OSA("centxralz", "san") = 8
      - OSA("centxralz", "central") = 2 (delete 'x', delete 'z')
      - OSA("centxralz", "da") = 9
      - OSA("centxralz", "nang") = 8
      - $\rightarrow \text{bestDist}(\text{"centxralz"}, \text{Name}) = 2$.
    - `City`: `["da", "nang"]` $\rightarrow \text{bestDist} = 8$.
    - `Address`: `["50", "nguyen", "van", "linh", "quan", "hai", "chau"]` $\rightarrow \text{bestDist} = 8$.
    - Trường tốt nhất đạt Tier 2 $\rightarrow$ **Score = 50**.
  - Đối với P3 ("Khách Sạn Sài Gòn Central"):
    - `Name`: tokens = `["khach", "san", "sai", "gon", "central"]`.
      - OSA("centxralz", "central") = 2 $\rightarrow \text{bestDist} = 2$.
    - `City`: `["tp", "ho", "chi", "minh"]` $\rightarrow \text{bestDist} = 8$.
    - `Address`: `["123", "le", "loi", "phuong", "ben", "thanh", "quan", "1"]` $\rightarrow \text{bestDist} = 8$.
    - Trường tốt nhất đạt Tier 2 $\rightarrow$ **Score = 50**.
  - Đối với P1, P4, P5, P6: Không có token nào có $\text{OSA} \le 2$ $\rightarrow$ All-Token Guard loại bỏ $\rightarrow$ Score = 0.
  - **Tie-break xác định:** P2 và P3 cùng đạt Score 50 $\rightarrow$ Áp dụng `Name ASC`: **1. P2** (Khách Sạn Central Đà Nẵng, chữ C), **2. P3** (Khách Sạn Sài Gòn Central, chữ S).
- **Định vị lại `"centraal"`:** Đưa `"centraal"` (OSA dist = 1) về đúng vị trí **Score = 60** (Tier 1) với trace rõ ràng.

---

### Finding 2 (P2) — Bảo toàn nguyên vẹn ngữ nghĩa chuẩn hóa hiện hành (`VietnameseTextNormalizer`), Literal Punctuation & Loại bỏ Silent Truncation
- **Bảo toàn ngữ nghĩa chuẩn hóa hiện hữu:**
  - Khảo sát mã nguồn thực tế `VietnameseTextNormalizer.cs` chỉ thực hiện: kiểm tra rỗng, thay thế đ/Đ $\rightarrow$ d, Form D, lọc bỏ `NonSpacingMark`, Form C, `ToLowerInvariant()`, `Trim()`.
  - Bộ chuẩn hóa **hoàn toàn KHÔNG xóa dấu câu** (như dấu phẩy `,`, dấu chấm `.`, gạch nối `-`).
  - Do đó, chuỗi chuẩn hóa $S_{norm}$ giữ nguyên 100% các ký tự dấu câu nguyên bản và khoảng trắng nội tại.
- **Xử lý Literal Punctuation & Delimiter-only Input:**
  - Truy vấn chứa dấu câu (ví dụ $Q = \text{", -"}$):
    - $Q_{norm} = \text{", -"}$ (không rỗng $\rightarrow$ KHÔNG bypass bộ lọc; chỉ có `IsNullOrWhiteSpace` mới bypass bộ lọc để trả toàn bộ Active).
    - Chuỗi $Q_{norm}$ được so khớp nguyên văn dưới dạng Substring (Score 80): $T_{norm}\text{.Contains}(Q_{norm})$. Khách sạn nào có trường chứa đúng cụm ký tự `", -"` sẽ đạt Substring 80.
    - Về mặt token: Phân tách token bằng bộ phân cách (delimiters) tạo ra mảng rỗng ($|Q_{tokens}| = 0$).
    - Hợp đồng quy định rõ: Khi query không rỗng nhưng $|Q_{tokens}| = 0$, **tuyệt đối KHÔNG được kích hoạt điều kiện so khớp token vacuously** (không coi là khớp tất cả token). Nếu không khớp Substring nguyên văn, kết quả đánh giá là **Score = 0** (`NoMatch`).
- **Loại bỏ Silent 100-Character Truncation (`search.Substring(0, 100)`):**
  - Loại bỏ hoàn toàn đề xuất cắt chuỗi ngầm 100 ký tự. Toàn bộ chuỗi truy vấn người dùng được giữ nguyên 100% cho các bước so khớp Exact, Prefix, Substring chuẩn.
  - Ngăn ngừa tình trạng âm thầm làm rơi rớt tiêu chí tìm kiếm của người dùng, bảo toàn phạm vi non-breaking.

---

### Finding 3 (P2) — Khoảng cách hiệu dụng cho Token ngắn, Loại bỏ giả định kích thước cứng & Kiến trúc bộ đệm Thread-Safe
- **Định nghĩa toán học Khoảng cách hiệu dụng ($\text{effectiveDist}$):**
  - Để hỗ trợ token ngắn ($\le 2$ ký tự, ví dụ `"ha"`, `"da"`) khớp tiền tố hợp lệ mà không bị công thức OSA thuần túy làm sai lệch khoảng cách:
    $$\text{effectiveDist}(q, t) = \begin{cases} 0, & \text{nếu } |q| \le 2 \text{ và } t\text{.StartsWith}(q) \\ \text{OSA}(q, t), & \text{ngược lại} \end{cases}$$
    $$\text{bestDist}(q, T) = \min_{t \in T_{tokens}} \text{effectiveDist}(q, t)$$
  - Ví dụ: Với query token `"ha"` và target token `"hanoi"`: Raw OSA distance là 3 (vì khác nhau 3 ký tự `'n'`, `'o'`, `'i'`). Nhưng vì $|q| = 2$ và `"hanoi".StartsWith("ha")` $\rightarrow \text{effectiveDist} = 0 \le \text{budget}(q) = 0$. Điều này giúp điều kiện All-Token Guard hoàn toàn nhất quán và thực thi được về mặt toán học.
- **Loại bỏ hoàn toàn các giả định kích thước cứng (`token <= 20/30`, `J <= 15`):**
  - Địa chỉ khách sạn có thể dài tới 500 ký tự (`Address` $\le 500$), có thể chứa một token rất dài hoặc hàng chục token ngắn.
  - Hợp đồng loại bỏ toàn bộ giả định cứng về số lượng hoặc độ dài token, không coi giới hạn 100 ký tự truy vấn là đã được phê duyệt.
- **Kiến trúc bộ đệm an toàn đa luồng (Thread-Safe Buffer Architecture):**
  - Cấm sử dụng `static int[,]` để tránh race condition trong ASP.NET Core đa luồng.
  - Cấp phát động linh hoạt theo kích thước thực tế:
    1. Cấp token ($|q|, |t| \le 30$): Dùng `stackalloc int[...]` trên thread stack, zero heap allocation, thread-local tự giải phóng khi return.
    2. Cấp chuỗi dài/condensed ($L \le 500$): Thuật toán OSA chỉ cần duy trì **3 hàng trạng thái** ($3 \times (\min(M, L) + 1)$ phần tử). Thuê mượn an toàn từ `ArrayPool<int>.Shared` theo kích thước thực tế của chuỗi và hoàn trả trong khối `finally`.
- **Bổ sung fixed GUID tie fixture & bảng trace hoàn chỉnh:**
  - Toàn bộ cơ sở mẫu có GUID cố định (`11111111-...` đến `66666666-...`).
  - Bổ sung bảng trace chi tiết các hàng Score 75 và Score 50 với đầy đủ normalized string, tokens, branch, và điểm số.

---

## 2. Bảng Fixtures & Trace Chuẩn Xác (Phiên Bản 5.0)

| Truy vấn ($Q$) | Kỳ vọng khớp | Trace logic & Chi tiết tính điểm | Điểm | Thứ tự sắp xếp (Tie-break `Name ASC, Id ASC`) |
| :--- | :---: | :--- | :---: | :--- |
| **`"Khách Sạn Sài Gòn Central"`** | **P3** | Trùng khớp 100% chuỗi chuẩn hóa `Name` | **100** | **1. P3** |
| **`"Khách Sạn Sài Gòn"`** | **P3** | Khớp tiền tố chuỗi chuẩn hóa `Name` | **90** | **1. P3** |
| **`"Sài Gòn"`** | **P3** | Khớp chuỗi con trong `Name` và `City` | **80** | **1. P3** |
| **`"Ha"`** *(Short Substring)* | **P4, P1, P2, P5, P3** | P4 khớp Prefix `City` ("ha noi") = **90**.<br>P1, P2, P3, P5 khớp Substring `Name` ("khach") = **80**. | **90 / 80** | **1. P4 (90)**<br>**2. P1 (80)** (Biển Đông...)<br>**3. P2 (80)** (Central Đà Nẵng...)<br>**4. P5 (80)** (Hạ Long Bay...)<br>**5. P3 (80)** (Sài Gòn Central...) |
| **`"Central Sài Gòn"`** *(Out-of-order)* | **P3** | `Name` chứa đủ các token `{"central", "sai", "gon"}` nhưng không liên tiếp | **75** | **1. P3** |
| **`"danang"`** *(Condensed dist = 0)* | **P1, P2** | Condensed query `"danang"` khớp 100% condensed `City` `"danang"` (dist = 0) | **60** | **1. P1, 2. P2** (Tie-break Name A-Z) |
| **`"da nag"`** *(Multi-token Typo)* | **P1, P2** | Token `"da"` (effectiveDist = 0, len 2) + Token `"nag"` (bestDist = 1 tới `"nang"`) | **60** | **1. P1, 2. P2** (Tie-break Name A-Z) |
| **`"centraal"`** *(Xóa 1 chữ 'a')* | **P2, P3** | Token `"centraal"` (len 8) xóa 1 chữ 'a' thành `"central"` (len 7) $\rightarrow$ **OSA dist = 1** (Tier 1) | **60** | **1. P2, 2. P3** (Tie-break Name A-Z) |
| **`"centxralz"`** *(Lỗi cấp 2: dist = 2)* | **P2, P3** | Token `"centxralz"` (len 9) xóa 'x' và 'z' thành `"central"` (len 7) $\rightarrow$ **OSA dist = 2** trên token $\ge 6$ ký tự (Tier 2) | **50** | **1. P2, 2. P3** (Tie-break Name A-Z) |
| **`", -"`** *(Punctuation only)* | *(Theo dữ liệu)* | Không rỗng $\rightarrow$ so khớp literal substring `", -"`. Token array rỗng $\rightarrow$ không match token vacuously | **80 hoặc 0** | Khớp literal substring đạt **80**, không khớp đạt **0** |
| **`"Danang xyz"`** *(Rejection)* | **Không khớp** | Token `"danang"` khớp, nhưng token `"xyz"` có $\text{bestDist} > 1$ $\rightarrow$ Bị loại bởi All-Token Guard | **0** | Danh sách rỗng |
| **`""` (Rỗng)** | **P1 - P6** | Truy vấn rỗng $\rightarrow$ Bỏ qua tính điểm, trả về toàn bộ Active | **N/A** | Toàn bộ Active sắp xếp theo `Name ASC, Id ASC` |

---

## 3. Danh Mục Minh Chứng (Evidence)

1. `docs/p5-guest-search-contract-proposal.md`: Bản đặc tả kỹ thuật Version 5.0 hoàn chỉnh (31,485 bytes, SHA-256: `6eb2d8f4031dd8f018bdb785b7d2f57c2955734a3ae543d404962f56173b6419`).
2. `docs/agent-coordination/submission.md`: Bản tường trình Round 3 chi tiết giải quyết toàn bộ Findings từ Codex Review Round 2.
3. `docs/agent-coordination/assignment.md`: Phạm vi giao việc ban đầu.
4. `docs/agent-coordination/decisions.md`: Quyết định kiến trúc phối hợp.

---

## 4. Cam Kết & Tuân Thủ

- **Zero C# / Matcher implementation:** Chưa viết code C#, chưa tạo matcher, chưa đụng database khi chưa có sự phê chuẩn hợp đồng từ PO/Codex.
- **Zero Frontend changes:** Giữ nguyên 100% giao diện Angular đã được phê duyệt ở Task `P5-GUEST-SEARCH-IMPLEMENT-02`.
- **PO Gates giữ nguyên:** Cả 5 PO Gates vẫn duy trì trạng thái NeedsPO và không bị vượt quyền.
