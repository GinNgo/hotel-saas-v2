import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatBusinessDateTime } from '../../../core/utils/date-time.util';
import { NotificationService } from '../../../core/services/notification.service';
import {
  MAX_RECENT_NOTIFICATIONS,
  NOTIFICATION_TYPE_VISUALS,
  NotificationEventType,
  NotificationItem,
  NotificationTypeVisualConfig,
  RealtimeConnectionState
} from './notification-bell.model';

export * from './notification-bell.model';

/**
 * Component Chuông Thông báo (Notification Bell — T01-A & T01-B).
 *
 * Đặc tả kiến trúc & UX:
 * - Angular 22 Standalone + Signals + ChangeDetectionStrategy.OnPush.
 * - Phong cách PMS: White / Slate / Emerald, viền mảnh, bo góc vừa phải, đổ bóng mềm, độ tương phản cao.
 * - Hiển thị tối đa 10 thông báo gần nhất thuộc đúng Tenant & Property đang hoạt động (Fail-Closed).
 * - Không hardcode dữ liệu giả vào Production.
 * - Không tự ý đánh dấu đã đọc hoặc báo thành công giả khi chưa có xác nhận từ Backend API.
 * - Bộ lọc Tab thông minh: Tất cả / Chưa đọc kèm bộ đếm unread trực quan.
 * - Hiển thị trạng thái kênh trực tiếp SignalR (Trực tiếp, Nối lại, Ngoại tuyến).
 * - Tự động thu gọn chiều cao linh hoạt, không để khoảng trống vô nghĩa khi rỗng.
 * - Hỗ trợ đầy đủ bàn phím (Enter, Space, ArrowDown/Up, Home, End, Escape) và thuộc tính ARIA.
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block text-left" #bellContainer>
      <!-- Nút Chuông Thông báo (Trigger Button) -->
      <button
        #triggerButton
        type="button"
        [id]="controlId() + '-trigger'"
        (click)="toggleDropdown()"
        (keydown)="onTriggerKeydown($event)"
        [attr.aria-label]="triggerAriaLabel()"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="dialog"
        [attr.aria-controls]="isOpen() ? panelId() : null"
        class="relative inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 shadow-2xs"
        [class.bg-emerald-50]="isOpen()"
        [class.border-emerald-300]="isOpen()"
        [class.text-emerald-700]="isOpen()"
        [class.bg-white]="!isOpen()"
        [class.border-slate-200]="!isOpen()"
        [class.text-slate-600]="!isOpen()"
        [class.hover:bg-slate-50]="!isOpen()"
        [class.hover:text-emerald-700]="!isOpen()"
        [class.hover:border-emerald-200]="!isOpen()"
        data-testid="notification-bell-trigger"
      >
        <i class="pi pi-bell text-base" aria-hidden="true"></i>

        <!-- Badge số lượng thông báo chưa đọc -->
        @if (unreadCount() > 0) {
          <span
            class="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none border-2 border-white shadow-2xs"
            data-testid="notification-unread-badge"
            aria-hidden="true"
          >
            {{ unreadBadgeText() }}
          </span>
        }
      </button>

      <!-- Dropdown Trung tâm thông báo -->
      @if (isOpen()) {
        <div
          [id]="panelId()"
          role="dialog"
          aria-modal="false"
          aria-labelledby="notification-center-title"
          (keydown)="onPanelKeydown($event)"
          class="absolute right-0 mt-2.5 w-[min(26rem,calc(100vw-1.5rem))] flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 z-50 overflow-hidden"
          data-testid="notification-dropdown-panel"
        >
          <!-- Header Dropdown -->
          <div class="flex items-center justify-between gap-2.5 px-4 py-3 bg-slate-50/90 border-b border-slate-100 shrink-0">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100/90 text-emerald-800 shrink-0 shadow-2xs">
                <i class="pi pi-bell text-xs" aria-hidden="true"></i>
              </span>
              <div class="flex items-center gap-2 min-w-0">
                <h2
                  id="notification-center-title"
                  class="text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap tracking-tight"
                >
                  Trung tâm thông báo
                </h2>

                <!-- Badge số lượng chưa đọc ngay cạnh tiêu đề -->
                @if (unreadCount() > 0) {
                  <span
                    class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none shrink-0 shadow-2xs"
                    data-testid="notification-header-unread-pill"
                    title="{{ unreadCount() }} thông báo chưa đọc"
                  >
                    {{ unreadBadgeText() }}
                  </span>
                }

                <!-- SignalR Live Badge -->
                @if (connectionState() === 'connected') {
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 whitespace-nowrap shrink-0" title="Đã kết nối SignalR trực tiếp">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                    <span>Trực tiếp</span>
                  </span>
                } @else if (connectionState() === 'reconnecting') {
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/70 whitespace-nowrap shrink-0" title="Đang thử kết nối lại...">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                    <span>Nối lại</span>
                  </span>
                }
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 ml-auto">
              @if (unreadCount() === 0 && visibleNotifications().length > 0) {
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap shrink-0"
                  data-testid="notification-header-all-read-pill"
                >
                  Đã xem hết
                </span>
              }

              @if (notificationService) {
                <button
                  type="button"
                  (click)="notificationService.toggleSound(); notificationService.playNotificationSound()"
                  [title]="notificationService.isSoundEnabled() ? 'Âm thanh thông báo: Đang bật (nhấn để tắt/thử âm)' : 'Âm thanh thông báo: Đang tắt (nhấn để bật)'"
                  [attr.aria-label]="notificationService.isSoundEnabled() ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'"
                  class="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 cursor-pointer"
                  [class.text-emerald-700]="notificationService.isSoundEnabled()"
                  [class.bg-emerald-50]="notificationService.isSoundEnabled()"
                  [class.hover:bg-emerald-100]="notificationService.isSoundEnabled()"
                  [class.text-slate-400]="!notificationService.isSoundEnabled()"
                  [class.hover:bg-slate-100]="!notificationService.isSoundEnabled()"
                  data-testid="notification-sound-toggle-btn"
                >
                  <i class="pi text-xs" [class.pi-volume-up]="notificationService.isSoundEnabled()" [class.pi-volume-off]="!notificationService.isSoundEnabled()" aria-hidden="true"></i>
                </button>
              }

              <button
                type="button"
                (click)="closeDropdown(true)"
                aria-label="Đóng trung tâm thông báo"
                class="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 cursor-pointer"
                data-testid="notification-close-btn"
              >
                <i class="pi pi-times text-xs" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <!-- Thông báo phản hồi khi thao tác đánh dấu đã đọc chưa có Backend xác nhận -->
          @if (readStatusFeedback()) {
            <div
              role="status"
              aria-live="polite"
              class="px-4 py-2 bg-amber-50/90 border-b border-amber-200/80 text-[11px] text-amber-800 flex items-center justify-between gap-2"
              data-testid="notification-read-feedback"
            >
              <div class="flex items-center gap-1.5">
                <i class="pi pi-info-circle text-xs text-amber-600 shrink-0" aria-hidden="true"></i>
                <span>{{ readStatusFeedback() }}</span>
              </div>
              <button
                type="button"
                (click)="clearFeedback()"
                aria-label="Ẩn thông báo trạng thái"
                class="text-amber-700 hover:text-amber-900 p-0.5 rounded cursor-pointer"
              >
                <i class="pi pi-times text-[10px]" aria-hidden="true"></i>
              </button>
            </div>
          }

          <!-- Tabs lọc thông báo (Tất cả / Chưa đọc) khi có dữ liệu -->
          @if (visibleNotifications().length > 0) {
            <div class="flex items-center justify-between px-3.5 py-1.5 bg-slate-50/60 border-b border-slate-100">
              <div class="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-200/60">
                <button
                  type="button"
                  (click)="setActiveTab('all')"
                  class="px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer"
                  [class.bg-white]="activeTab() === 'all'"
                  [class.text-slate-900]="activeTab() === 'all'"
                  [class.font-semibold]="activeTab() === 'all'"
                  [class.shadow-2xs]="activeTab() === 'all'"
                  [class.text-slate-500]="activeTab() !== 'all'"
                  [class.hover:text-slate-700]="activeTab() !== 'all'"
                >
                  Tất cả ({{ visibleNotifications().length }})
                </button>
                <button
                  type="button"
                  (click)="setActiveTab('unread')"
                  class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer"
                  [class.bg-white]="activeTab() === 'unread'"
                  [class.text-slate-900]="activeTab() === 'unread'"
                  [class.font-semibold]="activeTab() === 'unread'"
                  [class.shadow-2xs]="activeTab() === 'unread'"
                  [class.text-slate-500]="activeTab() !== 'unread'"
                  [class.hover:text-slate-700]="activeTab() !== 'unread'"
                >
                  <span>Chưa đọc</span>
                  @if (unreadCount() > 0) {
                    <span class="inline-flex items-center px-1 rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                      {{ unreadCount() }}
                    </span>
                  }
                </button>
              </div>

              @if (unreadCount() > 0) {
                <button
                  type="button"
                  (click)="onRequestMarkAllAsRead()"
                  [attr.aria-disabled]="!canMarkAsRead()"
                  class="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition-colors focus:outline-none focus-visible:underline cursor-pointer"
                  data-testid="notification-mark-all-read-btn"
                >
                  Đánh dấu đã đọc
                </button>
              }
            </div>
          }

          <!-- Body: Loading / Error / Empty / Danh sách tối đa 10 thông báo -->
          <div class="max-h-96 overflow-y-auto divide-y divide-slate-100">
            @if (loading()) {
              <!-- Trạng thái Đang tải -->
              <div
                class="py-10 px-4 text-center"
                role="status"
                aria-live="polite"
                data-testid="notification-loading-state"
              >
                <i class="pi pi-spin pi-spinner text-xl text-emerald-600 mb-2 block" aria-hidden="true"></i>
                <p class="text-xs font-medium text-slate-600">Đang tải thông báo...</p>
              </div>
            } @else if (errorMessage()) {
              <!-- Trạng thái Lỗi -->
              <div
                class="py-8 px-4 text-center bg-rose-50/40"
                role="alert"
                data-testid="notification-error-state"
              >
                <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-2.5 border border-rose-200/80">
                  <i class="pi pi-exclamation-triangle text-base" aria-hidden="true"></i>
                </div>
                <p class="text-xs font-semibold text-rose-800">{{ errorMessage() }}</p>
                <button
                  type="button"
                  (click)="onRetry()"
                  class="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                  data-testid="notification-retry-btn"
                >
                  <i class="pi pi-refresh text-[11px]" aria-hidden="true"></i>
                  <span>Thử lại</span>
                </button>
              </div>
            } @else if (visibleNotifications().length === 0) {
              <!-- Trạng thái Rỗng Hoàn Toàn -->
              <div
                class="py-8 px-5 text-center"
                data-testid="notification-empty-state"
              >
                <div class="relative w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
                  <i class="pi pi-bell text-lg" aria-hidden="true"></i>
                  <span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] shadow-2xs">
                    <i class="pi pi-check" aria-hidden="true"></i>
                  </span>
                </div>
                <h3 class="text-xs font-bold text-slate-800">Không có thông báo mới</h3>
                <p class="text-[11px] text-slate-500 mt-1 max-w-[280px] mx-auto leading-relaxed">
                  Các thông báo về đơn đặt phòng và trạng thái buồng phòng của chi nhánh sẽ hiển thị tại đây.
                </p>
              </div>
            } @else if (displayedNotifications().length === 0 && activeTab() === 'unread') {
              <!-- Trạng thái không có thông báo chưa đọc khi chọn tab Chưa đọc -->
              <div class="py-8 px-5 text-center">
                <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-2xs">
                  <i class="pi pi-check-circle text-base" aria-hidden="true"></i>
                </div>
                <p class="text-xs font-semibold text-slate-800">Bạn đã đọc hết tất cả thông báo</p>
                <button
                  type="button"
                  (click)="setActiveTab('all')"
                  class="mt-2 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                >
                  Xem toàn bộ {{ visibleNotifications().length }} thông báo gần nhất
                </button>
              </div>
            } @else {
              <!-- Danh sách thông báo -->
              <div role="list" aria-label="Danh sách thông báo gần nhất" data-testid="notification-list">
                @for (item of displayedNotifications(); track item.id; let idx = $index) {
                  <div
                    role="listitem"
                    class="transition-colors border-l-[3px]"
                    [class.border-emerald-500]="!item.isRead"
                    [class.bg-emerald-50/30]="!item.isRead"
                    [class.border-transparent]="item.isRead"
                    [class.bg-white]="item.isRead"
                    [attr.data-testid]="'notification-item-' + idx"
                    [attr.data-unread]="!item.isRead"
                  >
                    <button
                      type="button"
                      [attr.data-notification-item-btn]="idx"
                      (click)="onSelectNotification(item)"
                      class="w-full text-left px-3.5 py-3 flex items-start gap-3 hover:bg-slate-50/90 focus:outline-none focus-visible:bg-emerald-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 transition-colors cursor-pointer"
                    >
                      <!-- Icon Loại thông báo -->
                      <div
                        class="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs"
                        [ngClass]="getTypeConfig(item.type).iconContainerClass"
                      >
                        <i [class]="getTypeConfig(item.type).iconClass + ' text-sm'" aria-hidden="true"></i>
                      </div>

                      <!-- Nội dung Thông báo -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between gap-2 mb-1">
                          <span
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border"
                            [ngClass]="getTypeConfig(item.type).badgeClass"
                          >
                            {{ getTypeConfig(item.type).categoryLabel }}
                          </span>

                          <div class="flex items-center gap-1.5 shrink-0">
                            <time
                              [attr.datetime]="item.createdAtUtc"
                              class="text-[11px] text-slate-400 font-medium"
                              data-testid="notification-item-time"
                            >
                              {{ formatTimestamp(item.createdAtUtc) }}
                            </time>
                            @if (!item.isRead) {
                              <span
                                class="w-2 h-2 rounded-full bg-emerald-600 shrink-0"
                                title="Thông báo chưa đọc"
                                aria-label="Chưa đọc"
                                data-testid="notification-unread-indicator"
                              ></span>
                            }
                          </div>
                        </div>

                        <p
                          class="text-xs leading-snug truncate"
                          [class.font-bold]="!item.isRead"
                          [class.text-slate-900]="!item.isRead"
                          [class.font-medium]="item.isRead"
                          [class.text-slate-600]="item.isRead"
                          data-testid="notification-item-title"
                        >
                          {{ item.title }}
                        </p>

                        <p
                          class="text-[11px] mt-0.5 leading-relaxed line-clamp-2"
                          [class.text-slate-700]="!item.isRead"
                          [class.text-slate-500]="item.isRead"
                          data-testid="notification-item-message"
                        >
                          {{ item.message }}
                        </p>

                        @if (item.metadata?.confirmationCode || item.metadata?.roomNumber) {
                          <div class="flex items-center gap-1.5 mt-1.5">
                            @if (item.metadata?.confirmationCode) {
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600 font-mono">
                                <i class="pi pi-ticket text-[9px]"></i>#{{ item.metadata?.confirmationCode }}
                              </span>
                            }
                            @if (item.metadata?.roomNumber) {
                              <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                <i class="pi pi-building text-[9px]"></i>P.{{ item.metadata?.roomNumber }}
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Footer Dropdown -->
          @if (visibleNotifications().length > 0) {
            <div class="px-4 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span class="text-[10px] text-slate-500">Hiển thị {{ visibleNotifications().length }} thông báo gần nhất</span>

              @if (unreadCount() > 0) {
                <button
                  type="button"
                  (click)="onRequestMarkAllAsRead()"
                  [attr.aria-disabled]="!canMarkAsRead()"
                  class="font-semibold transition-colors focus:outline-none focus-visible:underline"
                  [class.text-emerald-700]="canMarkAsRead()"
                  [class.hover:text-emerald-800]="canMarkAsRead()"
                  [class.cursor-pointer]="canMarkAsRead()"
                  [class.text-slate-400]="!canMarkAsRead()"
                  [class.cursor-not-allowed]="!canMarkAsRead()"
                  data-testid="notification-mark-all-read-btn"
                >
                  Đánh dấu đã đọc
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `
})
export class NotificationBellComponent {
  readonly notificationService = inject(NotificationService, { optional: true });

  /** Danh sách thông báo truyền vào từ nguồn dữ liệu (mặc định rỗng, không hardcode dữ liệu giả) */
  readonly notifications = input<readonly NotificationItem[]>([]);

  /**
   * TenantId hiện hành để lọc cô lập dữ liệu (Multi-Tenant Isolation).
   * Nếu truyền chuỗi rỗng `''` (ngữ cảnh không hợp lệ), component áp dụng Fail-Closed và ẩn toàn bộ.
   */
  readonly activeTenantId = input<string | null>(null);

  /**
   * PropertyId hiện hành để lọc cô lập theo chi nhánh (Property Isolation).
   * Nếu truyền chuỗi rỗng `''` (ngữ cảnh chi nhánh không hợp lệ), component áp dụng Fail-Closed và ẩn toàn bộ.
   */
  readonly activePropertyId = input<string | null>(null);

  /** Trạng thái đang tải dữ liệu */
  readonly loading = input<boolean>(false);

  /** Thông điệp lỗi từ nguồn dữ liệu (nếu có) */
  readonly errorMessage = input<string | null>(null);

  /** Giới hạn số thông báo tối đa hiển thị (mặc định và tối đa 10 theo đặc tả T01) */
  readonly maxItems = input<number>(MAX_RECENT_NOTIFICATIONS);

  /**
   * Cờ cho phép gửi yêu cầu đánh dấu đã đọc lên Backend.
   * Ở giai đoạn T01-A (chưa có API xác nhận), mặc định là `false` để không báo thành công giả.
   */
  readonly canMarkAsRead = input<boolean>(false);

  /** Định danh gốc cho các phần tử ARIA */
  readonly controlId = input<string>('notification-bell');

  /** Sự kiện phát ra khi người dùng chọn một thông báo */
  readonly notificationSelect = output<NotificationItem>();

  /** Sự kiện yêu cầu Backend đánh dấu 1 thông báo là đã đọc (chỉ phát khi `canMarkAsRead() === true`) */
  readonly markAsReadRequest = output<string>();

  /** Sự kiện yêu cầu Backend đánh dấu tất cả là đã đọc (chỉ phát khi `canMarkAsRead() === true`) */
  readonly markAllAsReadRequest = output<void>();

  /** Sự kiện yêu cầu tải lại khi gặp lỗi */
  readonly retryRequest = output<void>();

  /** Sự kiện thông báo trạng thái đóng/mở dropdown */
  readonly dropdownOpenChange = output<boolean>();

  @ViewChild('bellContainer') private readonly bellContainer?: ElementRef<HTMLElement>;
  @ViewChild('triggerButton') private readonly triggerButton?: ElementRef<HTMLButtonElement>;

  /** Trạng thái mở/đóng của dropdown */
  readonly isOpen = signal<boolean>(false);

  /** Tab lọc đang chọn ('all' = Tất cả, 'unread' = Chưa đọc) */
  readonly activeTab = signal<'all' | 'unread'>('all');

  /** Thông báo nội bộ khi người dùng bấm đánh dấu đã đọc nhưng chưa có kết nối xác nhận từ Backend */
  readonly readStatusFeedback = signal<string | null>(null);

  /** ID của panel dropdown phục vụ aria-controls */
  readonly panelId = computed<string>(() => `${this.controlId()}-panel`);

  /** Trạng thái kết nối SignalR thời gian thực từ NotificationService */
  readonly connectionState = computed<RealtimeConnectionState>(() => {
    return this.notificationService?.connectionState() ?? 'unconfigured';
  });

  /**
   * Danh sách thông báo đã được lọc nghiêm ngặt theo Tenant & Property hiện hành (Fail-Closed)
   * và sắp xếp mới nhất lên đầu.
   */
  readonly scopedNotifications = computed<NotificationItem[]>(() => {
    const rawItems = this.notifications() ?? [];
    const expectedTenantId = this.activeTenantId();
    const expectedPropertyId = this.activePropertyId();

    // Fail-closed: nếu activeTenantId hoặc activePropertyId được truyền vào nhưng là chuỗi rỗng/khoảng trắng
    if (expectedTenantId !== null && expectedTenantId.trim().length === 0) {
      return [];
    }
    if (expectedPropertyId !== null && expectedPropertyId.trim().length === 0) {
      return [];
    }

    const filtered = rawItems.filter((item): item is NotificationItem => {
      if (!item || !item.id || !item.tenantId || !item.propertyId) {
        return false;
      }
      if (expectedTenantId !== null && item.tenantId !== expectedTenantId) {
        return false;
      }
      if (expectedPropertyId !== null && item.propertyId !== expectedPropertyId) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const timeA = Date.parse(a.createdAtUtc);
      const timeB = Date.parse(b.createdAtUtc);
      if (Number.isNaN(timeA) || Number.isNaN(timeB)) {
        return 0;
      }
      return timeB - timeA;
    });
  });

  /**
   * Tối đa 10 thông báo gần nhất để hiển thị trong dropdown.
   */
  readonly visibleNotifications = computed<NotificationItem[]>(() => {
    const requestedMax = this.maxItems();
    const safeLimit = Number.isFinite(requestedMax)
      ? Math.min(Math.max(1, Math.trunc(requestedMax)), MAX_RECENT_NOTIFICATIONS)
      : MAX_RECENT_NOTIFICATIONS;
    return this.scopedNotifications().slice(0, safeLimit);
  });

  /**
   * Danh sách thông báo được lọc theo tab ('all' hoặc 'unread').
   */
  readonly displayedNotifications = computed<NotificationItem[]>(() => {
    const items = this.visibleNotifications();
    if (this.activeTab() === 'unread') {
      return items.filter(item => !item.isRead);
    }
    return items;
  });

  /**
   * Tổng số thông báo chưa đọc trong phạm vi Tenant/Property hợp lệ.
   */
  readonly unreadCount = computed<number>(() => {
    return this.scopedNotifications().reduce((count, item) => count + (item.isRead ? 0 : 1), 0);
  });

  /**
   * Chuỗi hiển thị trên badge (tối đa 99+).
   */
  readonly unreadBadgeText = computed<string>(() => {
    const count = this.unreadCount();
    if (count <= 0) return '';
    return count > 99 ? '99+' : String(count);
  });

  /**
   * Nhãn ARIA động cho nút chuông.
   */
  readonly triggerAriaLabel = computed<string>(() => {
    const count = this.unreadCount();
    return count > 0
      ? `Trung tâm thông báo, có ${count} thông báo chưa đọc`
      : 'Trung tâm thông báo, không có thông báo chưa đọc';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node | null;
    if (target && this.bellContainer?.nativeElement && !this.bellContainer.nativeElement.contains(target)) {
      this.closeDropdown(false);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (!this.isOpen()) return;
    event.preventDefault();
    event.stopPropagation();
    this.closeDropdown(true);
  }

  toggleDropdown(): void {
    if (this.isOpen()) {
      this.closeDropdown(false);
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    if (!this.isOpen()) {
      this.readStatusFeedback.set(null);
      this.activeTab.set('all');
      this.isOpen.set(true);
      this.dropdownOpenChange.emit(true);
    }
  }

  closeDropdown(restoreFocus: boolean = false): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.readStatusFeedback.set(null);
      this.dropdownOpenChange.emit(false);
      if (restoreFocus) {
        this.triggerButton?.nativeElement.focus();
      }
    }
  }

  setActiveTab(tab: 'all' | 'unread'): void {
    this.activeTab.set(tab);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openDropdown();
      queueMicrotask(() => this.focusItemByIndex(0));
    }
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const buttons = this.getNotificationItemButtons();
    if (buttons.length === 0) return;

    const activeEl = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    const currentIndex = activeEl ? buttons.findIndex(btn => btn === activeEl) : -1;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % buttons.length;
      buttons[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
      buttons[prevIndex]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      buttons[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  }

  /**
   * Xử lý khi người dùng bấm vào một thông báo trong danh sách.
   * Tuyệt đối không tự ý gán `item.isRead = true` ở client khi chưa có xác nhận từ Backend.
   */
  onSelectNotification(item: NotificationItem): void {
    this.notificationSelect.emit(item);
    if (!item.isRead && this.canMarkAsRead()) {
      this.markAsReadRequest.emit(item.id);
    }
  }

  /**
   * Yêu cầu đánh dấu một thông báo cụ thể là đã đọc.
   * Không tự cập nhật trạng thái `isRead` cục bộ và không báo thành công giả khi thiếu xác nhận Backend.
   */
  requestMarkAsRead(itemId: string): boolean {
    if (!this.canMarkAsRead()) {
      this.readStatusFeedback.set('Chưa thể đánh dấu đã đọc (chờ kết nối xác nhận từ máy chủ).');
      return false;
    }
    this.readStatusFeedback.set(null);
    this.markAsReadRequest.emit(itemId);
    return true;
  }

  /**
   * Yêu cầu đánh dấu toàn bộ thông báo chưa đọc là đã đọc.
   * Fail-closed: nếu chưa có API hỗ trợ (`canMarkAsRead() === false`), hiển thị thông báo trạng thái rõ ràng
   * và giữ nguyên số lượng chưa đọc.
   */
  onRequestMarkAllAsRead(): boolean {
    if (!this.canMarkAsRead()) {
      this.readStatusFeedback.set('Chưa thể đánh dấu đã đọc (chờ kết nối xác nhận từ máy chủ).');
      return false;
    }
    this.readStatusFeedback.set(null);
    this.markAllAsReadRequest.emit();
    return true;
  }

  clearFeedback(): void {
    this.readStatusFeedback.set(null);
  }

  onRetry(): void {
    this.retryRequest.emit();
  }

  getTypeConfig(type: NotificationEventType): NotificationTypeVisualConfig {
    return NOTIFICATION_TYPE_VISUALS[type] ?? NOTIFICATION_TYPE_VISUALS.NewReservation;
  }

  /**
   * Định dạng thời gian hiển thị chuẩn múi giờ nghiệp vụ Asia/Ho_Chi_Minh (dd/mm/yyyy HH:mm).
   */
  formatTimestamp(createdAtUtc: string): string {
    return formatBusinessDateTime(createdAtUtc);
  }

  private getNotificationItemButtons(): HTMLButtonElement[] {
    const container = this.bellContainer?.nativeElement;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLButtonElement>('button[data-notification-item-btn]'));
  }

  private focusItemByIndex(index: number): void {
    const buttons = this.getNotificationItemButtons();
    buttons[index]?.focus();
  }
}
