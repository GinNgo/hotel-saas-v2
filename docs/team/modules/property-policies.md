# ⚙️ Hướng Dẫn Nghiệp Vụ: Chính Sách Vận Hành Chi Nhánh (Property Policies Module)
> **Mã task:** `CAT-PROP-01` | **Đường dẫn đề xuất:** `/settings/property-policies`  
> **Kỹ sư phụ trách:** **Nguyên** (Full-Stack) | **Reviewer:** **Tân** (Full-Stack) | **Trạng thái:** **`Ready`**

---

## 1. MỤC ĐÍCH & PHÂN QUYỀN
- **Mục đích:** Cấu hình thời gian check-in chuẩn, check-out chuẩn, thời gian đệm dọn phòng (`TurnoverBufferMinutes`) và các mức phụ thu nhận phòng sớm / trả phòng trễ cho từng chi nhánh.
- **Đối tượng sử dụng:**
  - **Property Manager / Owner:** Được phép xem và sửa chính sách chi nhánh.
  - **Lễ tân / Kế toán:** Xem chính sách để giải thích hóa đơn phụ thu cho khách.
- **Phân quyền RBAC:**
  - Xem: `PROPERTIES:Read`
  - Sửa: `PROPERTIES:Update`

---

## 2. TRƯỜNG DỮ LIỆU & RÀNG BUỘC NGHIỆP VỤ

| Trường dữ liệu | Bắt buộc | Ràng buộc | Ý nghĩa |
| :--- | :---: | :--- | :--- |
| `StandardCheckInTime` | **Có** | Định dạng `HH:mm` (mặc định 14:00) | Giờ nhận phòng tiêu chuẩn |
| `StandardCheckOutTime` | **Có** | Định dạng `HH:mm` (mặc định 12:00) | Giờ trả phòng tiêu chuẩn |
| `TurnoverBufferMinutes` | **Có** | Số nguyên từ 15 đến 240 phút (mặc định 60 phút) | Thời gian dọn dẹp và chuẩn bị phòng giữa 2 lượt khách |
| `EarlyCheckInSurcharges` | Không | Mảng các khung giờ và mức phí phụ thu | Bảng phụ thu nhận phòng sớm |
| `LateCheckOutSurcharges` | Không | Mảng các khung giờ và mức phí phụ thu | Bảng phụ thu trả phòng trễ |

**Quy tắc nghiệp vụ cốt lõi:**
- Thời gian check-in phải cách thời gian check-out tối thiểu một khoảng bằng `TurnoverBufferMinutes` (ví dụ check-out 12:00, đệm 60 phút thì check-in sớm nhất là 13:00).
- Mức phụ thu phải $\ge 0$.

---

## 3. HỢP ĐỒNG API THỰC TẾ
- **Lấy chính sách chi nhánh:**
  ```http
  GET /api/properties/{id}/policies HTTP/1.1
  Authorization: Bearer <token>
  ```
  **Response 200 OK:**
  ```json
  {
    "success": true,
    "data": {
      "propertyId": "22222222-2222-2222-2222-222222222221",
      "standardCheckInTime": "14:00",
      "standardCheckOutTime": "12:00",
      "turnoverBufferMinutes": 60,
      "earlyCheckInSurcharges": [
        { "fromTime": "06:00", "toTime": "09:00", "surchargeRate": 0.5 },
        { "fromTime": "09:00", "toTime": "14:00", "surchargeRate": 0.3 }
      ],
      "lateCheckOutSurcharges": [
        { "fromTime": "12:00", "toTime": "15:00", "surchargeRate": 0.3 },
        { "fromTime": "15:00", "toTime": "18:00", "surchargeRate": 0.5 }
      ]
    }
  }
  ```
- **Cập nhật chính sách:**
  ```http
  PUT /api/properties/{id}/policies HTTP/1.1
  Content-Type: application/json
  Authorization: Bearer <token>
  ```

---

## 4. CHECKLIST TRIỂN KHAI CHO NGUYÊN (DEFINITION OF DONE)
- [ ] Giao diện form cấu hình trực quan, chia tab hoặc block rõ ràng.
- [ ] Bảng thêm/xóa khung phụ thu nhận sớm và trả muộn động.
- [ ] Tích hợp `AlertService` cho hộp thoại xác nhận lưu và toast thông báo.
- [ ] Validate giờ check-in và check-out chặt chẽ trên form trước khi gửi API.
- [ ] 100% test pass.
