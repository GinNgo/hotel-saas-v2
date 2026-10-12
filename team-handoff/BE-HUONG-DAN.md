# Backend đã bổ sung

Mỗi gói `nguyen/files/` và `tan/files/` có đường dẫn giống root repo. Ví dụ `files/backend/src/HotelSaas.Domain/Entities/Room.cs` đặt vào `backend/src/HotelSaas.Domain/Entities/Room.cs`. Pull và so sánh từng file trước sửa, không copy đè bản mới.

Nguyên: Application Rooms/RoomTypes, controllers Rooms/RoomTypes, Domain Room/RoomType/RoomStatus, EF configurations Room/RoomType và tests Rooms. Rates/rate history chỉ tham khảo, không thuộc scope sửa.

Tân: Domain HousekeepingTask/enums và luồng UpdateRoomStatus hiện hữu, RoomsController/request, RoomDto, transition validator và tests liên quan. Source hiện không có HousekeepingController/Application Housekeeping riêng; UI dùng Rooms. Thư mục Housekeeping trống chỉ dành trước, không phải phê duyệt API mới.

File RoomsController/RoomStatus/RoomDto/UpdateRoomStatus dùng chung: phối hợp Nguyên/Tân trước sửa. Gói là baseline tham khảo FE+BE, không mở rộng task UI được giao thành sửa nghiệp vụ backend. DbContext/DI/migrations/auth và project files dùng repo đầy đủ, không copy đè hoặc chạy DB/migration.

Hướng dẫn này bổ sung và thay phần README cũ nói chưa đóng gói backend. Không nhận baseline là đóng góp cá nhân; commit chỉ thay đổi thực tế sau kiểm tra. Chưa build/test/commit/push gói này.
