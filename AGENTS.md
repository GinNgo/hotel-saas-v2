# Hướng Dẫn Quy Chuẩn Phát Triển & Vận Hành Agent (AGENTS.md)

Tài liệu này xác lập các quy chuẩn, công cụ hỗ trợ và ranh giới thực thi dành cho AI Agent trong dự án **Hotel SaaS Platform**.

---

## 1. Quy Chuẩn Tạo Hình Ảnh Thực Tế & Chuẩn Đẹp (Image Generation Standard)

> **Yêu cầu từ Người dùng:** Khi cần sinh hình ảnh đồ họa, giao diện, phòng khách sạn, banner hoặc tư liệu trực quan cho hệ thống, bắt buộc sử dụng Local AI Endpoint chuyên dụng dưới đây để đảm bảo chất lượng chân thực, chuẩn nét và đồng bộ thẩm mỹ.

### 1.1. Thông số Kỹ thuật API
- **Endpoint:** `http://localhost:20128/v1/images/generations`
- **Method:** `POST`
- **Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer sk-b3a81036624ac7f5-l0yjhu-6d5d0d22`
- **Model:** `ag/gemini-3.1-flash-image`

### 1.2. Cấu trúc Payload chuẩn
```json
{
  "model": "ag/gemini-3.1-flash-image",
  "prompt": "<Mô tả chi tiết bằng tiếng Anh hoặc tiếng Việt, phong cách tả thực (photorealistic), ánh sáng tự nhiên, góc chụp kiến trúc/nội thất chuyên nghiệp>",
  "n": 1,
  "size": "auto",
  "quality": "auto",
  "background": "auto",
  "image_detail": "high",
  "output_format": "png"
}
```

### 1.3. Cú pháp gọi nhanh (PowerShell / cURL)

#### Cách 1: PowerShell Script (Tự động lưu file từ Base64)
```powershell
$body = @{
    model = "ag/gemini-3.1-flash-image"
    prompt = "Luxury 5-star hotel presidential suite with panoramic ocean view at sunset, modern minimalist decor, warm ambient lighting, 8k resolution, photorealistic"
    n = 1
    size = "auto"
    quality = "auto"
    background = "auto"
    image_detail = "high"
    output_format = "png"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer sk-b3a81036624ac7f5-l0yjhu-6d5d0d22"
}

$response = Invoke-RestMethod -Uri "http://localhost:20128/v1/images/generations" -Method Post -Headers $headers -Body $body
$bytes = [Convert]::FromBase64String($response.data[0].b64_json)
[IO.File]::WriteAllBytes("output_image.png", $bytes)
```

#### Cách 2: cURL
```bash
curl -X POST http://localhost:20128/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-b3a81036624ac7f5-l0yjhu-6d5d0d22" \
  -d '{"model":"ag/gemini-3.1-flash-image","prompt":"Luxury hotel presidential suite with ocean view","n":1,"size":"auto","quality":"auto","background":"auto","image_detail":"high","output_format":"png"}'
```

---

## 2. Ranh giới Triển khai Phân kỳ (Implementation Phases & Boundaries)

- **Nguyên tắc phân kỳ:** Luôn triển khai theo từng giai đoạn được phê duyệt (P1A $\rightarrow$ P1B-01A $\rightarrow$ P1B-01B $\rightarrow$ P1B-02...). Tuyệt đối không tự ý làm gộp hoặc nhảy cóc.
- **Bảo toàn cơ sở dữ liệu:** Không chạy migration hoặc sửa schema trên database đang phát triển (`hotel_saas_dev`) hoặc production.
- **Fail-closed:** Mọi thao tác thiếu ngữ cảnh Tenant/Property đều phải fail-closed.
