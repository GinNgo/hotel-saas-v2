# 🎨 UI/UX Design Direction

> **Tài liệu:** SDD-07 | **Phiên bản:** 1.0 | **Ngày:** 2026-10-03
> **Rubric mapping:** TC2.2 (giao diện nhất quán), TC3 (demo trực quan)

---

## 1. Design Direction

### Phong cách: **Modern Professional — Clean & Warm**

| Yếu tố | Quyết định | Lý do |
|--------|-----------|-------|
| Tone | Chuyên nghiệp, ấm áp, thân thiện | Nhân viên khách sạn cần giao diện dễ chịu (ca dài) |
| Layout | Sidebar + Top bar + Content area | Dashboard pattern chuẩn PMS |
| Density | Medium — không quá sparse, không quá dense | Balance giữa information density và readability |
| Motion | Subtle — transitions, status changes | Functional motion, không decorative |
| Mode | Light (default) + Dark mode | Staff ca đêm cần dark mode |

---

## 2. Color Palette

### Primary Theme: **Hotel Indigo**

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--primary` | `#4F46E5` (Indigo 600) | `#818CF8` (Indigo 400) | Buttons, active states, links |
| `--primary-hover` | `#4338CA` (Indigo 700) | `#6366F1` (Indigo 500) | Hover states |
| `--success` | `#16A34A` (Green 600) | `#4ADE80` (Green 400) | Clean, Confirmed, Completed |
| `--warning` | `#D97706` (Amber 600) | `#FBBF24` (Amber 400) | Pending, Cleaning, caution |
| `--danger` | `#DC2626` (Red 600) | `#F87171` (Red 400) | Dirty, Cancelled, errors |
| `--info` | `#0284C7` (Sky 600) | `#38BDF8` (Sky 400) | Occupied, info messages |
| `--surface` | `#FFFFFF` | `#1E1E2E` | Cards, panels |
| `--background` | `#F8FAFC` (Slate 50) | `#11111B` | Page background |
| `--text` | `#1E293B` (Slate 800) | `#CDD6F4` | Primary text |
| `--text-secondary` | `#64748B` (Slate 500) | `#A6ADC8` | Secondary text |
| `--border` | `#E2E8F0` (Slate 200) | `#313244` | Borders, dividers |

### Room Status Colors (đặc biệt quan trọng cho Room Board)

| Status | Color | Badge | Meaning |
|--------|-------|-------|---------|
| Clean | `#16A34A` Green | 🟢 | Sẵn sàng đón khách |
| Occupied | `#0284C7` Blue | 🔵 | Đang có khách |
| Dirty | `#DC2626` Red | 🔴 | Cần dọn |
| Cleaning | `#D97706` Amber | 🟡 | Đang dọn |
| OutOfService | `#6B7280` Gray | ⚫ | Bảo trì |

---

## 3. Typography

| Level | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| Display | Inter | 36px | 700 | Dashboard KPI numbers |
| H1 | Inter | 28px | 700 | Page titles |
| H2 | Inter | 22px | 600 | Section headers |
| H3 | Inter | 18px | 600 | Card titles |
| Body | Inter | 14px | 400 | General text |
| Body small | Inter | 12px | 400 | Labels, captions |
| Mono | JetBrains Mono | 13px | 400 | Codes, confirmation codes |

**Lý do chọn Inter:** Free, excellent Vietnamese diacritics support, optimized for screen, professional feel.

---

## 4. Layout Structure

### Management Portal (Staff/Owner)

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar                                                       │
│  [☰] [🔔 3] [🌐 VI ▾] [🌓] [👤 Anh Tuấn ▾]                │
├─────────┬────────────────────────────────────────────────────┤
│ SideNav │  Content Area                                      │
│         │  ┌──────────────────────────────────────────────┐  │
│ 📊 Dashboard│  KPI Cards (Revenue | Occupancy | Check-ins) │  │
│ 📅 Bookings │  ┌─────────┬─────────┬─────────┬─────────┐  │  │
│ 🏨 Rooms    │  │ 12.5M đ │  78.5%  │  8 ↑    │  5 ↓    │  │  │
│ 🧹 Housekeep│  │ Revenue │ Occupan │ Check-In│Check-Out│  │  │
│ 💳 Payments │  └─────────┴─────────┴─────────┴─────────┘  │  │
│ 📊 Reports  │                                              │  │
│ 💰 Pricing  │  Revenue Chart [Line Chart — tuần này vs trước]│ │
│ 🤖 AI       │                                              │  │
│ 👥 Staff    │  Room Status Board                           │  │
│ ⚙️ Settings │  ┌───┬───┬───┬───┬───┐                      │  │
│             │  │101│102│103│104│105│  ← Color-coded        │  │
│             │  │ 🟢│ 🔵│ 🔴│ 🟢│ 🟡│  ← by status         │  │
│             │  └───┴───┴───┴───┴───┘                      │  │
│             │  ┌───┬───┬───┬───┬───┐                      │  │
│             │  │201│202│203│204│205│                       │  │
│             │  │ 🔵│ 🔵│ 🟢│ ⚫│ 🔵│                       │  │
│             │  └───┴───┴───┴───┴───┘                      │  │
└─────────┴────────────────────────────────────────────────────┘
```

### Public Booking Portal (Guest)

```
┌──────────────────────────────────────────────────────────────┐
│  Navbar: [Logo] [Tìm kiếm] [Đăng nhập] [VI/EN]             │
├──────────────────────────────────────────────────────────────┤
│  Hero Section                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  🏨 Tìm phòng nghỉ lý tưởng                         │    │
│  │  [📍 Đà Lạt ▾] [📅 03/10 → 05/10] [👥 2] [🔍 Tìm] │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Search Results                                              │
│  ┌──────────────────────────────────┐                        │
│  │ [📷 Ảnh] │ Nhà Nghỉ Hoa Đào      │                        │
│  │          │ ⭐ 4.5 (23 đánh giá)   │                        │
│  │          │ Deluxe Double — 2 khách │                        │
│  │          │ 💰 500,000đ / đêm      │ ← Real-time price     │
│  │          │ [Đặt ngay →]           │                        │
│  └──────────────────────────────────┘                        │
│  ┌──────────────────────────────────┐                        │
│  │ [📷 Ảnh] │ Khách Sạn Biển Xanh    │                        │
│  │          │ ⭐ 4.2 (45 đánh giá)   │                        │
│  │          │ Standard Twin — 2 khách │                        │
│  │          │ 💰 350,000đ / đêm      │                        │
│  │          │ [Đặt ngay →]           │                        │
│  └──────────────────────────────────┘                        │
│                                                              │
│  💬 AI Chatbot Widget [↗]                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Key Screens — Wireframe Descriptions

### 5.1 Dashboard

```
Top row: 4 KPI cards (Revenue, Occupancy%, Today Check-ins, Today Check-outs)
         Each card: icon + large number + % change vs previous period
         Colors: Revenue=indigo, Occupancy=green, Check-in=blue, Check-out=amber

Middle: Revenue chart (Line — 7 days, compare with last week)
        Right: Donut chart — Room status breakdown

Bottom: Two columns
        Left: "Arrivals Today" table (guest, room, time, status)
        Right: "Departures Today" table (guest, room, balance)
```

### 5.2 Room Board (Real-time)

```
View options: [Grid] [Calendar] [List]

Grid mode: Rooms grouped by floor
  Floor 1: [101 🟢] [102 🔵 "Linh"] [103 🔴] [104 🟢] [105 🟡]
  Floor 2: [201 🔵 "Tuấn"] [202 🔵] [203 🟢] [204 ⚫] [205 🔵]

Click on room → Side Drawer opens:
  Room 102 — Deluxe Double
  Status: Occupied
  Guest: Lê Thùy Linh (🔑 Check-in: 01/10, Check-out: 03/10)
  [Check-out] [View Folio] [Add Note]
  Timeline: recent activity for this room

SignalR: status changes animate (pulse + color transition)
```

### 5.3 Booking Calendar

```
Calendar mode: Room rows × Date columns (Gantt-like)
  [◀ Sep] [October 2026] [Nov ▶]

       01  02  03  04  05  06  07  08  09  10
  101  [== Confirmed ==]      [=== Pending ===]
  102  [=== CheckedIn ===]
  103                    [== Confirmed ==]
  ...

Color: Confirmed=blue, CheckedIn=green, PendingPayment=amber, Cancelled=red/strikethrough
Hover: tooltip with guest name, phone, amount
Click: open reservation detail drawer
```

### 5.4 Invoice Print View

```
╔══════════════════════════════════════════════════════╗
║                 HÓA ĐƠN THANH TOÁN                  ║
║               INVOICE / RECEIPT                       ║
╠══════════════════════════════════════════════════════╣
║  NHÀ NGHỈ HOA ĐÀO                                   ║
║  12 Trần Phú, Phường 3, TP. Đà Lạt                  ║
║  ĐT: 0263-123-4567 | MST: 1234567890                ║
╠══════════════════════════════════════════════════════╣
║  Số HĐ: INV-2026-100315-001                         ║
║  Ngày:  03/10/2026                                   ║
╠══════════════════════════════════════════════════════╣
║  KHÁCH HÀNG                                          ║
║  Họ tên: Lê Thùy Linh                               ║
║  CCCD:   012345678901                                 ║
║  SĐT:    0912-345-678                                ║
╠══════════════════════════════════════════════════════╣
║  CHI TIẾT                                             ║
║  ┌──────────────────────────────────┬───────────┐    ║
║  │ Phòng Deluxe 205 (2 đêm × 500k) │ 1,000,000 │    ║
║  │ Minibar                          │   150,000 │    ║
║  │ Giặt ủi                         │    80,000 │    ║
║  ├──────────────────────────────────┼───────────┤    ║
║  │ Tạm tính                        │ 1,230,000 │    ║
║  │ Thuế VAT (10%)                  │   123,000 │    ║
║  │ Phí dịch vụ (5%)               │    61,500 │    ║
║  ├──────────────────────────────────┼───────────┤    ║
║  │ TỔNG CỘNG                       │ 1,414,500 │    ║
║  ├──────────────────────────────────┼───────────┤    ║
║  │ Đã thanh toán (VNPay 01/10)     │  -500,000 │    ║
║  │ Đã thanh toán (Cash 03/10)      │  -914,500 │    ║
║  ├──────────────────────────────────┼───────────┤    ║
║  │ CÒN LẠI                         │         0 │    ║
║  └──────────────────────────────────┴───────────┘    ║
╠══════════════════════════════════════════════════════╣
║  Cảm ơn quý khách! Hẹn gặp lại!                     ║
╚══════════════════════════════════════════════════════╝
```

### 5.5 Revenue Report

```
Filters: [Date range picker] [Room type ▾] [Compare with ▾]

Row 1: 4 metric cards
  Revenue (12.5M đ, +15%) | Occupancy (78.5%, +5%) | ADR (450k đ) | RevPAR (353k đ)

Row 2: Revenue Line Chart (daily for 30 days, compare previous period)

Row 3: Two columns
  Left: Revenue by Room Type (Bar chart)
  Right: Payment Method Breakdown (Donut — VNPay 60%, Cash 30%, Transfer 10%)

Row 4: Revenue table (sortable, exportable)
  Date | Rooms Sold | Revenue | ADR | Occupancy%
  03/10 | 22/28    | 9.9M đ  | 450k| 78.5%
  02/10 | 20/28    | 8.5M đ  | 425k| 71.4%

Actions: [📥 Excel] [📄 PDF] [🤖 AI Narrative Report]
```

### 5.6 Notification Panel

```
Click 🔔 → Dropdown panel (right side)

  🔔 Thông báo (3 chưa đọc)
  ─────────────────────────
  🟢 Vừa xong
  Đặt phòng mới #HK7B2M
  Phòng Deluxe 205, 2 đêm — Lê Thùy Linh
  2 phút trước                          [Mark read]

  🟡 Chưa đọc
  Thanh toán VNPay 500,000đ
  Booking #HK7B2M
  15 phút trước                         [Mark read]

  🟡 Chưa đọc
  AI đề xuất tăng giá Deluxe +20%
  Lý do: Occupancy > 85% tuần tới
  1 giờ trước                    [Xem] [Mark read]

  ─────────────────────────
  Đã đọc
  ✅ Phòng 103 đã dọn xong
  3 giờ trước

  [Đánh dấu tất cả đã đọc] [Xem tất cả →]
```

---

## 6. Real-time Update Patterns

| Sự kiện | Visual feedback | SignalR event |
|---------|----------------|---------------|
| Room status change | Room card pulses + color transitions (300ms) | `RoomStatusChanged` |
| New booking | Toast notification + badge count +1 | `NewBooking` |
| Price change | Price text fades out → new price fades in | `PriceChanged` |
| Housekeeping done | Room card: Red→Green transition | `RoomStatusChanged` |
| Payment received | Toast + dashboard KPI counter animates | `RevenueUpdated` |
| AI suggestion | Bell icon pulse + notification panel | `AiPricingSuggestion` |

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Layout changes |
|-----------|-------|---------------|
| Desktop | ≥ 1280px | Full sidebar + content |
| Tablet | 768-1279px | Collapsible sidebar (icon-only) |
| Mobile | < 768px | Bottom nav, full-width content, hamburger menu |

---

## 8. PrimeNG Component Mapping

| UI Element | PrimeNG Component | Custom |
|-----------|------------------|--------|
| Data tables | `p-table` (with sort, filter, paginator) | — |
| Forms | `p-inputText`, `p-calendar`, `p-dropdown` | — |
| Dialogs | `p-dialog` | — |
| Side drawers | `p-sidebar` | — |
| Toast messages | `p-toast` | — |
| Charts | `p-chart` (Chart.js wrapper) | — |
| Room board | Custom grid | `room-status-card` component |
| Booking calendar | Custom | `booking-calendar` component |
| KPI cards | Custom | `kpi-card` component |
| Notification panel | Custom | `notification-panel` component |
---

## 9. UI/UX Benchmark — Tham khảo từ nền tảng thực tế

> Các pattern dưới đây được rút ra từ phân tích UI/UX 8 nền tảng booking + 4 PMS dashboard thực tế.
> Chi tiết link tham khảo: xem [docs/references.md — Mục H](../references.md).

### 9.1 Public Booking Page — Học từ OTA

| Thành phần | Tham khảo từ | Pattern áp dụng |
|-----------|-------------|----------------|
| **Hero Search Bar** | Agoda, Booking.com, Traveloka | Full-width search bar: `[📍 Destination] [📅 Check-in → Check-out] [👥 Guests] [🔍 Tìm]`, auto-suggest destinations |
| **Hotel Result Card** | Agoda, Trivago | Layout: Ảnh (16:9) bên trái → Thông tin giữa (tên, rating ⭐, tiện ích icons) → Giá nổi bật bên phải (màu `--primary`, font Display 36px) + CTA "Đặt ngay" |
| **Filter Sidebar** | Booking.com, Trivago | Sticky sidebar trái: Giá (range slider), Loại phòng (checkbox), Rating (stars), Tiện ích (WiFi, parking...), Khoảng cách |
| **Urgency Badge** | Agoda | `🔥 Chỉ còn 2 phòng!` — badge đỏ trên card khi availability < 3 |
| **Price Transparency** | Traveloka | "Giá cuối cùng" — hiện tổng bao gồm thuế + phí dịch vụ ngay trên card, không ẩn |
| **Review System** | Booking.com, Agoda | Score badge (ví dụ 8.5/10) + category breakdown (Sạch sẽ, Vị trí, Dịch vụ...) |
| **Photo Gallery** | Expedia | Grid thumbnail → Click → Fullscreen lightbox swipe |
| **Map Integration** | Booking.com, Hotels.com | Map view toggle: list ↔ map, markers color-coded by price range |

### 9.2 Management Dashboard — Học từ PMS + Host Dashboard

| Thành phần | Tham khảo từ | Pattern áp dụng |
|-----------|-------------|----------------|
| **KPI Cards** | Airbnb Host Dashboard 2026 | **Actionable KPIs** — không chỉ hiện số, mà kèm gợi ý: "Revenue ↑15% — *AI đề xuất tăng giá Deluxe 20%*" |
| **"Calm" Interface** | Airbnb 2026 design trend | Ít visual noise, ample whitespace, muted palette, functional motion only |
| **Room Status Board** | Cloudbeds, ezCloudhotel | Grid phòng color-coded (🟢🔵🔴🟡⚫) → Click → Side drawer detail (xem Section 5.2) |
| **Booking Calendar** | Booking.com Extranet, Cloudbeds | Gantt-like: hàng = phòng, cột = ngày, booking bar color-coded by status |
| **Revenue Analytics** | Booking.com Extranet, Airbnb | Line chart revenue (7/30/90 days) + Donut room type breakdown + Table sortable |
| **Multi-property Switcher** | Booking.com, Mews | Dropdown góc trái top bar: chọn cơ sở (cho Enterprise multi-branch) |
| **Role Permissions** | ezCloudhotel, Booking.com Extranet | Staff accounts with scoped access — tham khảo cho RBAC UI |
| **Mobile Management** | ezCloudhotel App, Booking.com Pulse | Bottom nav 5 tabs: Dashboard / Bookings / Rooms / Notifications / More |

### 9.3 So sánh visual — Trước vs Sau benchmark

```
TRƯỚC (generic PMS):                    SAU (benchmark-informed):
┌─────────────────────┐                 ┌─────────────────────────────────┐
│ Boring table grid   │                 │ ┌─────┐ ┌─────┐ ┌─────┐       │
│ All text, no visual │                 │ │💰12M│ │📊78%│ │⬆️ 8 │  ← KPI│
│ No color coding     │                 │ │Rev. │ │Occ. │ │In   │  cards│
│ Cramped layout      │                 │ └─────┘ └─────┘ └─────┘       │
│                     │                 │                                 │
│ Room 101: Available │                 │ [101🟢][102🔵][103🔴]  ← Color │
│ Room 102: Occupied  │                 │ [201🔵][202🟢][203🟡]  board   │
│ Room 103: Dirty     │                 │                                 │
│                     │                 │ ══════════════════════          │
│                     │                 │ 📈 Revenue 7 days (chart)      │
└─────────────────────┘                 └─────────────────────────────────┘
```

---

*Tài liệu này phục vụ TC2.2 (giao diện nhất quán) và TC3 (demo trực quan). Bao gồm color system, typography, layout wireframes, invoice print format, real-time update patterns, và benchmark UI/UX từ 12 nền tảng thực tế (Agoda, Booking.com, Traveloka, Airbnb, Trivago, Expedia, Hotels.com, ezCloudhotel, Cloudbeds, Mews).*

