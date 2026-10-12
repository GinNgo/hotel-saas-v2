# NHIỆM VỤ & HƯỚNG DẪN CÔNG VIỆC — TUẤN ANH (LEADER)
### VAI TRÒ: KIẾN TRÚC SƯ HỆ THỐNG & BACKEND LEAD

Chào Tuấn Anh! Đây là bản tổng hợp nhiệm vụ và các việc cần làm trong Tuần 2 để điều phối nhóm:

---

## 1. CÔNG VIỆC CẦN LÀM TRONG TUẦN 2
1. **Hoàn thiện Pricing Engine (Phase 1B - P2):**
   - Viết `PricingCalculator` tính tiền phòng theo giờ (giờ đầu + phụ thu làm tròn 60 phút) và theo đêm (12:00 hôm trước đến 12:00 hôm sau).
   - Viết API Chính sách chi nhánh: `GET/PUT /api/properties/{id}/policies`.
   - Viết API Bảng giá loại phòng: `GET/POST /api/room-types/{id}/rates`.
   - Viết Unit Tests tự động kiểm tra logic tính giá.
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
     Lúc này lịch sử git cục bộ của Tuấn Anh sẽ có đủ toàn bộ commit của Nguyên, Tân và merge commits!

---

## 2. NỘP BÁO CÁO TUẦN 1 CHO GVHD
- Sử dụng file báo cáo có sẵn trong thư mục này: [`BAO-CAO-TUAN-1-TUAN-ANH.md`](file:///C:/Dev/hotel-saas-v2/docs/team/members/tuan-anh/BAO-CAO-TUAN-1-TUAN-ANH.md).
- Điền MSSV của bạn vào mục thông tin đầu trang.
- Copy toàn bộ nội dung nộp lên hệ thống [projects-fit.hcmute.edu.vn](https://projects-fit.hcmute.edu.vn/?view=student-mytopic&topic=578) (Topic 578).
