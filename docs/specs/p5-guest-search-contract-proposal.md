# Tài Liệu Đặc Tả Hợp Đồng Tìm Kiếm Khách Sạn (Bản Đầy Đủ)
## Ordinary & Fuzzy Guest Search Contract Specification (Round 7)

> **Mã tài liệu:** `SEARCH-CONTRACT-P5-02` | **Phiên bản:** 9.0 (Hiệu chỉnh theo kết quả thẩm định Round 6 của Codex — Bounded Offline Oracle & Runtime .NET Comparison Evidence)  
> **Nhiệm vụ điều phối:** `P5-FUZZY-CONTRACT-02` (Round 7)  
> **Ngày lập:** 2026-10-11 | **Tác giả:** Antigravity  
> **Workspace:** `C:\Dev\hotel-saas-v2` | **Branch:** `develop` (HEAD `3f95339`)  
> **Căn cứ chỉ đạo:** Codex Review `P5-FUZZY-CONTRACT-02` Round 6 (11/10/2026) theo ủy quyền của PO; hoàn thiện đặc tả hợp đồng tìm kiếm gần đúng (fuzzy / typo tolerance) thuần túy trong tài liệu, xác định rõ công cụ kiểm chứng ngoại tuyến JS là bộ ước lượng xấp xỉ có giới hạn (bounded offline oracle / `compareOrdinalIgnoreCaseApprox`), khẳng định mã nguồn sản xuất backend C# bắt buộc sử dụng `StringComparer.OrdinalIgnoreCase` gốc và `Guid.CompareTo` số học, lưu trữ bằng chứng đối chiếu runtime .NET thực tế (`dotnet-comparator-fixtures.txt`) cho cặp phản chứng Hy Lạp (U+1F80/U+1F88), dấu dương Straße vs STRASSE, thứ tự mã ASCII và ký tự có dấu, **tuyệt đối không can thiệp mã nguồn backend hay tích hợp matcher** trước khi hợp đồng được phê duyệt.  
> **Tiêu chuẩn áp dụng:** `requirements-analysis-enterprise`, `system-design-enterprise` & Karpathy principles (chính xác tuyệt đối, toán học đóng kín, executable, loại bỏ mọi số liệu giả định).

---

## 1. Má»¥c TiÃªu & Ranh Giá»›i Ká»¹ Thuáº­t (Scope & Boundaries)

### 1.1. Má»¥c TiÃªu
TÃ i liá»‡u nÃ y xÃ¡c láº­p há»£p Ä‘á»“ng ká»¹ thuáº­t chi tiáº¿t cho hai cáº¥p Ä‘á»™ tÃ¬m kiáº¿m cÃ´ng khai trÃªn cá»•ng Ä‘áº·t phÃ²ng (`/booking`):
1. **LÃ¡t cáº¯t TÃ¡i sá»­ dá»¥ng (Slice A - Non-breaking Diacritics Search):** Ä Ã£ Ä‘Æ°á»£c triá»ƒn khai vÃ  nghiá»‡m thu á»Ÿ cÃ¡c lÃ¡t cáº¯t trÆ°á»›c; báº£o toÃ n 100% API hiá»‡n cÃ³ (`GET /api/public/properties?search=...`), so khá»›p tiáº¿ng Viá»‡t khÃ´ng dáº¥u trÃªn `Name`, `Address`, `City`.
2. **Há»£p Ä‘á»“ng TÃ¬m kiáº¿m Gáº§n Ä‘Ãºng (Fuzzy & Typo-Tolerant Search Contract):** Ä áº·c táº£ thuáº­t toÃ¡n xáº¿p háº¡ng dung sai lá»—i chÃnh táº£ (typo tolerance) cho tÃªn khÃ¡ch sáº¡n, Ä‘á»‹a chá»‰ vÃ  thÃ nh phá»‘ khi ngÆ°á» i dÃ¹ng gÃµ sai kÃ½ tá»±, thiáº¿u/thá»«a chá»¯, hoáº·c hoÃ¡n vá»‹ kÃ½ tá»± ká»  nhau. Ä Ã³ng kÃn toÃ n bá»™ cÃ´ng thá»©c tÃnh Ä‘iá»ƒm, ngÃ¢n sÃ¡ch lá»—i theo Ä‘á»™ dÃ i token (per-token budget), cÃ¡c nhÃ¡nh Ä‘á»™c láº­p cho chuá»—i condensed, quy táº¯c tie-breaking `StringComparer.OrdinalIgnoreCase` vÃ  `Guid.CompareTo`, cÃ¹ng toÃ n bá»™ máº£ng fixtures máº«u Ä‘áº§y Ä‘á»§.
3. **CÃ¡c Cá»•ng Nghiá»‡p Vá»¥ Cáº§n PO PhÃª Duyá»‡t (PO Gates / NeedsPO):** PhÃ¢n Ä‘á»‹nh ranh giá»›i kiáº¿n trÃºc Ä‘á»™c láº­p khÃ´ng tá»± Ã½ quyáº¿t Ä‘á»‹nh thay PO (phÃ¢n trang, chÃnh sÃ¡ch IsPublished, dataset hÃ nh chÃnh, schema migration, phÃ²ng trá»‘ng tá»•ng há»£p).

### 1.2. Ranh Giá»›i Kiá»ƒm Chá»©ng & An ToÃ n (Safety Invariants)
- **TÃ i liá»‡u Ä‘áº·c táº£ há»£p Ä‘á»“ng thuáº§n tÃºy (Documentation-only):** Tuyá»‡t Ä‘á»‘i khÃ´ng can thiá»‡p mÃ£ nguá»“n backend C#, khÃ´ng táº¡o matcher class, khÃ´ng thÃªm migration schema, khÃ´ng káº¿t ná»‘i database dev/staging/prod trong task nÃ y.
- **Báº£o toÃ n giao diá»‡n Ä‘Ã£ duyá»‡t:** Giao diá»‡n khÃ¡ch hÃ ng (Angular UI) Ä‘Ã£ Ä‘Æ°á»£c nghiá»‡m thu ká»¹ thuáº­t vÃ  browser verification táº¡i P5/P7 Ä‘Æ°á»£c báº£o lÆ°u nguyÃªn váº¹n; há»£p Ä‘á»“ng fuzzy backend giá»¯ nguyÃªn tÆ°Æ¡ng thÃch máº£ng `PublicPropertyDto[]`.
- **Ranh giá»›i nghiá»‡p vá»¥ báº¥t biáº¿n:**
  - Tuyá»‡t Ä‘á»‘i **KHÃ”NG fuzzy** ngÃ y nháº­n/tráº£ phÃ²ng (`checkInDate`, `checkOutDate`), sá»‘ lÆ°á»£ng khÃ¡ch (`numberOfGuests`), giÃ¡ phÃ²ng (`price`) hay tÃ¬nh tráº¡ng phÃ²ng trá»‘ng (`availability`).
  - Chá»‰ Ã¡p dá»¥ng lá» c trÃªn cÃ¡c cÆ¡ sá»Ÿ lÆ°u trÃº cÃ³ tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng: `p.Status == PropertyStatus.Active` (Active-only).
  - Khi khÃ´ng cÃ³ cÆ¡ sá»Ÿ nÃ o thá» a mÃ£n hoáº·c sau khi lá» c Ä‘iá»ƒm = 0, há»‡ thá»‘ng tráº£ vá»  **máº£ng rá»—ng `[]`** vá»›i mÃ£ HTTP 200 OK.

---

## 2. Ä á»‘i Chiáº¿u Hiá»‡n Tráº¡ng Schema & MÃ£ Nguá»“n (Source-backed Audit)

### 2.1. Thá»±c Thá»ƒ `Property` Trong MÃ£ Nguá»“n

| TrÆ°á» ng dá»¯ liá»‡u | Ä áº·c táº£ Domain (`Property.cs`) | Cáº¥u hÃ¬nh EF Core (`PropertyConfiguration.cs`) | Hiá»‡n tráº¡ng ká»¹ thuáº­t |
|---|---|---|---|
| **TÃªn cÆ¡ sá»Ÿ** (`Name`) | `public string Name { get; set; }` | `builder.Property(p => p.Name).HasMaxLength(200).IsRequired();` | Ä Ã£ cÃ³, Ä‘á»™ dÃ i tá»‘i Ä‘a 200 kÃ½ tá»± |
| **URL Slug** (`Slug`) | `public string Slug { get; set; }` | `builder.Property(p => p.Slug).HasMaxLength(200).IsRequired();` | Ä Ã£ cÃ³, unique index |
| **Ä á»‹a chá»‰ chi tiáº¿t** (`Address`) | `public string Address { get; set; }` | `builder.Property(p => p.Address).HasMaxLength(500).IsRequired();` | Chuá»—i tá»± do, Ä‘á»™ dÃ i tá»‘i Ä‘a 500 kÃ½ tá»± |
| **Tá»‰nh / ThÃ nh phá»‘** (`City`) | `public string City { get; set; }` | `builder.Property(p => p.City).HasMaxLength(100).IsRequired();` | Chuá»—i tá»± do, Ä‘á»™ dÃ i tá»‘i Ä‘a 100 kÃ½ tá»± |
| **Tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng** (`Status`) | `public PropertyStatus Status { get; set; }` | `PropertyStatus.Active` máº·c Ä‘á»‹nh | Ä Ã£ cÃ³, enum Domain |
| **Tráº¡ng thÃ¡i xuáº¥t báº£n** (`IsPublished`) | `public bool IsPublished { get; set; }` | `false` máº·c Ä‘á»‹nh | Ä Ã£ cÃ³ trong entity, chÆ°a enforce public |

### 2.2. Kháº£o SÃ¡t Bá»™ Chuáº©n HÃ³a VÄƒn Báº£n Tiáº¿ng Viá»‡t Hiá»‡n Táº¡i (`VietnameseTextNormalizer.cs`)
MÃ£ nguá»“n hiá»‡n táº¡i trong `HotelSaas.Application.Common.Utils.VietnameseTextNormalizer.cs` thá»±c hiá»‡n chuáº©n hÃ³a nhÆ° sau:
1. `string.IsNullOrWhiteSpace(text)` $\rightarrow$ tráº£ vá»  `string.Empty`.
2. Thay tháº¿ kÃ½ tá»± Ä‘/Ä : `Replace('Ä‘', 'd')`, `Replace('Ä ', 'd')`.
3. PhÃ¢n rÃ£ chuáº©n hÃ³a Form D (`Normalize(NormalizationForm.FormD)`).
4. Lá» c bá»  cÃ¡c kÃ½ tá»± dáº¥u thanh thuá»™c nhÃ³m `UnicodeCategory.NonSpacingMark` (loáº¡i bá»  toÃ n bá»™ cÃ¡c dáº¥u káº¿t há»£p bao gá»“m cáº£ `U+0300â€“U+036F`, `U+1AB0â€“U+1AFF`, v.v.).
5. TÃ¡i cáº¥u trÃºc chuáº©n hÃ³a Form C (`Normalize(NormalizationForm.FormC)`).
6. Chuyá»ƒn chá»¯ thÆ°á» ng (`ToLowerInvariant()`) vÃ  cáº¯t khoáº£ng tráº¯ng hai Ä‘áº§u (`Trim()`).

> âš ï¸  **Báº£o toÃ n ngá»¯ nghÄ©a chuáº©n hÃ³a vÃ  cÆ¡ cháº¿ bypass:**  
> - `VietnameseTextNormalizer.cs` **hoÃ n toÃ n KHÃ”NG xÃ³a dáº¥u cÃ¢u** (nhÆ° `,`, `.`, `-`). CÃ¡c kÃ½ tá»± dáº¥u cÃ¢u nguyÃªn báº£n (literal punctuation) Ä‘Æ°á»£c **giá»¯ nguyÃªn 100% trong chuá»—i chuáº©n hÃ³a**.
> - Chuá»—i tÃ¬m kiáº¿m chá»‰ chá»©a dáº¥u cÃ¢u (vÃ dụ `","` hoáº·c `", -"`) **khÃ´ng pháº£i lÃ  chuá»—i rá»—ng**; nÃ³ Ä‘Æ°á»£c tÃ¬m kiáº¿m nguyÃªn vÄƒn (literal substring) trÃªn chuá»—i chuáº©n hÃ³a cá»§a cÃ¡c trÆ°á» ng.
> - **CÆ¡ cháº¿ Normalized-Empty Bypass:** Khi chuá»—i truy váº¥n chá»‰ chá»©a cÃ¡c kÃ½ tá»± dáº¥u káº¿t há»£p Ä‘Æ¡n láº» (vÃ dụ `"\u0301"` â€” combining acute), quÃ¡ trÃ¬nh chuáº©n hÃ³a sÃ ng lá» c toÃ n bá»™ `NonSpacingMark` khiáº¿n chuá»—i chuáº©n hÃ³a trá»Ÿ thÃ nh rá»—ng (`string.Empty`). Theo `GetPublicPropertiesQueryHandler.cs`, Ä‘iá» u kiá»‡n `if (!string.IsNullOrEmpty(normalizedSearch))` khÃ´ng Ä‘Æ°á»£c kÃch hoáº¡t $\rightarrow$ **há»‡ thá»‘ng bypass bá»™ lá» c vÃ  tráº£ vá»  toÃ n bá»™ cÆ¡ sá»Ÿ Active**, tÆ°Æ¡ng tá»± nhÆ° truy váº¥n rá»—ng (blank query).

---

## 3. Ä áº·c Táº£ Thuáº­t ToÃ¡n & Há»£p Ä á»“ng TÃ¬m Kiáº¿m Gáº§n Ä Ãºng (Fuzzy Search Specification)

### 3.1. Quy TrÃ¬nh Tiá» n Xá»­ LÃ½ Chuá»—i Thá»±c Thi (Executable Preprocessing Pipeline)

```
[Chuá»—i thÃ´ Raw String]
       â”‚
       â–¼ (BÆ°á»›c 1: Chuáº©n hÃ³a theo VietnameseTextNormalizer hiá»‡n há»¯u)
[Chuá»—i chuáº©n hÃ³a nguyÃªn vÄƒn S_norm: Giá»¯ nguyÃªn dáº¥u cÃ¢u, Ä‘->d, bá»  NonSpacingMark, Form C, toLower, trim]
       â”‚
       â”œâ”€â”€â”€â–º DÃ¹ng trá»±c tiáº¿p cho: ExactMatch (100), PrefixMatch (90), SubstringMatch (80)
       â”‚
       â”œâ”€â”€â”€â–º (BÆ°á»›c 2: Delimiter Tokenization vá»›i char[] delimiters chuáº©n C#) â”€â”€â”€â–º Máº£ng Tokens Q_tokens: [q_1, q_2, ...]
       â”‚
       â””â”€â”€â”€â–º (BÆ°á»›c 3: Delimiter Stripping) â”€â”€â”€â–º Chuá»—i Liá» n Máº¡ch (Condensed String Q_condensed)
```

1. **BÆ°á»›c 1 â€” Chuáº©n hÃ³a nguyÃªn vÄƒn ($S_{norm}$):**
   - Ã p dá»¥ng `VietnameseTextNormalizer.Normalize(text)`.
   - Giá»¯ nguyÃªn cÃ¡c kÃ½ tá»± dáº¥u cÃ¢u vÃ  khoáº£ng tráº¯ng ná»™i táº¡i.
   - Náº¿u `string.IsNullOrWhiteSpace(text)`: $S_{norm} = \text{""}$.
2. **BÆ°á»›c 2 â€” PhÃ¢n tÃ¡ch Token ($S_{tokens}$):**
   - TÃ¡ch chuá»—i $S_{norm}$ báº±ng táº­p kÃ½ tá»± phÃ¢n cÃ¡ch chuáº©n: khoáº£ng tráº¯ng (`' '`), tab (`'\t'`), xuá»‘ng dÃ²ng (`'\r'`, `'\n'`), dáº¥u pháº©y (`','`), dáº¥u cháº¥m (`'.'`), gáº¡ch ná»‘i (`'-'`), gáº¡ch dÆ°á»›i (`'_'`), gáº¡ch chÃ©o (`'/'`, `'\\'`), dáº¥u cá»™ng (`'+'`).
   - Loáº¡i bá»  cÃ¡c pháº§n tá»­ rá»—ng: `tokens = S_norm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries)`.
3. **BÆ°á»›c 3 â€” Chuá»—i liá» n máº¡ch ($S_{condensed}$):**
   - GhÃ©p toÃ n bá»™ cÃ¡c token láº¡i mÃ  khÃ´ng cÃ³ khoáº£ng tráº¯ng: `condensed = string.Concat(tokens)`.

#### Xá»­ LÃ½ CÃ¡c TrÆ°á» ng Há»£p BiÃªn & Token-Empty Guard:
- **Truy váº¥n rá»—ng (Blank Query) hoáº·c Chuáº©n hÃ³a rá»—ng (Normalized-Empty):**
  - Náº¿u `string.IsNullOrWhiteSpace(Q)` HOáº¶C `string.IsNullOrEmpty(Q_norm)` (nhÆ° truy váº¥n `"\u0301"`):
  - Há»‡ thá»‘ng bypass bá»™ lá» c, tráº£ vá»  toÃ n bá»™ danh sÃ¡ch cÆ¡ sá»Ÿ Active, sáº¯p xáº¿p theo `Name ASC` (`StringComparer.OrdinalIgnoreCase`), `Id ASC` (`Guid.CompareTo`).
- **Truy váº¥n khÃ´ng rá»—ng nhÆ°ng khÃ´ng cÃ³ token (Token-Empty Guard, e.g. $Q = \text{", -"}$):**
  - $Q_{norm} = \text{", -"}$ (khÃ´ng rá»—ng $\rightarrow$ KHÃ”NG bypass lá» c).
  - So khá»›p literal Substring: Náº¿u cÆ¡ sá»Ÿ nÃ o cÃ³ trÆ°á» ng chá»©a Ä‘Ãºng kÃ½ tá»± `", -"` $\rightarrow$ Ä‘áº¡t **Score = 80**.
  - **Token-Empty Guard:** PhÃ¢n tÃ¡ch token cho ra mÃ£ng rá»—ng ($|Q_{tokens}| = 0$). VÃ¬ khÃ´ng cÃ³ token Ä‘á»ƒ so khá»›p, há»‡ thá»‘ng **dá»«ng ngay láº­p tá»©c vÃ  gÃ¡n Score = 0**. Tuyá»‡t Ä‘á»‘i khÃ´ng cho phÃ©p truy váº¥n rá»—ng token Ä‘i vÃ o cÃ¡c nhÃ¡nh Score 75/60/50 Ä‘á»ƒ trÃ¡nh so khá»›p vacuously ($\forall q \in \emptyset$ luÃ´n Ä‘Ãºng).
- **TrÆ°á» ng Ä‘Ãch rá»—ng (Empty Target Definition):**
  - Náº¿u trÆ°á» ng $T$ rá»—ng hoáº·c $|T_{tokens}| = 0$, thÃ¬ vá»›i má» i token truy váº¥n $q$, Ä‘á»‹nh nghÄ©a $\text{bestDist}(q, T) = \infty$.

---

### 3.2. Thuáº­t ToÃ¡n Ä o Khoáº£ng CÃ¡ch KÃ½ Tá»± (Distance Metric)

Há»‡ thá»‘ng sá»­ dá»¥ng **Optimal String Alignment (OSA) Distance** (restricted Damerau-Levenshtein distance) vá»›i 4 phÃ©p biáº¿n Ä‘á»•i cÆ¡ báº£n:
1. ThÃªm kÃ½ tá»± (Insertion) â€” chi phÃ 1.
2. XÃ³a kÃ½ tá»± (Deletion) â€” chi phÃ 1.
3. Thay tháº¿ kÃ½ tá»± (Substitution) â€” chi phÃ 1.
4. HoÃ¡n vá»‹ kÃ½ tá»± ká»  nhau (Adjacent Transposition) â€” chi phÃ 1.

---

### 3.3. NgÃ¢n SÃ¡ch Lá»—i, Khoáº£ng CÃ¡ch Hiá»‡u Dá»¥ng & Token Reuse

$$\text{effectiveDist}(q, t) = \begin{cases} 0, & \text{náº¿u } |q| \le 2 \text{ vÃ  } t\text{.StartsWith}(q) \\ \text{OSA}(q, t), & \text{ngÆ°á»£c láº¡i} \end{cases}$$

$$\text{bestDist}(q, T) = \begin{cases} \infty, & \text{náº¿u } |T_{tokens}| = 0 \\ \min_{t \in T_{tokens}} \text{effectiveDist}(q, t), & \text{ngÆ°á»£c láº¡i} \end{cases}$$

#### NgÃ¢n SÃ¡ch Lá»—i Cho PhÃ©p Theo Ä á»™ DÃ i Token (Allowed Error Budget):
- Náº¿u $|q| \le 2$ kÃ½ tá»±: $\text{budget}(q) = \mathbf{0}$. Báº¯t buá»™c khá»›p chÃnh xÃ¡c ($q == t$) hoáº·c khá»›p tiá» n tá»‘ ($t\text{.StartsWith}(q)$).
- Náº¿u $3 \le |q| \le 5$ kÃ½ tá»±: $\text{budget}(q) = \mathbf{1}$. Cho phÃ©p $\text{bestDist}(q, T) \le 1$.
- Náº¿u $|q| \ge 6$ kÃ½ tá»±: $\text{budget}(q) = \mathbf{2}$. Cho phÃ©p $\text{bestDist}(q, T) \le 2$.

#### NguyÃªn Táº¯c Token Reuse & Multiplicity:
Má»—i token truy váº¥n $q \in Q_{tokens}$ tÃ¬m kiáº¿m Ä‘á»™c láº­p trÃªn máº£ng token Ä‘Ãch $T_{tokens}$. CÃ¡c token truy váº¥n khÃ¡c nhau Ä‘Æ°á»£c phÃ©p khá»›p vÃ o cÃ¹ng má»™t token Ä‘Ãch (cho phÃ©p token reuse; vÃ dụ truy váº¥n `"central central"` thÃ¬ cáº£ hai token Ä‘á» u khá»›p token `"central"` cá»§a cÆ¡ sá»Ÿ vá»›i khoáº£ng cÃ¡ch 0).

---

### 3.4. Thang Ä iá»ƒm Ä Ã³ng Rá» i Ráº¡c & CÃ¡c NhÃ¡nh Ä á»™c Láº­p (Independent Alternatives)

1. **`Score = 100` (`ExactMatch`):** $T_{norm} == Q_{norm}$.
2. **`Score = 90` (`PrefixMatch`):** $T_{norm}\text{.StartsWith}(Q_{norm})$.
3. **`Score = 80` (`SubstringMatch`):** $T_{norm}\text{.Contains}(Q_{norm})$.  
   *(Kiá»ƒm tra Token-Empty Guard: Náº¿u $|Q_{tokens}| == 0$, dá»«ng ngay vÃ  gÃ¡n `Score = 0`)*.
4. **`Score = 75` (`AllTokensExactMatch`):** $|Q_{tokens}| \ge 2 \land \forall q \in Q_{tokens}, \text{bestDist}(q, T) == 0$.
5. **`Score = 60` (`TypoTolerantTier1 / CondensedTier1` â€” Hai NhÃ¡nh Ä á»™c Láº­p):**
   - **NhÃ¡nh Token Tier 1:** $\forall q \in Q_{tokens}: (\text{if } |q| \le 2 \implies \text{bestDist}(q, T) == 0; \text{ else } \text{bestDist}(q, T) \le 1)$.
   - **HOáº¶C NhÃ¡nh Condensed Tier 1:** Truy váº¥n lÃ  token Ä‘Æ¡n ($|Q_{tokens}| == 1$), $|Q_{condensed}| \ge 4$, $|T_{condensed}| > 0$, vÃ :
     $$\text{OSA}(Q_{condensed}, T_{condensed}) \le 1$$
     *(VÃ dụ: `"danang"` vs `"Ä Ã  Náºµng"` dist = 0 $\rightarrow$ Score 60; `"Haoni"` vs `"HÃ  Ná»™i"` hoÃ¡n vá»‹ dist = 1 $\rightarrow$ Score 60; `"centraal"` vs `"central"` xÃ³a 1 'a' dist = 1 $\rightarrow$ Score 60).*
6. **`Score = 50` (`TypoTolerantTier2 / CondensedTier2` â€” Hai NhÃ¡nh Ä á»™c Láº­p):**
   - **NhÃ¡nh Token Tier 2:**
     - All-Token Guard: Má» i token $q \in Q_{tokens}$ Ä‘á» u thá» a mÃ£n $\text{bestDist}(q, T) \le \text{budget}(q)$.
     - CÃ³ Ãt nháº¥t má»™t token $|q| \ge 6$ cÃ³ $\text{bestDist}(q, T) == 2$.
   - **HOáº¶C NhÃ¡nh Condensed Tier 2:** Truy váº¥n lÃ  token Ä‘Æ¡n ($|Q_{tokens}| == 1$), $|Q_{condensed}| \ge 6$, $|T_{condensed}| > 0$, vÃ :
     $$\text{OSA}(Q_{condensed}, T_{condensed}) == 2$$
     *(VÃ dụ: Truy váº¥n `"centxralz"` cÃ³ token dist = 2 tá»›i `"central"` $\rightarrow$ Score 50; truy váº¥n Ä‘Æ¡n liá» n máº¡ch `"nhxtrangg"` cÃ³ condensed dist = 2 tá»›i City nhiá» u tá»« `"Nha Trang"` $\rightarrow$ Score 50).*
7. **`Score = 0` (`NoMatch`):** KhÃ´ng thá» a mÃ£n báº¥t ká»³ tiÃªu chÃ nÃ o á»Ÿ trÃªn.

---

### 3.5. MÃ£ Giáº£ TÃnh Ä iá»ƒm ChÃnh XÃ¡c (Exact Scoring Pseudocode)

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

    // 2. Tokenize & Condense vá»›i táº­p delimiters chuáº©n
    char[] delimiters = new[] { ' ', '\t', '\r', '\n', ',', '.', '-', '_', '/', '\\', '+' };
    string[] qTokens = qNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string[] fTokens = fNorm.Split(delimiters, StringSplitOptions.RemoveEmptyEntries);
    string qCondensed = string.Concat(qTokens);
    string fCondensed = string.Concat(fTokens);

    // 3. Token-Empty Guard
    if (qTokens.Length == 0) return 0;

    // 4. Score 75: All-tokens exact match (cho phÃ©p token reuse)
    if (qTokens.Length >= 2)
    {
        bool allExact = true;
        foreach (var q in qTokens)
        {
            if (BestDistance(q, fTokens) != 0) { allExact = false; break; }
        }
        if (allExact) return 75;
    }

    // 5. Score 60: Tier 1 (Hai NhÃ¡nh Ä á»™c Láº­p)
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

    // 6. Score 50: Tier 2 (Hai NhÃ¡nh Ä á»™c Láº­p)
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

### 3.6. CÃ´ng Thá»©c TÃnh Ä iá»ƒm Tá»•ng & Tie-Breaking Tuyá»‡t Ä á»‘i (.NET Comparator Semantics)

$$\text{RelevanceScore}(P) = \max \Big( \text{Score}(P.\text{Name}), \text{Score}(P.\text{City}), \text{Score}(P.\text{Address}) \Big)$$

- **Lá» c káº¿t quáº£:** Chá»‰ giá»¯ cÃ¡c cÆ¡ sá»Ÿ cÃ³ $\text{RelevanceScore}(P) > 0$. CÆ¡ sá»Ÿ `Inactive` luÃ´n bá»‹ loáº¡i trá»« hoÃ n toÃ n.
- **Thá»© tá»± sáº¯p xáº¿p tuyá»‡t Ä‘á»‘i (Deterministic Sorting):**
  1. `RelevanceScore DESC`
  2. `Name ASC` (`StringComparer.OrdinalIgnoreCase` trong .NET C# / `compareOrdinalIgnoreCaseApprox` trong Verifier ngoại tuyến):
     - **Quy định bắt buộc cho Backend C# sản xuất:** Mã nguồn backend C# bắt buộc sử dụng `StringComparer.OrdinalIgnoreCase` gốc của .NET. Trong .NET C#, `StringComparer.OrdinalIgnoreCase` thực hiện so sánh theo bảng mã Unicode invariant đơn ký tự (non-expanding casing).
     - **Giới hạn của bộ kiểm chứng ngoại tuyến JS (Bounded Offline Approximation):** Hàm `compareOrdinalIgnoreCaseApprox` trong bộ kiểm chứng JavaScript là một bộ ước lượng xấp xỉ có giới hạn (bounded offline oracle) phục vụ kiểm chứng ngoại tuyến cho các tập ký tự ASCII, tiếng Việt có dấu/không dấu và Latinh cơ bản. Verifier KHÔNG tuyên bố tương đương toán học/Unicode 100% phổ quát với .NET và không cài đặt lại toàn bộ bảng Unicode casing của .NET.
     - **Dấu so sánh không mở rộng (Non-expanding Ordinal Comparison Sign) — Straße vs STRASSE:** Trong .NET CoreCLR, `[StringComparer]::OrdinalIgnoreCase.Compare("Straße", "STRASSE")` trả về giá trị dương (> 0, cụ thể là +140 trong CoreCLR; dấu dương là hợp đồng bất biến, không phụ thuộc vào độ lớn số học tuyệt đối). Điều này khẳng định ký tự 'ß' (mã 223) không bị bung thành 'SS' (mã 83), giữ nguyên sự phân biệt giữa "Straße" và "STRASSE".
     - **Phản chứng Unicode Hy Lạp (Greek Counterexample — Bounded Oracle Limitation):** Trong runtime .NET CoreCLR thực tế, `[StringComparer]::OrdinalIgnoreCase.Compare(U+1F80, U+1F88)` trả về 0 (bằng nhau theo bảng Unicode invariant). Ngược lại, trong JavaScript ECMAScript, hàm xấp xỉ trả về -1. Sự sai khác này được ghi nhận như một giới hạn có chủ đích của bộ kiểm chứng ngoại tuyến JS (được đối chiếu chi tiết trong artifact `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt`), bảo toàn hợp đồng sản xuất C# mà không làm phình to mã kiểm chứng.
     - Ký tự ASCII hoa như 'Z' (mã 90) đứng trước ký tự có dấu như 'Á' (mã 193) $\rightarrow$ `"Z Hotel"` đứng trước `"Á Hotel"`.
  3. `Id ASC` (`Guid.CompareTo`):
     - **Ä á»‘i chiáº¿u cáº¥u trÃºc sá»‘ chuáº©n cá»§a .NET Guid:** So sÃ¡nh thá»© tá»± theo:
       - TrÆ°á» ng 1 (`_a`): Sá»‘ nguyÃªn khÃ´ng dáº¥u 32-bit (`uint`) tá»« 8 kÃ½ tá»± hex Ä‘áº§u tiÃªn (`0x00000001` < `0x00000100`).
       - TrÆ°á» ng 2 (`_b`): Sá»‘ nguyÃªn khÃ´ng dáº¥u 16-bit (`ushort`) tá»« 4 kÃ½ tá»± hex thá»© hai.
       - TrÆ°á» ng 3 (`_c`): Sá»‘ nguyÃªn khÃ´ng dáº¥u 16-bit (`ushort`) tá»« 4 kÃ½ tá»± hex thá»© ba.
       - CÃ¡c byte cÃ²n láº¡i (`_d` Ä‘áº¿n `_k`): 8 byte riÃªng láº» theo thá»© tá»± hiá»ƒn thá»‹ chuá»—i hex tá»« trÃ¡i sang pháº£i.
     - PhÃ¢n xá»­ hoÃ n toÃ n xÃ¡c Ä‘á»‹nh cho má» i trÆ°á» ng há»£p cÃ¹ng Ä‘iá»ƒm cÃ¹ng tÃªn.

---

## 4. Danh SÃ¡ch CÆ¡ Sá»Ÿ Máº«u & Báº£ng Fixtures Kiá»ƒm Chá»©ng (Test Fixtures)

### 4.1. Danh SÃ¡ch CÆ¡ Sá»Ÿ Máº«u (Sample Properties)

| ID | GUID Cá»‘ Ä á»‹nh | TÃªn cÆ¡ sá»Ÿ (`Name`) | Tá»‰nh / ThÃ nh phá»‘ (`City`) | Ä á»‹a chá»‰ (`Address`) | Tráº¡ng thÃ¡i |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **P1** | `11111111-1111-1111-1111-111111111111` | KhÃ¡ch Sáº¡n Biá»ƒn Ä Ã´ng Ä Ã  Náºµng | Ä Ã  Náºµng | 200 VÃµ NguyÃªn GiÃ¡p, Quáº­n SÆ¡n TrÃ  | Active |
| **P2** | `22222222-2222-2222-2222-222222222222` | KhÃ¡ch Sáº¡n Central Ä Ã  Náºµng | Ä Ã  Náºµng | 50 Nguyá»…n VÄƒn Linh, Quáº­n Háº£i ChÃ¢u | Active |
| **P3** | `33333333-3333-3333-3333-333333333333` | KhÃ¡ch Sáº¡n SÃ i GÃ²n Central | TP. Há»“ ChÃ Minh | 123 LÃª Lá»£i, PhÆ°á» ng Báº¿n ThÃ nh, Quáº­n 1 | Active |
| **P4** | `44444444-4444-4444-4444-444444444444` | KhÃ¡ch Sáº¡n HÃ  Ná»™i Horizon | HÃ  Ná»™i | 40 CÃ¡t Linh, Quáº­n Ä á»‘ng Ä a | Active |
| **P5** | `55555555-5555-5555-5555-555555555555` | KhÃ¡ch Sáº¡n Háº¡ Long Bay | Quáº£ng Ninh | 88 Háº¡ Long, BÃ£i ChÃ¡y | Active |
| **P6** | `66666666-6666-6666-6666-666666666666` | KhÃ¡ch Sáº¡n PhÃº Quá»‘c Sunset Resort | KiÃªn Giang | BÃ£i TrÆ°á» ng, DÆ°Æ¡ng TÆ¡ | Inactive |
| **P7** | `77777777-7777-7777-7777-777777777777` | KhÃ¡ch Sáº¡n Nha Trang Pearl | Nha Trang | 12 Tráº§n PhÃº, PhÆ°á» ng Lá»™c Thá»  | Active |
| **P2_TIE** | `88888888-8888-8888-8888-888888888888` | KhÃ¡ch Sáº¡n Central Ä Ã  Náºµng | Ä Ã  Náºµng | 100 Báº¡ch Ä áº±ng, Quáº­n Háº£i ChÃ¢u | Active |

---

### 4.2. Báº£ng Fixtures Máº«u Chuáº©n & ToÃ n Bá»™ Máº£ng Káº¿t Quáº£ (Full Result Arrays)

| Truy váº¥n ($Q$) | Ká»³ vá» ng khá»›p (ToÃ n bá»™ máº£ng) | Logic phÃ¢n nhÃ¡nh | Ä iá»ƒm sá»‘ | Verifier Status |
| :--- | :--- | :--- | :---: | :---: |
| **`"KhÃ¡ch Sáº¡n SÃ i GÃ²n Central"`** | `[P3]` | ExactMatch Name = 100 | **100** | **PASS** |
| **`"KhÃ¡ch Sáº¡n SÃ i GÃ²n"`** | `[P3]` | PrefixMatch Name = 90 | **90** | **PASS** |
| **`"SÃ i GÃ²n"`** | `[P3]` | SubstringMatch Name = 80 *(KhÃ´ng khá»›p City TP. HCM)* | **80** | **PASS** |
| **`"Central SÃ i GÃ²n"`** | `[P3]` | AllTokensExactMatch Name out-of-order = 75 | **75** | **PASS** |
| **`"central central"`** | `[P2, P2_TIE, P3]` | AllTokensExactMatch vá»›i token reuse = 75 | **75** | **PASS** |
| **`"danang"`** | `[P1, P2, P2_TIE]` | Condensed Tier 1 City dist = 0 | **60** | **PASS** |
| **`"da nag"`** | `[P1, P2, P2_TIE]` | Token Tier 1 City: "da" (eff 0) + "nag" (dist 1) | **60** | **PASS** |
| **`"centraal"`** | `[P2, P2_TIE, P3]` | Token Tier 1 Name: xÃ³a 1 'a' thÃ nh "central" (dist 1) | **60** | **PASS** |
| **`"Haoni"`** | `[P4]` | Condensed Tier 1 City hoÃ¡n vá»‹ "haoni" $\rightarrow$ "hanoi" (dist 1) | **60** | **PASS** |
| **`"centxralz"`** | `[P2, P2_TIE, P3]` | Token Tier 2 Name: xÃ³a 'x' vÃ  'z' (dist = 2 trÃªn len 9) | **50** | **PASS** |
| **`"nhxtrangg"`** | `[P7]` | Condensed Tier 2 City nhiá» u tá»«: xÃ³a 'x' vÃ  'g' tá»›i "nhatrang" (dist 2) | **50** | **PASS** |
| **`"Ha"`** *(Short Substring)* | `[P4 (90), P1 (80), P2 (80), P2_TIE (80), P5 (80), P7 (80), P3 (80)]` | P4 Prefix City (90); P1, P2, P2_TIE, P5, P7, P3 Substring Name (80). P6 Inactive bá»‹ loáº¡i | **90 / 80** | **PASS** |
| **`", -"`** | `[]` *(Máº£ng rá»—ng)* | Literal Substring 0; Token-Empty Guard ngÄƒn vacuously | **0** | **PASS** |
| **`"Danang xyz"`** | `[]` *(Máº£ng rá»—ng)* | Token "xyz" bestDist > 1; All-Token Guard loáº¡i bá»  | **0** | **PASS** |
| **`"Central Ä Ã  Náºµng"`** *(Same-Name Tie)* | `[P2, P2_TIE]` | CÃ¹ng Score 80, cÃ¹ng Name $\rightarrow$ Sáº¯p xáº¿p Id ASC (`2222...` < `8888...`) | **80** | **PASS** |
| **`""` (Rá»—ng)** | `[P1, P2, P2_TIE, P4, P5, P7, P3]` | Blank query bypass bá»™ lá» c, tráº£ toÃ n bá»™ 7 Active theo Name ASC, Id ASC | **N/A** | **PASS** |
| **`"\u0301"` (Combining acute)** | `[P1, P2, P2_TIE, P4, P5, P7, P3]` | Normalized-empty bypass bá»™ lá» c, tráº£ toÃ n bá»™ 7 Active | **N/A** | **PASS** |

---

### 4.3. BÃ i ToÃ¡n Trace Chi Tiáº¿t & Kiá»ƒm Thá»±c Máº£ng Khoáº£ng CÃ¡ch

#### Trace 1: Truy váº¥n `"centxralz"` trÃªn CÆ¡ Sá»Ÿ P2 ("KhÃ¡ch Sáº¡n Central Ä Ã  Náºµng")
- `Name`: tokens = `["khach", "san", "central", "da", "nang"]`.
  - $\text{OSA}(\text{"centxralz"}, \text{"khach"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"san"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"central"}) = 2$ (2 phÃ©p xÃ³a 'x' vÃ  'z')
  - $\text{OSA}(\text{"centxralz"}, \text{"da"}) = 8$ (7 phÃ©p xÃ³a kÃ½ tá»± 'c','e','n','t','x','r','l' + 1 phÃ©p thay tháº¿ 'z' $\rightarrow$ 'd' = 8 thao tÃ¡c)
  - $\text{OSA}(\text{"centxralz"}, \text{"nang"}) = 7$ (5 phÃ©p xÃ³a kÃ½ tá»± 'c','e','t','x','l' + 2 phÃ©p thay tháº¿ 'r' $\rightarrow$ 'n' vÃ  'z' $\rightarrow$ 'g' = 7 thao tÃ¡c)
  - $\rightarrow \text{bestDist}(\text{"centxralz"}, \text{Name}) = \mathbf{2}$.
- `City`: tokens = `["da", "nang"]`.
  - $\text{OSA}(\text{"centxralz"}, \text{"da"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"nang"}) = 7$
  - $\rightarrow \text{bestDist}(\text{"centxralz"}, \text{City}) = \mathbf{7}$ (khÃ´ng pháº£i 8 hay 9).
- `Address`: tokens = `["50", "nguyen", "van", "linh", "quan", "hai", "chau"]`.
  - $\text{OSA}(\text{"centxralz"}, \text{"50"}) = 9$
  - $\text{OSA}(\text{"centxralz"}, \text{"nguyen"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"van"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"linh"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"quan"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"hai"}) = 8$
  - $\text{OSA}(\text{"centxralz"}, \text{"chau"}) = 7$
  - $\rightarrow \text{bestDist}(\text{"centxralz"}, \text{Address}) = \mathbf{7}$ (khÃ´ng pháº£i 8).
- **Káº¿t quáº£ Ä‘iá»ƒm sá»‘:** $\max(50, 0, 0) = \mathbf{50}$ (Field: `Name`).

#### Trace 2: Truy váº¥n `"nhxtrangg"` trÃªn CÆ¡ Sá»Ÿ P7 ("KhÃ¡ch Sáº¡n Nha Trang Pearl")
- Query: $|Q_{tokens}| = 1$, $Q_{condensed} = \text{"nhxtrangg"}$ (len 9).
- City: $T_{tokens} = [\text{"nha"}, \text{"trang"}]$, $T_{condensed} = \text{"nhatrang"}$ (len 8).
- $\text{OSA}(\text{"nhxtrangg"}, \text{"nhatrang"}) = 2$ (2 phÃ©p xÃ³a 'x' vÃ  'g').
- KÃch hoáº¡t **NhÃ¡nh Condensed Tier 2 Ä‘á»™c láº­p** $\rightarrow$ **Score = 50** (Field: `City`).

#### Trace 3: TrÆ°á» ng Há»£p CÃ¹ng Ä iá»ƒm CÃ¹ng TÃªn (Same-Name Fixed-Guid Tie Break)
- Truy váº¥n: `"Central Ä Ã  Náºµng"`:
  - P2 (`22222222-2222-2222-2222-222222222222`): Name "KhÃ¡ch Sáº¡n Central Ä Ã  Náºµng", Score 80.
  - P2_TIE (`88888888-8888-8888-8888-888888888888`): Name "KhÃ¡ch Sáº¡n Central Ä Ã  Náºµng", Score 80.
- Sáº¯p xáº¿p theo `Id ASC`: P2 (`22222222-...`) Ä‘á»©ng trÆ°á»›c P2_TIE (`88888888-...`) vÃ¬ `22222222-...` < `88888888-...`.

#### Trace 4: Kiểm Thực Bài Toán So Sánh Đối Kháng (Adversarial Comparator Probes)
1. **Dấu so sánh không mở rộng (Non-expanding Ordinal Comparison Sign):**  
   `compareOrdinalIgnoreCaseApprox("Straße", "STRASSE") > 0` (Dấu dương > 0 phù hợp hợp đồng dấu của .NET `StringComparer.OrdinalIgnoreCase.Compare("Straße", "STRASSE") > 0` [thực tế CoreCLR trả về +140], xác nhận 'ß' không mở rộng thành 'SS' và hai chuỗi không bị suy biến thành bằng nhau).
2. **Phản chứng Cặp Hy Lạp (Greek Counterexample Bounded Oracle Probe):**  
   - Runtime .NET CoreCLR: `[StringComparer]::OrdinalIgnoreCase.Compare(U+1F80, U+1F88) == 0` (được ghi nhận trong `dotnet-comparator-fixtures.txt`).  
   - Bounded JS Oracle: `compareOrdinalIgnoreCaseApprox("\u1F80", "\u1F88") == -1` (ghi nhận rõ ràng là giới hạn xấp xỉ có chủ đích của JS verifier so với bảng mã đầy đủ của .NET).
3. **Asymmetric Guid Group Ordering Probes (Số học theo cấu trúc .NET Guid):**
   - Group 1: `compareGuid("00000001-0000-0000-0000-000000000000", "00000100-0000-0000-0000-000000000000") == -1` (1 < 256).
   - Group 2: `compareGuid("00000000-0001-0000-0000-000000000000", "00000000-0100-0000-0000-000000000000") == -1`.
   - Group 3: `compareGuid("00000000-0000-0001-0000-000000000000", "00000000-0000-0100-0000-000000000000") == -1`.
   - Group 4: `compareGuid("00000000-0000-0000-0001-000000000000", "00000000-0000-0000-0100-000000000000") == -1`.
   - Group 5: `compareGuid("00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000010") == -1`.

---

## 5. Phân Tính Bộ Nhớ, Hiệu Năng & Công Cụ Kiểm Chứng Ngoại Tuyến

### 5.1. Phân Tính Độ Phức Tạp Ký Hiệu (Symbolic Cost Formulation)
$$\text{Total Cost} = O\left( N_{\text{active}} \times \sum_{f \in \{\text{Name}, \text{City}, \text{Address}\}} \left[ (L_f + M) + \sum_{k=1}^K \sum_{j=1}^{J_f} (|q_k| \cdot |t_j|) + (M_{cond} \cdot L_{f, cond}) \right] \right) + O(N_{\text{matched}} \log N_{\text{matched}})$$

### 5.2. Chính Sách Độ Dài Truy Vấn: Bảo Toàn Nguyên Vẹn (No Silent Truncation)
- Hệ thống bảo toàn toàn bộ chiều dài truy vấn của người dùng, tuyệt đối không âm thầm cắt chuỗi.

### 5.3. Kiên Trúc Bộ Nhớ An Toàn Đa Luồng (Thread-Safe Memory Architecture)
- **Không dùng ma trận tĩnh:** Tuyệt đối không dùng `static int[,]`.
- **Cấp phát bộ đệm theo ngưỡng điều kiện (Conditional Implementation Threshold):**
  1. Khi độ dài token thực tế $|q|, |t| \le 30$: sử dụng `stackalloc int[...]` trên thread stack. Đây là ngưỡng phân nhánh thực thi, không phải giả định mọi token luôn $\le 30$.
  2. Khi token dài $> 30$ hoặc chuỗi condensed ($L \le 500$): Thuê an toàn 3 hàng trạng thái từ `ArrayPool<int>.Shared` và hoàn trả trong `finally`.

### 5.4. Công Cụ Kiểm Chứng Ngoại Tuyến Độc Lập (Bounded Offline Oracle Artifacts)
- **Module lõi:** `docs/agent-coordination/evidence/verify-fuzzy-contract.cjs` (ước lượng xấp xỉ `compareOrdinalIgnoreCaseApprox` & `compareGuid`).
- **Kịch bản kiểm thực:** `docs/agent-coordination/evidence/run-verify-fuzzy-contract.cjs`.
- **Kết quả thực thi ngoại tuyến:** `docs/agent-coordination/evidence/verify-fuzzy-contract-output.txt`.
- **Bằng chứng đối chiếu Runtime .NET thực tế:** `docs/agent-coordination/evidence/dotnet-comparator-fixtures.txt` (đối chiếu Greek counterexample U+1F80/U+1F88 = 0, Straße sign > 0 [140], ASCII case và accent ordering).
- **Kết quả:** 100% assertions kiểm thực toàn diện toàn bộ mảng kết quả (full result array membership, ordering, scores), các phép so sánh dấu ordinal, numeric Guid.CompareTo, loại trừ Inactive, và cơ chế bypass Normalized-Empty đều đạt **PASS (Bounded Offline Deterministic Verifier)** với exit code 0.

---

## 6. Káº¿ Hoáº¡ch Cho LÃ¡t Cáº¯t Tiáº¿p Theo (Next Implementation Slice)

> âš ï¸  **Cam káº¿t ranh giá»›i:** Tuyá»‡t Ä‘á»‘i khÃ´ng viáº¿t mÃ£ nguá»“n C# hay tÃch há»£p Handler cho tá»›i khi báº£n há»£p Ä‘á»“ng ká»¹ thuáº­t nÃ y Ä‘Æ°á»£c Codex vÃ  PO phÃª duyá»‡t chÃnh thá»©c.

---

## 7. CÃ¡c Cá»•ng PhÃª Duyá»‡t Cá»§a PO Giá»¯ NguyÃªn (Open PO Gates / NeedsPO)

ToÃ n bá»™ 5 PO Gates vÃ  2 Business Gates Ä‘Ã£ thá»‘ng nháº¥t váº«n Ä‘Æ°á»£c giá»¯ nguyÃªn tráº¡ng thÃ¡i chá»  PO quyáº¿t Ä‘á»‹nh Ä‘á»™c láº­p:
1. **PO Gate 1:** Giá»¯ `GET /api/public/properties` hay tÃ¡ch endpoint má»›i `GET /api/public/search/properties`.
2. **PO Gate 2:** Ä á»“ng bá»™ chÃnh sÃ¡ch `IsPublished == true` trÃªn toÃ n bá»™ discovery hay giá»¯ nguyÃªn Active-only hiá»‡n cÃ³.
3. **PO Gate 3:** Nguá»“n dataset hÃ nh chÃnh Viá»‡t Nam cÃ³ tháº©m quyá» n.
4. **PO Gate 4:** Káº¿ hoáº¡ch migration bá»• sung `ProvinceCode`, `Ward`, `WardCode`, `LandmarkTags`.
5. **PO Gate 5:** CÆ¡ cháº¿ tÃ¬m kiáº¿m phÃ²ng trá»‘ng xuyÃªn cÆ¡ sá»Ÿ.