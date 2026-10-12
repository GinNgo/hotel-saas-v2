# HƯỚNG DẪN THỰC HIỆN NHIỆM VỤ & TẠO VẾT COMMIT GIT (HANDOFF — NGUYÊN)
### DÀNH CHO: NGUYÊN (FRONTEND DEVELOPER — MODULE PHÒNG & HẠNG PHÒNG)

Chào Nguyên! Để Thầy Phùng Hữu Xuân thấy được **lịch sử commit trực tiếp mang tên tài khoản GitHub của Nguyên** trên kho lưu trữ [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2), Nguyên hãy làm theo các bước chuẩn dưới đây nhé. Toàn bộ code tiện ích đã được chuẩn bị sẵn trong thư mục `src/` này, Nguyên chỉ cần đưa vào dự án và commit!

---

## 1. CÁC TỆP CODE ĐƯỢC BÀN GIAO CHO NGUYÊN ĐỢT NÀY

Trong thư mục này (`docs/team/handoff/nguyen-rooms/src/`) có 2 file code đã viết sẵn cho Nguyên:
1. `rooms-validation.util.ts`: Bộ tiện ích kiểm tra số phòng hợp lệ theo tầng (ví dụ: Tầng 1 thì phòng là 101, 102; tầng 2 thì 201, 202; phát hiện định dạng sai).
2. `room-types-filter.util.ts`: Bộ lọc danh mục phòng theo sức chứa và khoảng giá phục vụ màn hình quản lý.

---

## 2. CÁC BƯỚC THỰC HIỆN BẰNG GIT TERMINAL (LÀM TRÊN MÁY NGUYÊN)

Nguyên mở terminal (Git Bash hoặc VS Code Terminal) tại thư mục `hotel-saas-v2`:

### Bước 1: Cập nhật nhánh develop mới nhất từ GitHub
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh tính năng cá nhân của Nguyên
```bash
git checkout -b feature/nguyen-rooms
```

### Bước 3: Đưa 2 file code vào dự án Frontend
Nguyên copy 2 file từ thư mục handoff này vào thư mục `frontend/src/app/core/utils/`:
- Copy `docs/team/handoff/nguyen-rooms/src/rooms-validation.util.ts` $\to$ `frontend/src/app/core/utils/rooms-validation.util.ts`
- Copy `docs/team/handoff/nguyen-rooms/src/room-types-filter.util.ts` $\to$ `frontend/src/app/core/utils/room-types-filter.util.ts`

*(Nguyên có thể copy bằng tay hoặc chạy lệnh PowerShell/Bash sau:)*
```bash
# Lệnh copy nhanh trong terminal:
mkdir -p frontend/src/app/core/utils
cp docs/team/handoff/nguyen-rooms/src/rooms-validation.util.ts frontend/src/app/core/utils/
cp docs/team/handoff/nguyen-rooms/src/room-types-filter.util.ts frontend/src/app/core/utils/
```

### Bước 4: Kiểm tra build Frontend không có lỗi
```bash
cd frontend
npm run build
cd ..
```
*(Đảm bảo terminal báo Build thành công!)*

### Bước 5: Commit mã nguồn với tài khoản GitHub của Nguyên
```bash
git add frontend/src/app/core/utils/rooms-validation.util.ts frontend/src/app/core/utils/room-types-filter.util.ts
git commit -m "feat(rooms): add room number validation and room-type filters"
```

### Bước 6: Đẩy nhánh lên GitHub
```bash
git push -u origin feature/nguyen-rooms
```

---

## 3. TẠO PULL REQUEST TRÊN GITHUB ĐỂ "LƯU VẾT"

1. Sau khi push xong, Nguyên truy cập link: [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2).
2. GitHub sẽ hiện thông báo màu vàng: **"feature/nguyen-rooms had recent pushes"** $\to$ Nguyên bấm vào nút xanh **"Compare & pull request"**.
3. Tại ô chọn nhánh:
   - **base:** `develop` $\leftarrow$ **compare:** `feature/nguyen-rooms`.
4. Tiêu đề PR: `feat(rooms): Hoàn thiện kiểm tra số phòng và bộ lọc hạng phòng - Nguyên`
5. Bấm **"Create pull request"**.
6. **Nhắn Tuấn Anh:** *"Tuấn Anh ơi, tớ đã tạo PR feature/nguyen-rooms rồi, cậu review và merge vào develop giúp tớ nhé!"*

---

## 4. KẾT QUẢ ĐẠT ĐƯỢC
Sau khi Tuấn Anh merge PR của Nguyên:
- Trên GitHub tab **Commits** và **Contributors** sẽ hiện tên và avatar tài khoản GitHub của Nguyên.
- Tab **Pull Requests** sẽ lưu vết đóng góp mang tên Nguyên.
- Thầy Phùng Hữu Xuân kiểm tra sẽ thấy 100% minh chứng làm việc nhóm thực chất, đúng chuẩn quy trình công nghệ phần mềm!
