# Prompt: Frontend Foundation Sprint — Hotel SaaS Platform (Angular 22)

## Bạn là Angular Frontend Developer. Nhiệm vụ của bạn là tạo bộ nền tảng chung cho toàn bộ ứng dụng Angular sử dụng thư viện PrimeNG và Tailwind CSS trước khi implement bất kỳ trang chức năng nào.

---

## 1. PROJECT CONTEXT & RULES

- **Angular 22**, TypeScript 6.0, RxJS 7.8, Standalone components (Không dùng NgModules).
- **UI Stack:** PrimeNG (cho component phức tạp như Table, Calendar, Toast) + Tailwind CSS (cho layout, spacing, typography).
- Backend API: .NET chạy tại `http://localhost:5000`
- **Quy tắc:** Tất cả comment, thông báo (toast), và text trên giao diện phải dùng Tiếng Việt.

---

## BƯỚC 0: Cài đặt Dependencies & Tailwind CSS

Chạy các lệnh sau trong thư mục `C:\Dev\hotel-saas-v2\frontend`:

```bash
npm install primeng primeicons jwt-decode
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

---

## BƯỚC 1: Cấu hình Tailwind CSS & Styles

### 1a. File: `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#10b981', // Emerald 500
        secondary: '#64748b', // Slate 500
      }
    },
  },
  plugins: [],
}
```

### 1b. File: `src/styles.css`
Xóa hết code cũ, thay bằng:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* PrimeNG Theme (Dùng giao diện Aura sáng sủa) */
@import "primeng/resources/themes/aura-light-emerald/theme.css";
@import "primeng/resources/primeng.css";
@import "primeicons/primeicons.css";

body {
  margin: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  background-color: #f8fafc; /* Slate 50 */
  color: #0f172a; /* Slate 900 */
}
```

### 1c. File `angular.json`
Đảm bảo mảng `styles` có chứa `src/styles.css`.

---

## BƯỚC 2: Core Models (Khớp 1:1 với Backend)

Tạo thư mục `src/app/core/models/` và tạo các file sau:

### File: `api-response.model.ts`
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode: string | null;
  errors: Record<string, string[]> | null;
  timestamp: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
```

### File: `auth.model.ts`
```typescript
export interface LoginResponse { accessToken: string; refreshToken: string; expiresAtUtc: string; user: UserDto; }
export interface RegisterResponse { userId: string; message: string; }
export interface UserDto { id: string; email: string; fullName: string; globalRole: string; tenantId: string | null; }
export interface LoginRequest { email: string; password: string; }
export interface RegisterRequest { email: string; password: string; fullName: string; }
export interface RefreshTokenRequest { accessToken: string; refreshToken: string; }
```

---

## BƯỚC 3: Core Services (Xử lý Token & API)

Tạo thư mục `src/app/core/services/` và tạo các file:

### File: `token-storage.service.ts`
*(Yêu cầu bạn tự code Service này: Có các hàm `getAccessToken()`, `getRefreshToken()`, `setTokens()`, `clearTokens()`, `isTokenExpired()`, và `getDecodedToken()` dùng thư viện `jwt-decode`)*.

### File: `notification.service.ts` (Wrapper cho PrimeNG MessageService)
```typescript
import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly messageService = inject(MessageService);

  success(detail: string, summary: string = 'Thành công'): void {
    this.messageService.add({ severity: 'success', summary, detail, life: 3000 });
  }

  error(detail: string, summary: string = 'Lỗi'): void {
    this.messageService.add({ severity: 'error', summary, detail, life: 5000 });
  }

  warning(detail: string, summary: string = 'Cảnh báo'): void {
    this.messageService.add({ severity: 'warn', summary, detail, life: 4000 });
  }
}
```

### File: `auth.service.ts`
*(Yêu cầu bạn tự code Service này: gọi các API login, register, refresh-token. Lấy apiUrl từ `environment.ts`. Khi login thành công thì lưu token vào `TokenStorageService`)*.

---

## BƯỚC 4: Interceptors & Guards

Tạo thư mục `src/app/core/interceptors/` và `src/app/core/guards/`:

### File: `auth.interceptor.ts`
*(Tự động đọc accessToken từ TokenStorageService và gắn vào Header `Authorization: Bearer <token>`)*.

### File: `error.interceptor.ts`
*(Bắt lỗi HTTP: 401 -> thử refresh token, 403 -> báo lỗi NotificationService và về /forbidden, 404/409/500 -> hiển thị NotificationService đọc message hoặc errorCode từ ApiResponse)*.

### File: `auth.guard.ts`
*(Check nếu chưa có token hoặc token hết hạn -> đá về trang /login)*.

---

## BƯỚC 5: Cấu hình App & Root Component

### File: `src/app/app.config.ts`
```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    MessageService,
    ConfirmationService
  ]
};
```

### File: `src/app/app.ts` (Nơi đặt Toast và ConfirmDialog dùng chung)
```typescript
import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastModule, ConfirmDialogModule],
  template: `
    <p-toast position="top-right"></p-toast>
    <p-confirmDialog header="Xác nhận" icon="pi pi-exclamation-triangle"></p-confirmDialog>
    <router-outlet></router-outlet>
  `
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  ngOnInit(): void { this.authService.initializeUser(); }
}
```

---

## BƯỚC 6: Xây dựng Layout Admin bằng Tailwind CSS

### File: `src/app/layouts/admin-layout/admin-layout.ts`
*(Xây dựng một layout với Sidebar bên trái và Topbar bên trên. Sử dụng thuần Tailwind CSS grid/flex để làm layout. 
- Sidebar có màu nền tối (bg-slate-900).
- Content ở giữa có `<router-outlet>`.
- Topbar có nền trắng (bg-white).*

---

## BƯỚC 7: Placeholder Pages

Tạo các file cấu trúc rỗng (dùng thẻ HTML thường kết hợp PrimeNG components như `<p-card>`, `<p-button>`, `<input pInputText>`):
1. `src/app/features/auth/login/login.page.ts` (Giao diện login với Tailwind căn giữa màn hình)
2. `src/app/features/dashboard/dashboard.page.ts` (Grid 4 thẻ thông số giả bằng Tailwind)

Cấu hình `src/app/app.routes.ts` trỏ tới các trang này.

---

## HOÀN TẤT
1. Chạy lệnh: `npx ng build`
2. Đảm bảo build thành công, không có lỗi.
3. Báo cáo lại các file đã tạo.
