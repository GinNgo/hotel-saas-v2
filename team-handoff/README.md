# TỔNG HỢP BÀN GIAO MÃ NGUỒN & TÀI LIỆU — HOTEL SAAS PLATFORM (TOPIC 578)
### TRƯỜNG ĐẠI HỌC SƯ PHẠM KỸ THUẬT TP. HỒ CHÍ MINH — KHOA CNTT
**Giảng viên hướng dẫn:** ThS. Phùng Hữu Xuân (`phunghx@hcmute.edu.vn`)  
**Repository GitHub:** [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)  
**Nhánh làm việc chính:** `develop`

---

## 1. PHÂN CHIA THƯ MỤC BÀN GIAO CHO 3 THÀNH VIÊN (FULLSTACK BE + FE)

Toàn bộ gói công việc được phân chia theo đúng chuyên trách module của từng sinh viên. Trong mỗi thư mục đều có **ĐẦY ĐỦ CẢ BACKEND (.NET 10 CQRS) VÀ FRONTEND (Angular 22)** để các bạn có thể kiểm tra build độc lập, commit dưới tài khoản GitHub của mình và tạo Pull Request minh bạch trên GitHub:

```
team-handoff/
│
├── README.md                              <-- Hướng dẫn tổng quan toàn bộ gói bàn giao
│
├── ngo-vo-tuan-an-24TX810001/             <-- THƯ MỤC DÀNH CHO NHÓM TRƯỞNG TUẤN AN
│   ├── BAO-CAO-TUAN-1-HCMUTE.md           <-- Báo cáo tổng hợp nộp GVHD ThS. Phùng Hữu Xuân
│   ├── BAO-CAO-TUAN-1-NGO-VO-TUAN-AN.md   <-- Báo cáo cá nhân nộp Tuần 1 của Tuấn An
│   ├── ROADMAP-CHI-TIET-3-THANH-VIEN.md   <-- Lộ trình 7 tuần chi tiết cho cả 3 bạn (chung 1 file)
│   ├── NHIEM-VU-VA-HUONG-DAN-LEADER.md    <-- Hướng dẫn review code & merge PR từ 2 bạn
│   └── code/                              <-- Mã nguồn Kiến trúc nền tảng, Auth & CI/CD
│       ├── .github/workflows/ci.yml       <-- Pipeline CI/CD GitHub Actions 6 stages
│       └── backend/src/
│           ├── HotelSaas.Domain/Entities/ <-- Tenant.cs, Property.cs, User.cs, AccessRole.cs...
│           ├── HotelSaas.WebApi/          <-- AuthController.cs, TenantPropertyContextMiddleware.cs...
│           ├── HotelSaas.Infrastructure/  <-- LocalDevDataSeeder.cs
│           └── tests/HotelSaas.WebApi.Tests/ <-- Integration & Auth Tests
│
├── nguyen-khoi-nguyen-24TX810011/         <-- GỬI NGUYÊN THƯ MỤC NÀY CHO NGUYỄN KHÔI NGUYÊN
│   ├── BAO-CAO-TUAN-1-NGUYEN-KHOI-NGUYEN.md <-- Báo cáo cá nhân nộp Tuần 1 của Nguyên
│   ├── HUONG-DAN-GIT-PUSH-VA-PR.md        <-- Hướng dẫn chi tiết lệnh Git checkout, build, commit, PR
│   └── code/                              <-- TOÀN BỘ MÃ NGUỒN PHÂN HỆ ROOMS & ROOM TYPES (BE + FE)
│       ├── backend/
│       │   ├── src/
│       │   │   ├── HotelSaas.Domain/Entities/   <-- Room.cs, RoomType.cs
│       │   │   ├── HotelSaas.Application/Rooms/ <-- Commands (Create, Update, Delete) & Queries
│       │   │   ├── HotelSaas.Application/RoomTypes/ <-- Commands & Queries hạng phòng
│       │   │   └── HotelSaas.WebApi/Controllers/ <-- RoomsController.cs, RoomTypesController.cs
│       │   └── tests/HotelSaas.Application.Tests/Rooms/ <-- Unit tests tự động
│       └── frontend/
│           └── src/app/
│               ├── core/models/   <-- room.model.ts, room-type.model.ts
│               ├── core/services/ <-- room.service.ts, room-type.service.ts
│               ├── core/utils/    <-- rooms-validation.util.ts, room-types-filter.util.ts
│               └── features/      <-- rooms.page.ts, room-types.page.ts
│
└── tran-trong-tan-24TX810025/             <-- GỬI NGUYÊN THƯ MỤC NÀY CHO TRẦN TRỌNG TÂN
    ├── BAO-CAO-TUAN-1-TRAN-TRONG-TAN.md   <-- Báo cáo cá nhân nộp Tuần 1 của Tân
    ├── HUONG-DAN-GIT-PUSH-VA-PR.md        <-- Hướng dẫn chi tiết lệnh Git checkout, build, commit, PR
    └── code/                              <-- TOÀN BỘ MÃ NGUỒN PHÂN HỆ BUỒNG PHÒNG (BE + FE)
        ├── backend/
        │   ├── src/
        │   │   ├── HotelSaas.Domain/Entities/   <-- HousekeepingTask.cs
        │   │   ├── HotelSaas.Domain/Enums/      <-- RoomStatus.cs, HousekeepingTaskStatus.cs...
        │   │   ├── HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/ <-- Command & Validator
        │   │   ├── HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs <-- State Machine FSM
        │   │   └── HotelSaas.WebApi/            <-- Models/UpdateRoomStatusRequest.cs
        │   └── tests/HotelSaas.Application.Tests/Rooms/ <-- Unit tests State Machine & Concurrency
        └── frontend/
            └── src/app/
                ├── core/models/       <-- enums.ts (RoomStatus, nhãn màu)
                ├── core/utils/        <-- housekeeping-concurrency.util.ts, housekeeping-kpi.util.ts
                ├── features/          <-- housekeeping.page.ts
                └── shared/components/ <-- pagination.component.ts, skeleton-table.component.ts
```
