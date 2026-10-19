# Contract form dùng chung — đề xuất

## Ownership

Feature giữ FormControl/ngModel, validators, submit, payload, quyền và network qua core service. Shared chỉ chịu presentation và interaction; không inject AuthService/HttpClient hoặc tự quyết business limits. Không viết schema-driven form engine.

## Component boundary

| Thành phần | Reuse / đề xuất | Contract |
| --- | --- | --- |
| Field shell | Đề xuất shared/components/form-field | controlId, label, hint, required, error text, invalid/submitted state; content projection giữ native/control integration; render errorId/hintId duy nhất; không giữ value |
| Native text/textarea/select | Native + đề xuất shared/directives/form-control | class/token state chung; caller vẫn khai báo id/name/autocomplete/type/inputmode, aria-describedby và validators; không override CVA native |
| Password | PrimeNG Password hiện có | inputId trỏ input thật; label/error association và reveal accessible name cần kiểm DOM; không wrapper chung làm mất API/library semantics |
| Searchable select | Component CVA hiện có | value string, item ID ổn định, options reactive, nullable/empty thống nhất contract caller; disabled từ form; touched khi blur/đóng/interaction; không emit onChange khi writeValue |
| Booking stay | PublicStayContext + bộ lọc hiện có | Hourly/Daily/Overnight, một phòng theo API hiện tại; giữ validation/múi giờ/cấu hình từng property. Không dùng report date presets thay booking rules |
| Date report | DateRangeFilter hiện có | Chỉ dùng phạm vi ngày báo cáo; tránh fixed input IDs giữa nhiều instance; kiểm tra datepicker overlay/focus |
| Submit/status | Native button + shared status pattern | pending disable duplicate submit, aria-busy, label hành động cụ thể; lỗi không clear dữ liệu; success chỉ sau server |
| Dialog | Modal hiện có + CDK nếu cần | initial focus, trap khi modal mở, Escape, close button có label, focus restore trigger; backdrop không phải đường đóng duy nhất |

## State matrix

| State | Visual / semantic | Hành vi |
| --- | --- | --- |
| Empty/idle | label luôn có, placeholder chỉ ví dụ | Không đỏ trước tương tác |
| Focus | focus ring rõ qua keyboard, không chỉ border đổi màu | Giữ native text selection/shortcut |
| Filled | Giá trị thật, không đổi label thành placeholder | Autofill/paste hoạt động |
| Invalid | aria-invalid=true, error liên kết và text cụ thể | Chỉ show sau touched hoặc submit; error summary có link tới field nếu form dài |
| Disabled | disabled thật, không chỉ opacity | Không phát mutation/selection; không tự xóa value |
| Readonly | readonly nếu native hỗ trợ; lý do khi cần | Có thể đọc/copy giá trị; khác disabled |
| Pending | status ngắn, aria-busy, CTA không submit lặp | Preserve input và ý định retry/idempotency |
| Server error | Có retry, thông báo không lộ nội bộ | Map field error khi contract hỗ trợ; không đổi lỗi quyền thành thành công |
| Success | Thông tin từ response thật | Không điều hướng/mã/điểm giả |

## Searchable select interaction

Chọn một pattern nhất quán trước code: trigger button mở popup có searchbox được gắn label và listbox. ArrowDown/Up di chuyển option, Enter chọn, Escape đóng và trả focus trigger, Tab đi đúng thứ tự. Nếu dùng combobox pattern thì focus/aria-activedescendant phải bám đúng input thật, không ghép nửa pattern của hai loại.

Clear là button riêng cạnh trigger, không lồng interactive element. Mọi option có id/role/aria-selected theo pattern đã chọn; không dùng màu làm dấu chọn duy nhất. Loading/no result/error khác nhau; không hiển thị no result khi options còn tải. Options cập nhật bất đồng bộ phải render đúng ngay cả khi query/value không đổi. Không âm thầm clear value sau options refresh nếu caller chưa cho phép; hiển thị unavailable selection và để caller quyết định.

## Token proposal (aliases, chưa apply)

Primitive giữ palette trong styles.css; semantic thêm control-bg/text/border/focus/invalid/disabled, action-primary theo shell và shared-feedback-success/error; component field-gap/control-height/control-radius.

Một nguồn primitive, Tailwind đọc aliases thay khai báo hex độc lập. Pilot không đổi toàn bộ radius/brand. Control tối thiểu 44px, spacing 4/8, body input 16px, hint không dưới 12px. Đo contrast trên combination thực tế; không tuyên bố đạt chỉ vì chọn tên màu.

## Contract tests tối thiểu

1. Hai field cùng loại không trùng id; accessible name/hint/error tới đúng control thật.
2. writeValue không emit mutation; touched/disabled tương thích typed reactive forms và consumer template-driven hiện có.
3. Options [] → loaded → replaced cập nhật render/selected label; lọc tiếng Việt vẫn hoạt động.
4. Keyboard/clear/outside pointer/focus-out/Escape không submit parent form hoặc mất selection sớm.
5. Submit invalid focus field đầu; request fail giữ input; retry không sinh idempotency mới cho cùng ý định.
6. Dialog/datepicker focus tested trong browser; unit DOM không thay screen reader/visual QA.
