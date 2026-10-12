# NHIỆM VỤ & HƯỚNG DẪN ĐIỀU PHỐI — NGÔ VÕ TUẤN AN (LEADER)
### VAI TRÒ: KIẾN TRÚC SƯ HỆ THỐNG & BACKEND LEAD (MSSV: 24TX810001)

Chào Tuấn An! Đây là bản tổng hợp mã nguồn nền tảng, nhiệm vụ và các việc cần làm trong Tuần 2 để điều phối nhóm và tạo vết lịch sử Git trên GitHub:

---

## 1. CẤU TRÚC MÃ NGUỒN NỀN TẢNG (BACKEND & CI/CD) CỦA TUẤN AN
Trong thư mục `code/` ngay bên cạnh tệp này, có sẵn toàn bộ phần mã nguồn nền tảng mà bạn đã hiện thực:

```
code/
├── .github/workflows/
│   └── ci.yml                                      <-- Pipeline CI/CD 6 stages tự động hóa
└── backend/
    ├── src/
    │   ├── HotelSaas.Domain/Entities/
    │   │   ├── Tenant.cs                           <-- Thực thể Doanh nghiệp SaaS
    │   │   ├── Property.cs                         <-- Thực thể Chi nhánh khách sạn
    │   │   ├── User.cs                             <-- Thực thể Người dùng
    │   │   ├── TenantStaff.cs                      <-- Quan hệ Nhân viên - Chi nhánh
    │   │   ├── AccessRole.cs                       <-- Vai trò truy cập hệ thống
    │   │   ├── RolePermission.cs                   <-- Bảng phân quyền chi tiết
    │   │   └── RefreshToken.cs                     <-- Cấp phát phiên đăng nhập an toàn
    │   ├── HotelSaas.WebApi/
    │   │   ├── Controllers/AuthController.cs       <-- API Đăng ký, Đăng nhập, Refresh Token, Đổi chi nhánh
    │   │   ├── Middleware/TenantPropertyContextMiddleware.cs <-- Bảo mật đa chi nhánh fail-closed
    │   │   └── Authorization/PermissionAuthorizationHandler.cs <-- Xử lý phân quyền động (RBAC)
    │   └── HotelSaas.Infrastructure/Persistence/
    │       └── LocalDevDataSeeder.cs               <-- Bộ nạp dữ liệu mẫu 2 chi nhánh phục vụ phát triển
    └── tests/HotelSaas.WebApi.Tests/               <-- Integration tests kiểm thử xác thực và bảo mật
```

---

## 2. CÔNG VIỆC CẦN LÀM TRONG TUẦN 2
1. **Hoàn thiện Pricing Engine (Phase 1B - P2):**
   - Viết `PricingCalculator` tính tiền phòng theo giờ (giờ đầu + phụ thu làm tròn 60 phút) và theo đêm (12:00 hôm trước đến 12:00 hôm sau).
   - Viết API Chính sách chi nhánh: `GET/PUT /api/properties/{id}/policies`.
   - Viết API Bảng giá loại phòng: `GET/POST /api/room-types/{id}/rates`.
   - Viết Unit Tests tự động kiểm tra logic tính giá với 100% test cases pass.
2. **Điều phối và Merge code từ Nguyên và Tân (Tạo vết Git trên GitHub):**
   - Khi Nguyên gửi Pull Request nhánh `feature/nguyen-rooms`:
     - Vào tab **Pull requests** trên GitHub: [https://github.com/GinNgo/hotel-saas-v2/pulls](https://github.com/GinNgo/hotel-saas-v2/pulls)
     - Đọc qua code diff, để lại 1 nhận xét (Review comment) ví dụ: *"Code kiểm tra số phòng hoạt động tốt, đã kiểm tra build OK. Approved!"*
     - Bấm nút **Merge pull request** $\to$ **Confirm merge**.
   - Khi Tân gửi Pull Request nhánh `feature/tan-housekeeping`:
     - Tương tự, review và bấm **Merge pull request**.
   - Sau khi merge cả 2 PR, vào terminal máy mình chạy:
     ```bash
     git checkout develop
     git pull origin develop
     ```
     Lúc này lịch sử git cục bộ của Tuấn An sẽ có đủ toàn bộ commit của Nguyên, Tân và merge commits!

---

## 3. NỘP BÁO CÁO TUẦN 1 CHO GVHD (THS. PHÙNG HỮU XUÂN)
- Báo cáo tổng hợp chung cả nhóm: [`docs/reports/BAO-CAO-TUAN-1-HCMUTE.md`](file:///C:/Dev/hotel-saas-v2/docs/reports/BAO-CAO-TUAN-1-HCMUTE.md)
- Báo cáo cá nhân của Tuấn An: [`docs/reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN.md`](file:///C:/Dev/hotel-saas-v2/docs/reports/BAO-CAO-TUAN-1-NGO-VO-TUAN-AN.md) (hoặc file ngay trong thư mục này).
- Nộp lên cổng đề tài HCMUTE: [https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578) (Topic 578).
