import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-guest-profile-page', standalone: true, imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <h1 class="text-3xl font-bold text-slate-900">Tài khoản của bạn</h1>
      @if (!user()) {
        <section class="bg-white rounded-2xl p-8 border border-slate-200 space-y-4">
          <h2 class="text-xl font-semibold">Đăng nhập để xem tài khoản</h2>
          <p class="text-slate-600">Bạn vẫn có thể tìm chỗ nghỉ hoặc tra cứu đặt phòng bằng mã mà không cần đăng nhập.</p>
          <a routerLink="/auth/login" [queryParams]="{ portal: 'guest', returnUrl: '/booking/profile' }" class="inline-flex min-h-11 items-center px-5 rounded-xl bg-indigo-600 text-white">Đăng nhập khách hàng</a>
          <a routerLink="/booking/lookup" class="inline-flex min-h-11 items-center px-5 text-indigo-700">Tra cứu đặt phòng</a>
        </section>
      } @else if (!isGuest()) {
        <section class="p-8 bg-white rounded-2xl border border-slate-200 space-y-4">
          <p>Bạn đang dùng tài khoản quản lý. Hồ sơ lưu trú không dùng dữ liệu vận hành khách sạn.</p>
          <a routerLink="/dashboard" class="inline-flex min-h-11 items-center text-indigo-700">Về cổng quản lý</a>
          <button type="button" (click)="logout()" class="min-h-11 px-5 border rounded-xl">Đăng xuất</button>
        </section>
      } @else {
        <section class="bg-indigo-50 rounded-2xl p-6 sm:p-8 flex flex-wrap justify-between gap-6 items-center">
          <div><h2 class="text-2xl font-semibold">{{ user()?.fullName }}</h2><p class="text-slate-700 mt-2">{{ user()?.email }}</p></div>
          <button type="button" (click)="logout()" class="min-h-11 px-5 bg-white border border-slate-300 rounded-xl">Đăng xuất</button>
        </section>
        <nav aria-label="Các mục tài khoản" class="flex flex-wrap gap-2">
          @for (tab of tabs; track tab.id) {
            <button type="button" (click)="activeTab.set(tab.id)" [attr.aria-current]="activeTab() === tab.id ? 'page' : null"
              [class.bg-indigo-600]="activeTab() === tab.id" [class.text-white]="activeTab() === tab.id"
              class="min-h-11 px-4 rounded-xl border border-slate-300 font-medium">{{ tab.label }}</button>
          }
        </nav>
        <section class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
          @switch (activeTab()) {
            @case ('account') {
              <h2 class="text-xl font-semibold">Thông tin tài khoản</h2>
              <dl class="grid sm:grid-cols-2 gap-4"><div><dt class="text-sm text-slate-600">Họ tên</dt><dd class="mt-1 font-medium">{{ user()?.fullName }}</dd></div><div class="min-w-0"><dt class="text-sm text-slate-600">Email</dt><dd class="mt-1 break-words">{{ user()?.email }}</dd></div></dl>
              <p class="text-sm text-slate-600">Chỉnh sửa hồ sơ sẽ được mở khi API tài khoản khách sẵn sàng. Thông tin này lấy từ phiên đăng nhập, không phải dữ liệu mẫu.</p>
            }
            @case ('bookings') {
              <h2 class="text-xl font-semibold">Đặt phòng và hóa đơn</h2>
              <p>Lịch sử tự động theo tài khoản chưa được kết nối. Không hiển thị dữ liệu mẫu thay cho đơn đặt phòng của bạn.</p>
              <a routerLink="/booking/lookup" class="inline-flex min-h-11 items-center px-5 bg-indigo-600 text-white rounded-xl">Tra cứu bằng mã đặt phòng</a>
            }
            @case ('loyalty') {
              <h2 class="text-xl font-semibold">Hội viên và điểm thưởng</h2>
              <p>Chưa có kết nối dữ liệu hội viên theo tài khoản. Không tự cộng điểm hay đăng ký hội viên trên trình duyệt.</p>
            }
          }
        </section>
        <a routerLink="/booking" class="inline-flex min-h-11 items-center text-indigo-700">Tiếp tục khám phá chỗ nghỉ →</a>
      }
    </main>
  `,
})
export class GuestProfilePageComponent {
  private readonly auth = inject(AuthService);
  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  readonly isGuest = computed(() => ['Customer', 'Guest'].includes(this.user()?.globalRole ?? ''));
  readonly activeTab = signal('account');
  readonly tabs = [{ id: 'account', label: 'Thông tin cá nhân' }, { id: 'bookings', label: 'Đặt phòng và hóa đơn' }, { id: 'loyalty', label: 'Hội viên' }];
  logout(): void { this.activeTab.set('account'); this.auth.logout(); }
}

