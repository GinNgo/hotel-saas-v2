import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomStatus, ROOM_STATUS_LABELS } from '../../../core/models/enums';
import { ReservationStatus, RESERVATION_STATUS_LABELS } from '../../../core/models/reservation.model';

export type StatusBadgeType = 'room' | 'reservation' | 'payment' | 'boolean' | 'custom';

/**
 * Component hiển thị Huy hiệu Trạng thái (Status Badge) dùng chung toàn hệ thống.
 * Hỗ trợ hiển thị chuẩn nhận diện thương hiệu Hotel SaaS cho Phòng, Đơn đặt, Thanh toán và Trạng thái Kích hoạt.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border transition-colors shadow-xs"
      [ngClass]="computedClasses()"
    >
      <span class="w-1.5 h-1.5 rounded-full shrink-0" [ngClass]="computedDotClass()"></span>
      <span>{{ computedLabel() }}</span>
    </span>
  `
})
export class StatusBadgeComponent {
  /** Giá trị trạng thái (code enum, string hoặc boolean) */
  status = input.required<string | number | boolean>();

  /** Phân loại nghiệp vụ của trạng thái */
  type = input<StatusBadgeType>('custom');

  /** Tùy chọn ghi đè nhãn hiển thị */
  customLabel = input<string>();

  /** Tùy chọn ghi đè màu sắc (emerald | amber | blue | purple | rose | slate) */
  color = input<'emerald' | 'amber' | 'blue' | 'purple' | 'rose' | 'slate'>();

  /** Tính toán nhãn hiển thị phù hợp */
  computedLabel = computed(() => {
    if (this.customLabel()) return this.customLabel()!;

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
  computedClasses = computed(() => {
    const forcedColor = this.color();
    if (forcedColor) return this.getColorClasses(forcedColor);

    const raw = this.status();
    const badgeType = this.type();

    if (badgeType === 'room') {
      const strVal = String(raw);
      switch (strVal) {
        case RoomStatus.Clean:
          return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
        case RoomStatus.Dirty:
          return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        case RoomStatus.Cleaning:
          return 'bg-sky-500/10 text-sky-700 border-sky-500/20';
        case RoomStatus.Occupied:
          return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
        case RoomStatus.OutOfService:
          return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
        default:
          return 'bg-slate-100 text-slate-700 border-slate-200';
      }
    }

    if (badgeType === 'reservation') {
      const val = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      switch (val) {
        case ReservationStatus.PendingPayment:
          return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
        case ReservationStatus.Confirmed:
          return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
        case ReservationStatus.CheckedIn:
          return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
        case ReservationStatus.CheckedOut:
          return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
        case ReservationStatus.Cancelled:
          return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
        case ReservationStatus.NoShow:
          return 'bg-stone-500/10 text-stone-600 border-stone-500/20';
        default:
          return 'bg-slate-100 text-slate-700 border-slate-200';
      }
    }

    if (badgeType === 'boolean') {
      return Boolean(raw)
        ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        : 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }

    if (badgeType === 'payment') {
      const str = String(raw).toLowerCase();
      if (str === 'completed' || str === 'paid' || str === 'success') {
        return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      }
      if (str === 'pending' || str === 'waiting') {
        return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      }
      if (str === 'failed' || str === 'rejected') {
        return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      }
      if (str === 'refunded') {
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      }
    }

    return 'bg-slate-100 text-slate-700 border-slate-200';
  });

  /** Tính toán màu chấm trạng thái */
  computedDotClass = computed(() => {
    const forcedColor = this.color();
    if (forcedColor) return `bg-${forcedColor}-500`;

    const raw = this.status();
    const badgeType = this.type();

    if (badgeType === 'room') {
      const strVal = String(raw);
      switch (strVal) {
        case RoomStatus.Clean: return 'bg-emerald-500';
        case RoomStatus.Dirty: return 'bg-amber-500';
        case RoomStatus.Cleaning: return 'bg-sky-500';
        case RoomStatus.Occupied: return 'bg-purple-500';
        case RoomStatus.OutOfService: return 'bg-rose-500';
        default: return 'bg-slate-400';
      }
    }

    if (badgeType === 'reservation') {
      const val = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      switch (val) {
        case ReservationStatus.PendingPayment: return 'bg-amber-500';
        case ReservationStatus.Confirmed: return 'bg-blue-500';
        case ReservationStatus.CheckedIn: return 'bg-emerald-500';
        case ReservationStatus.CheckedOut: return 'bg-slate-400';
        case ReservationStatus.Cancelled: return 'bg-rose-500';
        case ReservationStatus.NoShow: return 'bg-stone-400';
        default: return 'bg-slate-400';
      }
    }

    if (badgeType === 'boolean') {
      return Boolean(raw) ? 'bg-emerald-500' : 'bg-slate-400';
    }

    return 'bg-slate-400';
  });

  private getColorClasses(color: string): string {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      case 'amber': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'blue': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'purple': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'rose': return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }
}
