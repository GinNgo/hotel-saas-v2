import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { GuestAccountService } from '../../../core/services/guest-account.service';
import { AlertService } from '../../../core/services/alert.service';
import {
  GuestMeDto,
  GuestBookingSummaryDto,
} from '../../../core/models/guest-account.model';

@Component({
  selector: 'app-guest-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <h1 class="text-3xl font-bold text-slate-900">Tài khoản của bạn</h1>

      @if (!user()) {
        <section class="bg-white rounded-2xl p-8 border border-slate-200 space-y-4">
          <h2 class="text-xl font-semibold">Đăng nhập để xem tài khoản</h2>
          <p class="text-slate-600">
            Bạn vẫn có thể tìm chỗ nghỉ hoặc tra cứu đặt phòng bằng mã mà không cần đăng nhập.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              routerLink="/auth/login"
              [queryParams]="{ portal: 'guest', returnUrl: '/booking/profile' }"
              class="inline-flex min-h-11 items-center px-5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
            >
              Đăng nhập khách hàng
            </a>
            <a
              routerLink="/booking/lookup"
              class="inline-flex min-h-11 items-center px-5 text-indigo-700 font-medium hover:underline"
            >
              Tra cứu đặt phòng
            </a>
          </div>
        </section>
      } @else if (!isGuest()) {
        <section class="p-8 bg-white rounded-2xl border border-slate-200 space-y-4">
          <p class="text-slate-700">
            Bạn đang dùng tài khoản quản lý. Hồ sơ lưu trú không dùng dữ liệu vận hành khách sạn.
          </p>
          <div class="flex flex-wrap gap-3">
            <a
              routerLink="/dashboard"
              class="inline-flex min-h-11 items-center px-5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Về cổng quản lý
            </a>
            <button
              type="button"
              (click)="logout()"
              class="min-h-11 px-5 border border-slate-300 rounded-xl hover:bg-slate-50 font-medium cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </section>
      } @else {
        <!-- BANNER TỔNG QUAN TÀI KHOẢN -->
        <section
          class="bg-indigo-50 rounded-2xl p-6 sm:p-8 flex flex-wrap justify-between gap-6 items-center border border-indigo-100"
        >
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-bold text-slate-900">
                {{ currentFullName() || user()?.fullName }}
              </h2>
              @if (isEmailVerified()) {
                <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  <i class="pi pi-verified text-[11px]"></i> Đã xác thực
                </span>
              }
            </div>
            <p class="text-slate-600 mt-1 flex items-center gap-2">
              <span>{{ user()?.email }}</span>
              @if (phoneNumber()) {
                <span>• {{ phoneNumber() }}</span>
              }
            </p>
          </div>
          <button
            type="button"
            (click)="logout()"
            class="min-h-11 px-5 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 font-medium transition-colors cursor-pointer"
          >
            Đăng xuất
          </button>
        </section>

        <!-- NAVIGATION TABS -->
        <nav aria-label="Các mục tài khoản" class="flex flex-wrap gap-2">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              (click)="selectTab(tab.id)"
              [attr.aria-current]="activeTab() === tab.id ? 'page' : null"
              [class.bg-indigo-600]="activeTab() === tab.id"
              [class.text-white]="activeTab() === tab.id"
              [class.bg-white]="activeTab() !== tab.id"
              [class.text-slate-700]="activeTab() !== tab.id"
              class="min-h-11 px-5 rounded-xl border border-slate-300 font-medium transition-all cursor-pointer hover:border-indigo-400"
            >
              {{ tab.label }}
            </button>
          }
        </nav>

        <!-- NỘI DUNG TỪNG TAB -->
        <section class="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          @switch (activeTab()) {
            @case ('account') {
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 class="text-xl font-bold text-slate-900">Thông tin cá nhân</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Dữ liệu được xác thực trực tiếp theo tài khoản phiên đăng nhập</p>
                </div>
                @if (!isEditing()) {
                  <button
                    type="button"
                    (click)="startEditing()"
                    class="px-4 py-2 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
                  >
                    Chỉnh sửa họ tên
                  </button>
                }
              </div>

              @if (isEditing()) {
                <!-- FORM CHỈNH SỬA HỌ TÊN -->
                <form (ngSubmit)="saveProfile()" class="max-w-md space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Họ và tên mới
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="editFullName"
                      name="fullName"
                      required
                      minlength="2"
                      maxlength="100"
                      class="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                      placeholder="Nhập họ và tên..."
                    />
                    <p class="text-[11px] text-slate-500 mt-1">
                      Email và Số điện thoại được bảo vệ và không thể thay đổi tại màn hình này.
                    </p>
                  </div>

                  <div class="flex items-center gap-2 pt-2">
                    <button
                      type="submit"
                      [disabled]="isSaving() || !editFullName.trim()"
                      class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                    >
                      {{ isSaving() ? 'Đang lưu...' : 'Lưu thay đổi' }}
                    </button>
                    <button
                      type="button"
                      (click)="cancelEditing()"
                      class="px-4 py-2 rounded-xl text-xs font-medium border border-slate-300 hover:bg-white cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              } @else {
                <dl class="grid sm:grid-cols-2 gap-6">
                  <div>
                    <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Họ và tên</dt>
                    <dd class="mt-1.5 text-base font-bold text-slate-900">
                      {{ currentFullName() || user()?.fullName }}
                    </dd>
                  </div>
                  <div class="min-w-0">
                    <dt class="text-xs font-semibold uppercase tracking-wider text-slate-500">Địa chỉ Email</dt>
                    <dd class="mt-1.5 text-base font-medium text-slate-800 break-words">
                      {{ user()?.email }}
                    </dd>
                  </div>
                </dl>
              }
            }

            @case ('bookings') {
              <div class="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 class="text-xl font-bold text-slate-900">Đặt phòng và hóa đơn</h2>
                  <p class="text-xs text-slate-500 mt-0.5">Danh sách các đặt phòng gắn liền với tài khoản của bạn</p>
                </div>
                <button
                  type="button"
                  (click)="loadBookings()"
                  class="text-xs text-indigo-600 hover:underline font-medium cursor-pointer"
                >
                  Làm mới
                </button>
              </div>

              @if (isLoadingBookings()) {
                <div class="py-12 text-center text-slate-500 text-sm">
                  <i class="pi pi-spin pi-spinner text-indigo-600 text-xl mb-2"></i>
                  <p>Đang tải danh sách đặt phòng...</p>
                </div>
              } @else if (bookings().length === 0) {
                <div class="py-10 text-center space-y-3">
                  <div class="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto text-xl">
                    <i class="pi pi-calendar-times"></i>
                  </div>
                  <h3 class="font-bold text-slate-800">Bạn chưa có đơn đặt phòng nào</h3>
                  <p class="text-xs text-slate-500 max-w-sm mx-auto">
                    Các chuyến lưu trú bạn đặt sau khi đăng nhập sẽ tự động hiển thị tại đây.
                  </p>
                  <div class="pt-2">
                    <a routerLink="/booking" class="inline-flex px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
                      Khám phá chỗ nghỉ ngay
                    </a>
                  </div>
                </div>
              } @else {
                <div class="space-y-4">
                  @for (b of bookings(); track b.id) {
                    <article class="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-slate-50/50">
                      <div>
                        <div class="flex items-center gap-2 mb-1">
                          <span class="font-bold text-slate-900 text-sm">{{ b.property.name }}</span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" [ngClass]="getStatusBadgeClass(b.status)">
                            {{ b.status }}
                          </span>
                        </div>
                        <p class="text-xs text-slate-500">
                          Mã đặt chỗ: <span class="font-mono font-semibold text-slate-700">{{ b.reference }}</span> • {{ b.roomTypeName }}
                        </p>
                        <p class="text-xs text-slate-600 mt-1">
                          Lưu trú: <strong>{{ b.checkInDate }}</strong> đến <strong>{{ b.checkOutDate }}</strong> ({{ b.rentalType }})
                        </p>
                      </div>
                      <div class="text-right sm:shrink-0">
                        <span class="block text-base font-extrabold text-indigo-600">
                          {{ b.totalAmount | number }}₫
                        </span>
                        <a
                          [routerLink]="['/booking/status', b.id]"
                          class="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline font-semibold mt-1"
                        >
                          Xem chi tiết <i class="pi pi-arrow-right text-[10px]"></i>
                        </a>
                      </div>
                    </article>
                  }
                </div>
              }
            }

            @case ('loyalty') {
              <div class="border-b border-slate-100 pb-4">
                <h2 class="text-xl font-bold text-slate-900">Hội viên và điểm thưởng</h2>
                <p class="text-xs text-slate-500 mt-0.5">Số dư điểm thưởng thực tế từ hệ thống sổ cái điểm</p>
              </div>

              @if (loyaltyData(); as loyalty) {
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div class="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                    <span class="text-xs font-semibold text-indigo-600">Tổng điểm tích lũy</span>
                    <p class="text-2xl font-extrabold text-indigo-900 mt-1">{{ loyalty.totalPoints | number }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Quy đổi ~ {{ loyalty.pointsValueVnd | number }}₫</span>
                  </div>
                  <div class="bg-emerald-50/70 p-4 rounded-xl border border-emerald-100">
                    <span class="text-xs font-semibold text-emerald-700">Điểm đã hoàn trả</span>
                    <p class="text-2xl font-extrabold text-emerald-900 mt-1">{{ loyalty.totalPointsRefunded | number }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Từ các đơn hủy hợp lệ</span>
                  </div>
                  <div class="bg-amber-50/70 p-4 rounded-xl border border-amber-100">
                    <span class="text-xs font-semibold text-amber-800">Thẻ hội viên</span>
                    <p class="text-2xl font-extrabold text-amber-900 mt-1">{{ loyalty.memberships?.length || 0 }}</p>
                    <span class="text-[11px] text-slate-500 mt-0.5 block">Tại các chuỗi liên kết</span>
                  </div>
                </div>
              } @else {
                <p class="text-sm text-slate-600">
                  Chưa có dữ liệu hội viên theo tài khoản. Điểm thưởng sẽ được tích lũy khi bạn hoàn tất chuyến lưu trú.
                </p>
              }
            }
          }
        </section>

        <a routerLink="/booking" class="inline-flex min-h-11 items-center text-indigo-700 hover:underline font-semibold">
          Tiếp tục khám phá chỗ nghỉ →
        </a>
      }
    </main>
  `,
})
export class GuestProfilePageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly guestAccountService = inject(GuestAccountService);
  private readonly alert = inject(AlertService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = toSignal(this.auth.currentUser$, { initialValue: this.auth.currentUser });
  readonly isGuest = computed(() => ['Customer', 'Guest'].includes(this.user()?.globalRole ?? ''));
  readonly activeTab = signal<string>('account');

  readonly currentFullName = signal<string>('');
  readonly phoneNumber = signal<string>('');
  readonly isEmailVerified = signal<boolean>(false);

  readonly isEditing = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  editFullName = '';

  readonly bookings = signal<GuestBookingSummaryDto[]>([]);
  readonly isLoadingBookings = signal<boolean>(false);

  readonly loyaltyData = signal<any>(null);

  readonly tabs = [
    { id: 'account', label: 'Thông tin cá nhân' },
    { id: 'bookings', label: 'Đặt phòng và hóa đơn' },
    { id: 'loyalty', label: 'Hội viên' },
  ];

  ngOnInit(): void {
    if (this.isGuest()) {
      this.loadProfile();
    }
  }

  selectTab(tabId: string): void {
    this.activeTab.set(tabId);
    if (tabId === 'bookings' && this.bookings().length === 0) {
      this.loadBookings();
    } else if (tabId === 'loyalty' && !this.loyaltyData()) {
      this.loadLoyalty();
    }
  }

  loadProfile(): void {
    this.guestAccountService
      .getMe()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (me: GuestMeDto) => {
          this.currentFullName.set(me.fullName);
          this.phoneNumber.set(me.phoneNumber || '');
          this.isEmailVerified.set(me.emailVerified);
        },
        error: () => {
          // If unauthenticated or guest API offline, fallback gracefully to session user
          this.currentFullName.set(this.user()?.fullName || '');
        },
      });
  }

  startEditing(): void {
    this.editFullName = this.currentFullName() || this.user()?.fullName || '';
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
  }

  saveProfile(): void {
    const trimmed = this.editFullName.trim();
    if (trimmed.length < 2) return;

    this.isSaving.set(true);
    this.guestAccountService
      .updateMe(trimmed)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated: GuestMeDto) => {
          this.isSaving.set(false);
          this.isEditing.set(false);
          this.currentFullName.set(updated.fullName);
          this.alert.success('Họ và tên của bạn đã được cập nhật thành công.');
        },
        error: (err) => {
          this.isSaving.set(false);
          this.alert.error(err?.error?.message || 'Không thể cập nhật hồ sơ vào lúc này.');
        },
      });
  }

  loadBookings(): void {
    this.isLoadingBookings.set(true);
    this.guestAccountService
      .getBookings(1, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isLoadingBookings.set(false);
          this.bookings.set(res.items || []);
        },
        error: () => {
          this.isLoadingBookings.set(false);
          this.bookings.set([]);
        },
      });
  }

  loadLoyalty(): void {
    this.guestAccountService
      .getLoyaltyProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.loyaltyData.set(data);
        },
        error: () => {
          this.loyaltyData.set(null);
        },
      });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Confirmed':
      case 'CheckedIn':
        return 'bg-emerald-100 text-emerald-800';
      case 'PendingPayment':
      case 'Held':
        return 'bg-amber-100 text-amber-800';
      case 'Cancelled':
      case 'Expired':
        return 'bg-rose-100 text-rose-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  }

  logout(): void {
    this.activeTab.set('account');
    this.currentFullName.set('');
    this.bookings.set([]);
    this.loyaltyData.set(null);
    this.auth.logout();
  }
}
