import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../../core/models/enums';
import { ReservationStatus, RESERVATION_STATUS_LABELS } from '../../../core/models/reservation.model';

export type StatusBadgeType = 'room' | 'reservation' | 'payment' | 'boolean' | 'custom';
export type StatusBadgeColor = 'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate';

const BADGE_COLOR_CLASSES: Record<StatusBadgeColor, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35',
  amber: 'bg-amber-500/10 text-amber-800 border-amber-500/25 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35',
  blue: 'bg-blue-500/10 text-blue-700 border-blue-500/25 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/35',
  purple: 'bg-purple-500/10 text-purple-700 border-purple-500/25 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/35',
  rose: 'bg-rose-500/10 text-rose-700 border-rose-500/25 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/35',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

const DOT_COLOR_CLASSES: Record<StatusBadgeColor, string> = {
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  blue: 'bg-blue-500 dark:bg-blue-400',
  purple: 'bg-purple-500 dark:bg-purple-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
  slate: 'bg-slate-400 dark:bg-slate-400',
};

/**
 * Component hiển thị Huy hiệu Trạng thái (Status Badge) dùng chung toàn hệ thống.
 * Hỗ trợ hiển thị chuẩn nhận diện thương hiệu Hotel SaaS cho Phòng, Đơn đặt, Thanh toán và Trạng thái Kích hoạt.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border transition-colors shadow-xs"
      [ngClass]="computedClasses()"
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="computedDotClass()" aria-hidden="true"></span>
      <span>{{ computedLabel() }}</span>
    </span>
  `
})
export class StatusBadgeComponent {
  /** Giá trị trạng thái (code enum, string hoặc boolean) */
  readonly status = input.required<string | number | boolean>();

  /** Phân loại nghiệp vụ của trạng thái */
  readonly type = input<StatusBadgeType>('custom');

  /** Tùy chọn ghi đè nhãn hiển thị */
  readonly customLabel = input<string>();

  /** Tùy chọn ghi đè màu sắc (emerald | amber | blue | purple | rose | slate) */
  readonly color = input<StatusBadgeColor>();

  /** Tính toán nhãn hiển thị phù hợp */
  readonly computedLabel = computed(() => {
    const custom = this.customLabel();
    if (custom) return custom;

    const raw = this.status();
    const badgeType = this.type();

    if (badgeType === 'room') {
      const strVal = String(raw) as RoomStatus;
      if (ROOM_STATUS_LABELS[strVal]) {
        return ROOM_STATUS_LABELS[strVal];
      }
      return String(raw);
    }

    if (badgeType === 'reservation') {
      const numStatus = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!isNaN(numStatus) && RESERVATION_STATUS_LABELS[numStatus as ReservationStatus]) {
        return RESERVATION_STATUS_LABELS[numStatus as ReservationStatus];
      }
      return String(raw);
    }

    if (badgeType === 'boolean') {
      return Boolean(raw) ? 'Đang hoạt động' : 'Tạm dừng';
    }

    if (badgeType === 'payment') {
      const str = String(raw).toLowerCase();
      if (str === 'completed' || str === 'paid' || str === 'success') return 'Đã thanh toán';
      if (str === 'pending' || str === 'waiting') return 'Chờ xử lý';
      if (str === 'failed' || str === 'rejected') return 'Thất bại';
      if (str === 'refunded') return 'Đã hoàn tiền';
      return String(raw);
    }

    return String(raw);
  });

  /** Tính toán class Tailwind theo trạng thái */
  readonly computedClasses = computed(() => {
    const forcedColor = this.color();
    if (forcedColor) return BADGE_COLOR_CLASSES[forcedColor] ?? BADGE_COLOR_CLASSES.slate;

    const raw = this.status();
    const badgeType = this.type();

    if (badgeType === 'room') {
      const strVal = String(raw);
      switch (strVal) {
        case RoomStatus.Clean:
          return BADGE_COLOR_CLASSES.emerald;
        case RoomStatus.Dirty:
          return BADGE_COLOR_CLASSES.amber;
        case RoomStatus.Cleaning:
          return 'bg-sky-500/10 text-sky-700 border-sky-500/25 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/35';
        case RoomStatus.Occupied:
          return BADGE_COLOR_CLASSES.purple;
        case RoomStatus.OutOfService:
          return BADGE_COLOR_CLASSES.rose;
        default:
          return BADGE_COLOR_CLASSES.slate;
      }
    }

    if (badgeType === 'reservation') {
      const val = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      switch (val) {
        case ReservationStatus.PendingPayment:
          return BADGE_COLOR_CLASSES.amber;
        case ReservationStatus.Confirmed:
          return BADGE_COLOR_CLASSES.blue;
        case ReservationStatus.CheckedIn:
          return BADGE_COLOR_CLASSES.emerald;
        case ReservationStatus.CheckedOut:
          return 'bg-slate-500/10 text-slate-700 border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/35';
        case ReservationStatus.Cancelled:
          return BADGE_COLOR_CLASSES.rose;
        case ReservationStatus.NoShow:
          return 'bg-stone-500/10 text-stone-700 border-stone-500/25 dark:bg-stone-500/15 dark:text-stone-300 dark:border-stone-500/35';
        default:
          return BADGE_COLOR_CLASSES.slate;
      }
    }

    if (badgeType === 'boolean') {
      return Boolean(raw)
        ? BADGE_COLOR_CLASSES.emerald
        : 'bg-slate-500/10 text-slate-700 border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/35';
    }

    if (badgeType === 'payment') {
      const str = String(raw).toLowerCase();
      if (str === 'completed' || str === 'paid' || str === 'success') {
        return BADGE_COLOR_CLASSES.emerald;
      }
      if (str === 'pending' || str === 'waiting') {
        return BADGE_COLOR_CLASSES.amber;
      }
      if (str === 'failed' || str === 'rejected') {
        return BADGE_COLOR_CLASSES.rose;
      }
      if (str === 'refunded') {
        return 'bg-slate-500/10 text-slate-700 border-slate-500/25 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/35';
      }
    }

    return BADGE_COLOR_CLASSES.slate;
  });

  /** Tính toán màu chấm trạng thái bằng ánh xạ tĩnh (tránh dynamic Tailwind purge) */
  readonly computedDotClass = computed(() => {
    const forcedColor = this.color();
    if (forcedColor) return DOT_COLOR_CLASSES[forcedColor] ?? DOT_COLOR_CLASSES.slate;

    const raw = this.status();
    const badgeType = this.type();

    if (badgeType === 'room') {
      const strVal = String(raw);
      switch (strVal) {
        case RoomStatus.Clean:
          return DOT_COLOR_CLASSES.emerald;
        case RoomStatus.Dirty:
          return DOT_COLOR_CLASSES.amber;
        case RoomStatus.Cleaning:
          return 'bg-sky-500 dark:bg-sky-400';
        case RoomStatus.Occupied:
          return DOT_COLOR_CLASSES.purple;
        case RoomStatus.OutOfService:
          return DOT_COLOR_CLASSES.rose;
        default:
          return DOT_COLOR_CLASSES.slate;
      }
    }

    if (badgeType === 'reservation') {
      const val = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      switch (val) {
        case ReservationStatus.PendingPayment:
          return DOT_COLOR_CLASSES.amber;
        case ReservationStatus.Confirmed:
          return DOT_COLOR_CLASSES.blue;
        case ReservationStatus.CheckedIn:
          return DOT_COLOR_CLASSES.emerald;
        case ReservationStatus.CheckedOut:
          return DOT_COLOR_CLASSES.slate;
        case ReservationStatus.Cancelled:
          return DOT_COLOR_CLASSES.rose;
        case ReservationStatus.NoShow:
          return 'bg-stone-500 dark:bg-stone-400';
        default:
          return DOT_COLOR_CLASSES.slate;
      }
    }

    if (badgeType === 'boolean') {
      return Boolean(raw) ? DOT_COLOR_CLASSES.emerald : DOT_COLOR_CLASSES.slate;
    }

    if (badgeType === 'payment') {
      const str = String(raw).toLowerCase();
      if (str === 'completed' || str === 'paid' || str === 'success') {
        return DOT_COLOR_CLASSES.emerald;
      }
      if (str === 'pending' || str === 'waiting') {
        return DOT_COLOR_CLASSES.amber;
      }
      if (str === 'failed' || str === 'rejected') {
        return DOT_COLOR_CLASSES.rose;
      }
      if (str === 'refunded') {
        return DOT_COLOR_CLASSES.slate;
      }
    }

    return DOT_COLOR_CLASSES.slate;
  });
}
