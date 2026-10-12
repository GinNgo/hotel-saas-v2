# HƯỚNG DẪN GIT PUSH & TẠO PULL REQUEST — TRẦN TRỌNG TÂN
### MODULE: QUẢN LÝ BUỒNG PHÒNG (FULLSTACK: BACKEND + FRONTEND)
- **Họ và tên:** Trần Trọng Tân
- **MSSV:** 24TX810025
- **Vai trò:** Thành viên / Fullstack Developer (Backend .NET 10 + Frontend Angular 22)

Chào Tân! Để trên GitHub hiện rõ **lịch sử commit và Pull Request mang tên tài khoản GitHub của Tân**, Tân làm theo các bước hướng dẫn chi tiết dưới đây:

---

## 1. CẤU TRÚC CODE HOÀN CHỈNH (CẢ BACKEND VÀ FRONTEND)
Trong thư mục `code/` ngay bên cạnh tệp này, đã có sẵn **toàn bộ mã nguồn hoàn chỉnh của cả Backend (.NET 10) và Frontend (Angular 22)** thuộc phân hệ Buồng phòng & Trạng thái phòng:

```
code/
├── backend/
│   ├── src/
│   │   ├── HotelSaas.Domain/
│   │   │   ├── Entities/
│   │   │   │   └── HousekeepingTask.cs             <-- Thực thể Nhiệm vụ buồng phòng
│   │   │   └── Enums/
│   │   │       ├── RoomStatus.cs                   <-- Enum Clean, Dirty, Cleaning, Occupied, OutOfService
│   │   │       ├── HousekeepingTaskStatus.cs       <-- Enum trạng thái nhiệm vụ
│   │   │       └── HousekeepingPriority.cs         <-- Enum mức độ ưu tiên dọn dẹp
│   │   ├── HotelSaas.Application/Rooms/
│   │   │   ├── Commands/UpdateRoomStatus/          <-- UpdateRoomStatusCommand, Handler, Validator
│   │   │   └── Services/
│   │   │       └── RoomStatusTransitionValidator.cs <-- State Machine kiểm soát chuyển đổi trạng thái
│   │   └── HotelSaas.WebApi/
│   │       ├── Controllers/RoomsController.cs      <-- Endpoint PATCH /api/rooms/{id}/status
│   │       └── Models/UpdateRoomStatusRequest.cs   <-- Request DTO kèm expectedOldStatus
│   └── tests/
│       └── HotelSaas.Application.Tests/Rooms/      <-- Unit Tests State Machine & Concurrency 409
│
└── frontend/
    └── src/app/
        ├── core/
        │   ├── models/enums.ts                     <-- Enum RoomStatus và mapping nhãn màu
        │   └── utils/
        │       ├── housekeeping-concurrency.util.ts <-- Xử lý 409 Conflict & ERR_STALE_STATE
        │       └── housekeeping-kpi.util.ts         <-- Tính toán KPI buồng phòng trên trang
        ├── features/housekeeping/
        │   └── housekeeping.page.ts                <-- Màn hình Bảng Buồng phòng tương tác 1 chạm
        └── shared/components/
            ├── pagination/pagination.component.ts  <-- Component phân trang dùng chung
            └── skeleton-table/skeleton-table.component.ts <-- Component khung xương tải trang
```

---

## 2. CÁC LỆNH GIT CHẠY TRÊN MÁY CỦA TÂN (TẠO VẾT COMMIT)

Mở terminal (Git Bash hoặc VS Code Terminal) tại thư mục `hotel-saas-v2` trên máy của Tân:

### Bước 1: Đồng bộ nhánh develop mới nhất từ GitHub
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh tính năng riêng của Tân
```bash
git checkout -b feature/tan-housekeeping
```

### Bước 3: Đưa toàn bộ code vào dự án
Copy toàn bộ thư mục `backend/` và `frontend/` trong thư mục `code/` vào repo:
```bash
# Lệnh copy trong terminal:
cp -r team-handoff/tran-trong-tan-24TX810025/code/backend/* backend/
cp -r team-handoff/tran-trong-tan-24TX810025/code/frontend/* frontend/
```

### Bước 4: Kiểm tra build cả Backend và Frontend
```bash
# 1. Kiểm tra Backend (.NET 10):
dotnet build backend/HotelSaas.sln --verbosity minimal

# 2. Kiểm tra Frontend (Angular 22):
cd frontend
npm run build
cd ..
```
*(Đảm bảo cả Backend và Frontend đều báo Build Succeeded, 0 lỗi!)*

### Bước 5: Commit với tài khoản GitHub của Tân
```bash
git add backend/src/HotelSaas.Application/Rooms/Commands/UpdateRoomStatus/
git add backend/src/HotelSaas.Application/Rooms/Services/RoomStatusTransitionValidator.cs
git add backend/src/HotelSaas.Domain/Entities/HousekeepingTask.cs
git add backend/src/HotelSaas.Domain/Enums/
git add backend/src/HotelSaas.WebApi/Models/UpdateRoomStatusRequest.cs
git add backend/tests/HotelSaas.Application.Tests/Rooms/RoomStatusTransitionValidatorTests.cs
git add backend/tests/HotelSaas.Application.Tests/Rooms/UpdateRoomStatusCommandValidatorTests.cs
git add frontend/src/app/core/
git add frontend/src/app/features/housekeeping/
git add frontend/src/app/shared/components/

git commit -m "feat(housekeeping): Trần Trọng Tân - implement housekeeping board and state machine (Fullstack BE FSM + FE Angular)"
```

### Bước 6: Đẩy nhánh tính năng lên GitHub
```bash
git push -u origin feature/tan-housekeeping
```

### Bước 7: Mở Pull Request trên giao diện GitHub
1. Mở trình duyệt vào link: [https://github.com/GinNgo/hotel-saas-v2/pulls](https://github.com/GinNgo/hotel-saas-v2/pulls)
2. Bấm nút xanh **New pull request**.
3. Chọn:
   - Base branch: `develop`
   - Compare branch: `feature/tan-housekeeping`
4. Tiêu đề PR: `feat(housekeeping): Trần Trọng Tân (24TX810025) - Hoàn thiện module Buồng phòng & State Machine (Fullstack)`
5. Bấm **Create pull request** và báo nhóm trưởng **Ngô Võ Tuấn An** để duyệt và merge.
