# 👥 Hướng Dẫn Nghiệp Vụ: Quản Lý Nhân Viên & Phân Quyền (Staff Management)
> **Mã task:** `CAT-STAFF-01` | **Đường dẫn đề xuất:** `/staff`  
> **Kỹ sư phụ trách:** **Tân** (Full-Stack) | **Reviewer:** **Nguyên** (Full-Stack) | **Trạng thái:** **`Ready`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN
- **Mục đích:** Quản lý danh sách nhân sự làm việc tại chi nhánh, gán vai trò quyền hạn (Role), cấp và thu hồi quyền truy cập hệ thống theo chi nhánh.
- **Đối tượng sử dụng:**
  - **Tenant Owner / General Manager:** Toàn quyền thêm, đổi vai trò, xóa nhân viên.
  - **Property Manager:** Xem danh sách nhân viên chi nhánh, đề xuất phân quyền.
- **Phân quyền RBAC:**
  - Xem danh sách: `STAFF:Read`
  - Thêm / Sửa / Phân quyền: `STAFF:Manage`

---

## 2. TRƯỜNG DỮ LIỆU & RÀNG BUỘC

| Trường dữ liệu | Bắt buộc | Ràng buộc | Ý nghĩa |
| :--- | :---: | :--- | :--- |
| `UserId` | **Có** | GUID tồn tại trong bảng Users | Tài khoản người dùng |
| `FullName` | **Có** | Tối đa 100 ký tự | Họ và tên nhân viên |
| `Email` | **Có** | Định dạng email hợp lệ | Email đăng nhập |
| `RoleName` | **Có** | `Manager`, `FrontDesk`, `Housekeeping`, `Maintenance` | Vai trò đảm nhiệm tại chi nhánh |
| `IsActive` | **Có** | Boolean | Trạng thái hoạt động |
| `CreatedAtUtc`| Tự sinh | ISO 8601 UTC | Ngày gia nhập chi nhánh |

**Quy tắc an toàn bảo mật:**
- **Chống tự khóa tài khoản:** Không cho phép người dùng tự xóa hoặc hạ quyền của chính bản thân đang đăng nhập.
- **Cô lập chi nhánh tuyệt đối (Fail-Closed):** Quản lý chi nhánh A không thể nhìn thấy hoặc thao tác với nhân viên thuộc chi nhánh B trừ khi có cờ `IsTenantWide = true`.

---

## 3. THIẾT KẾ GIAO DIỆN & BỘ UI DÙNG CHUNG
1. **Tìm kiếm:** Input tìm theo tên hoặc email với debounce 300ms.
2. **Bộ lọc vai trò:** Dropdown lọc theo `Manager`, `FrontDesk`, `Housekeeping`.
3. **Phân trang:** Sử dụng `app-pagination`.
4. **Xác nhận xóa:** Sử dụng `AlertService.confirmDelete`.
5. **Loading & Empty State:** Sử dụng `app-skeleton-table` và `app-empty-state`.

---

## 4. CHECKLIST TRIỂN KHAI CHO TÂN (DEFINITION OF DONE)
- [ ] Giao diện danh sách nhân viên hiển thị chính xác theo chi nhánh đang active trên Topbar.
- [ ] Modal thêm nhân viên / gán vai trò có validate đầy đủ.
- [ ] Thao tác xóa nhân viên có hộp thoại SweetAlert2 xác nhận.
- [ ] Viết Unit & Integration tests bảo vệ branch isolation.
