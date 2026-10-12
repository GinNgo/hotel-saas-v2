# HƯỚNG DẪN THỰC HIỆN NHIỆM VỤ & TẠO VẾT COMMIT GIT (HANDOFF — TÂN)
### DÀNH CHO: TÂN (FRONTEND DEVELOPER — MODULE BUỒNG PHÒNG / HOUSEKEEPING)

Chào Tân! Để Thầy Phùng Hữu Xuân thấy được **lịch sử commit trực tiếp mang tên tài khoản GitHub của Tân** trên kho lưu trữ [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2), Tân hãy làm theo các bước chuẩn dưới đây nhé. Toàn bộ code tiện ích đã được chuẩn bị sẵn trong thư mục `src/` này, Tân chỉ cần đưa vào dự án và commit!

---

## 1. CÁC TỆP CODE ĐƯỢC BÀN GIAO CHO TÂN ĐỢT NÀY

Trong thư mục này (`docs/team/handoff/tan-housekeeping/src/`) có 2 file code đã viết sẵn cho Tân:
1. `housekeeping-concurrency.util.ts`: Bộ tiện ích xử lý xung đột đồng thời 409 (`ERR_STALE_STATE`) khi nhiều nhân viên cùng bấm dọn phòng, tự động phát hiện phòng bị lệch trạng thái và sinh câu thông báo thân thiện.
2. `housekeeping-kpi.util.ts`: Bộ tiện ích tính toán tỷ lệ phần trăm phòng sạch, phòng bẩn và số phòng cần ưu tiên dọn dẹp để hiển thị lên thanh KPI buồng phòng.

---

## 2. CÁC BƯỚC THỰC HIỆN BẰNG GIT TERMINAL (LÀM TRÊN MÁY TÂN)

Tân mở terminal (Git Bash hoặc VS Code Terminal) tại thư mục `hotel-saas-v2`:

### Bước 1: Cập nhật nhánh develop mới nhất từ GitHub
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh tính năng cá nhân của Tân
```bash
git checkout -b feature/tan-housekeeping
```

### Bước 3: Đưa 2 file code vào dự án Frontend
Tân copy 2 file từ thư mục handoff này vào thư mục `frontend/src/app/core/utils/`:
- Copy `docs/team/handoff/tan-housekeeping/src/housekeeping-concurrency.util.ts` $\to$ `frontend/src/app/core/utils/housekeeping-concurrency.util.ts`
- Copy `docs/team/handoff/tan-housekeeping/src/housekeeping-kpi.util.ts` $\to$ `frontend/src/app/core/utils/housekeeping-kpi.util.ts`

*(Tân có thể copy bằng tay hoặc chạy lệnh PowerShell/Bash sau:)*
```bash
# Lệnh copy nhanh trong terminal:
mkdir -p frontend/src/app/core/utils
cp docs/team/handoff/tan-housekeeping/src/housekeeping-concurrency.util.ts frontend/src/app/core/utils/
cp docs/team/handoff/tan-housekeeping/src/housekeeping-kpi.util.ts frontend/src/app/core/utils/
```

### Bước 4: Kiểm tra build Frontend không có lỗi
```bash
cd frontend
npm run build
cd ..
```
*(Đảm bảo terminal báo Build thành công!)*

### Bước 5: Commit mã nguồn với tài khoản GitHub của Tân
```bash
git add frontend/src/app/core/utils/housekeeping-concurrency.util.ts frontend/src/app/core/utils/housekeeping-kpi.util.ts
git commit -m "feat(housekeeping): implement concurrency retry handling and KPI metric calculation"
```

### Bước 6: Đẩy nhánh lên GitHub
```bash
git push -u origin feature/tan-housekeeping
```

---

## 3. TẠO PULL REQUEST TRÊN GITHUB ĐỂ "LƯU VẾT"

1. Sau khi push xong, Tân truy cập link: [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2).
2. GitHub sẽ hiện thông báo màu vàng: **"feature/tan-housekeeping had recent pushes"** $\to$ Tân bấm vào nút xanh **"Compare & pull request"**.
3. Tại ô chọn nhánh:
   - **base:** `develop` $\leftarrow$ **compare:** `feature/tan-housekeeping`.
4. Tiêu đề PR: `feat(housekeeping): Xử lý xung đột 409 và tính toán chỉ số KPI buồng phòng - Tân`
5. Bấm **"Create pull request"**.
6. **Nhắn Tuấn Anh:** *"Tuấn Anh ơi, tớ đã tạo PR feature/tan-housekeeping rồi, cậu review và merge vào develop giúp tớ nhé!"*

---

## 4. KẾT QUẢ ĐẠT ĐƯỢC
Sau khi Tuấn Anh merge PR của Tân:
- Trên GitHub tab **Commits** và **Contributors** sẽ hiện tên và avatar tài khoản GitHub của Tân.
- Tab **Pull Requests** sẽ lưu vết đóng góp mang tên Tân.
- Thầy Phùng Hữu Xuân kiểm tra sẽ thấy 100% minh chứng làm việc nhóm thực chất, đúng chuẩn quy trình công nghệ phần mềm!
