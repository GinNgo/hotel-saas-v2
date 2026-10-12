# HƯỚNG DẪN GIT PUSH & TẠO PULL REQUEST — TÂN
### MODULE: QUẢN LÝ BUỒNG PHÒNG (HOUSEKEEPING)

Chào Tân! Để trên GitHub hiện rõ **lịch sử commit và Pull Request mang tên tài khoản GitHub của Tân**, Tân làm theo các bước đơn giản sau:

---

## 1. CẤU TRÚC CODE CÓ SẴN TRONG THƯ MỤC NÀY
Trong thư mục `code/` ngay bên cạnh tệp này, đã có sẵn các file code được tổ chức **đúng 100% theo cây thư mục thật của project**:
```
code/
└── frontend/
    └── src/
        └── app/
            └── core/
                └── utils/
                    ├── housekeeping-concurrency.util.ts
                    └── housekeeping-kpi.util.ts
```

Tân chỉ cần copy thư mục `frontend/` trong `code/` thả đè vào thư mục gốc của project `hotel-saas-v2` là xong!

---

## 2. CÁC LỆNH GIT CHẠY TRÊN MÁY CỦA TÂN

Mở terminal (Git Bash hoặc VS Code Terminal) tại thư mục `hotel-saas-v2`:

### Bước 1: Đồng bộ nhánh develop mới nhất
```bash
git checkout develop
git pull origin develop
```

### Bước 2: Tạo nhánh tính năng riêng của Tân
```bash
git checkout -b feature/tan-housekeeping
```

### Bước 3: Đưa code vào dự án
Copy 2 file từ thư mục `docs/team/members/tan/code/frontend/...` vào `frontend/`:
```bash
# Lệnh copy tự động trong terminal:
cp docs/team/members/tan/code/frontend/src/app/core/utils/housekeeping-concurrency.util.ts frontend/src/app/core/utils/
cp docs/team/members/tan/code/frontend/src/app/core/utils/housekeeping-kpi.util.ts frontend/src/app/core/utils/
```

### Bước 4: Kiểm tra build Frontend
```bash
cd frontend
npm run build
cd ..
```
*(Đảm bảo terminal báo thành công, không có lỗi TypeScript!)*

### Bước 5: Commit với tài khoản GitHub của Tân
```bash
git add frontend/src/app/core/utils/housekeeping-concurrency.util.ts frontend/src/app/core/utils/housekeeping-kpi.util.ts
git commit -m "feat(housekeeping): implement concurrency retry handling and KPI metric calculation"
```

### Bước 6: Đẩy nhánh lên GitHub
```bash
git push -u origin feature/tan-housekeeping
```

---

## 3. TẠO PULL REQUEST (PR) TRÊN GITHUB
1. Truy cập: [https://github.com/GinNgo/hotel-saas-v2](https://github.com/GinNgo/hotel-saas-v2)
2. Bấm vào nút xanh **"Compare & pull request"** màu vàng vừa hiện lên.
3. Kiểm tra: **base:** `develop` $\leftarrow$ **compare:** `feature/tan-housekeeping`.
4. Tiêu đề: `feat(housekeeping): Xử lý xung đột 409 và tính toán chỉ số KPI buồng phòng - Tân`
5. Bấm **"Create pull request"**.
6. Báo Tuấn Anh duyệt và merge là hoàn tất!
