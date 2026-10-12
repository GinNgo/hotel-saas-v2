# HƯỚNG DẪN GIT PUSH & TẠO PULL REQUEST — NGUYỄN KHÔI NGUYÊN
### MODULE: QUẢN LÝ PHÒNG & HẠNG PHÒNG (FULLSTACK: BACKEND + FRONTEND)
- **Họ và tên:** Nguyễn Khôi Nguyên
- **MSSV:** 24TX810011
- **Vai trò:** Thành viên / Fullstack Developer (Backend .NET 10 + Frontend Angular 22)

Chào Nguyên! Để trên GitHub hiện rõ **lịch sử commit và Pull Request mang tên tài khoản GitHub của Nguyên**, Nguyên làm theo các bước hướng dẫn chi tiết dưới đây:

---

## 1. CẤU TRÚC CODE HOÀN CHỈNH (CẢ BACKEND VÀ FRONTEND)
Trong thư mục `code/` ngay bên cạnh tệp này, đã có sẵn **toàn bộ mã nguồn hoàn chỉnh của cả Backend (.NET 10) và Frontend (Angular 22)** thuộc phân hệ Rooms & Room Types:

```
code/
├── backend/
│   ├── src/
│   │   ├── HotelSaas.Domain/Entities/
│   │   │   ├── Room.cs                             <-- Thực thể Phòng vật lý
│   │   │   └── RoomType.cs                         <-- Thực thể Hạng phòng
│   │   ├── HotelSaas.Application/
│   │   │   ├── Rooms/
│   │   │   │   ├── Commands/                       <-- CreateRoom, UpdateRoom, DeleteRoom
│   │   │   │   ├── Queries/                        <-- GetRooms, GetRoomById (phân trang, lọc)
│   │   │   │   └── DTOs/                           <-- RoomDto
│   │   │   └── RoomTypes/
│   │   │       ├── Commands/                       <-- CreateRoomType, UpdateRoomType, DeleteRoomType
│   │   │       ├── Queries/                        <-- GetRoomTypes, GetRoomTypeById
│   │   │       └── DTOs/                           <-- RoomTypeDto, RoomTypeRateDto
│   │   └── HotelSaas.WebApi/Controllers/
│   │       ├── RoomsController.cs                  <-- API Endpoints cho Phòng
│   │       └── RoomTypesController.cs              <-- API Endpoints cho Hạng phòng
│   └── tests/
│       └── HotelSaas.Application.Tests/Rooms/      <-- Unit Tests kiểm thử tự động
│
└── frontend/
    └── src/app/
        ├── core/models/
        │   ├── room.model.ts                       <-- Interface DTO phòng
        │   └── room-type.model.ts                  <-- Interface DTO loại phòng
        ├── core/services/
        │   ├── room.service.ts                     <-- Service Angular gọi API Backend Phòng
        │   └── room-type.service.ts                <-- Service Angular gọi API Backend Loại phòng
        ├── core/utils/
        │   ├── rooms-validation.util.ts            <-- Tiện ích kiểm tra số phòng & tầng
        │   └── room-types-filter.util.ts           <-- Tiện ích lọc loại phòng theo giá
        └── features/
            ├── rooms/rooms.page.ts                 <-- Màn hình Quản lý Phòng
            └── room-types/room-types.page.ts       <-- Màn hình Quản lý Loại phòng
```

---

## 2. CÁC LỆNH GIT CHẠY TRÊN MÁY CỦA NGUYÊN (TẠO VẾT COMMIT)

Mở terminal (Git Bash hoặc VS Code Terminal) tại thư mục `hotel-saas-v2` trên máy của Nguyên:

### Bước 1: Đồng bộ nhánh develop mới nhất từ GitHub
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh tính năng riêng của Nguyên
```bash
git checkout -b feature/nguyen-rooms
```

### Bước 3: Đưa toàn bộ code vào dự án
Copy toàn bộ thư mục `backend/` và `frontend/` trong thư mục `code/` vào repo:
```bash
# Lệnh copy trong terminal:
cp -r team-handoff/nguyen-khoi-nguyen-24TX810011/code/backend/* backend/
cp -r team-handoff/nguyen-khoi-nguyen-24TX810011/code/frontend/* frontend/
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

### Bước 5: Commit với tài khoản GitHub của Nguyên
```bash
git add backend/src/HotelSaas.Application/Rooms/
git add backend/src/HotelSaas.Application/RoomTypes/
git add backend/src/HotelSaas.Domain/Entities/Room.cs
git add backend/src/HotelSaas.Domain/Entities/RoomType.cs
git add backend/src/HotelSaas.WebApi/Controllers/RoomsController.cs
git add backend/src/HotelSaas.WebApi/Controllers/RoomTypesController.cs
git add backend/tests/HotelSaas.Application.Tests/Rooms/
git add frontend/src/app/core/
git add frontend/src/app/features/rooms/
git add frontend/src/app/features/room-types/

git commit -m "feat(rooms): Nguyễn Khôi Nguyên - implement rooms and room-types catalog (Fullstack BE CQRS + FE Angular)"
```

### Bước 6: Đẩy nhánh tính năng lên GitHub
```bash
git push -u origin feature/nguyen-rooms
```

### Bước 7: Mở Pull Request trên giao diện GitHub
1. Mở trình duyệt vào link: [https://github.com/GinNgo/hotel-saas-v2/pulls](https://github.com/GinNgo/hotel-saas-v2/pulls)
2. Bấm nút xanh **New pull request**.
3. Chọn:
   - Base branch: `develop`
   - Compare branch: `feature/nguyen-rooms`
4. Tiêu đề PR: `feat(rooms): Nguyễn Khôi Nguyên (24TX810011) - Hoàn thiện module Rooms & Room Types (Fullstack)`
5. Bấm **Create pull request** và báo nhóm trưởng **Ngô Võ Tuấn An** để duyệt và merge.
