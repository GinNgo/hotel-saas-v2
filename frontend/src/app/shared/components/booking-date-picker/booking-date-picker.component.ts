import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import { RentalType } from '../../../core/models/public-booking.model';

export interface BookingDateRange {
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  nightCount: number;
}

@Component({
  selector: 'app-booking-date-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="booking-date-picker-root font-sans">
      <!-- 1. CHẾ ĐỘ THUÊ THEO NGÀY (DAILY) -->
      @if (normalizedRentalType() === 'Daily') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
          <!-- Cột Từ ngày (Check-in) -->
          <div class="relative flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Nhận phòng
              </label>
              <span class="text-[11px] text-indigo-600 font-medium shrink-0">Từ 14:00</span>
            </div>
            <div class="relative">
              <p-datepicker
                [(ngModel)]="inDateObject"
                (ngModelChange)="onInDateChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                iconDisplay="input"
                [minDate]="minDate"
                appendTo="body"
                [firstDayOfWeek]="1"
                placeholder="dd/mm/yyyy"
                ariaLabel="Ngày nhận phòng"
                styleClass="w-full"
                inputStyleClass="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer shadow-2xs"
              />
              <i class="pi pi-calendar absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 truncate h-4">
              {{ getFormattedDayOfWeek(inDateObject()) }}
            </p>
          </div>

          <!-- Cột Đến ngày (Check-out) -->
          <div class="relative flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Trả phòng
              </label>
              <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                {{ computedNights() }} đêm
              </span>
            </div>
            <div class="relative">
              <p-datepicker
                [(ngModel)]="outDateObject"
                (ngModelChange)="onOutDateChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                iconDisplay="input"
                [minDate]="minCheckOutDate()"
                appendTo="body"
                [firstDayOfWeek]="1"
                placeholder="dd/mm/yyyy"
                ariaLabel="Ngày trả phòng"
                styleClass="w-full"
                inputStyleClass="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer shadow-2xs"
              />
              <i class="pi pi-calendar-times absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 truncate h-4">
              {{ getFormattedDayOfWeek(outDateObject()) }}
            </p>
          </div>
        </div>
      }

      <!-- 2. CHẾ ĐỘ THUÊ THEO GIỜ (HOURLY) -->
      @else if (normalizedRentalType() === 'Hourly') {
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start">
          <!-- Ngày sử dụng -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Ngày sử dụng
              </label>
            </div>
            <div class="relative">
              <p-datepicker
                [(ngModel)]="inDateObject"
                (ngModelChange)="onInDateChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                iconDisplay="input"
                [minDate]="minDate"
                appendTo="body"
                [firstDayOfWeek]="1"
                placeholder="dd/mm/yyyy"
                ariaLabel="Ngày nhận phòng theo giờ"
                styleClass="w-full"
                inputStyleClass="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer shadow-2xs"
              />
              <i class="pi pi-calendar absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 truncate h-4">
              {{ getFormattedDayOfWeek(inDateObject()) }}
            </p>
          </div>

          <!-- Giờ nhận phòng -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Giờ nhận
              </label>
            </div>
            <div class="relative">
              <select
                [ngModel]="checkInTime"
                (ngModelChange)="onCheckInTimeChange($event)"
                class="w-full h-11 pl-8 pr-7 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer appearance-none shadow-2xs transition-colors"
              >
                @for (slot of hourlyTimeSlots; track slot) {
                  <option [value]="slot">{{ slot }}</option>
                }
              </select>
              <i class="pi pi-clock absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
              <i class="pi pi-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs z-10"></i>
            </div>
            <p class="text-[11px] text-slate-400 mt-1 truncate h-4">Khung giờ nhận phòng</p>
          </div>

          <!-- Số giờ sử dụng -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Thời lượng
              </label>
            </div>
            <div class="relative">
              <select
                [ngModel]="durationHours"
                (ngModelChange)="onDurationHoursChange($event)"
                class="w-full h-11 pl-8 pr-7 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer appearance-none shadow-2xs transition-colors"
              >
                @for (h of durationOptions; track h) {
                  <option [value]="h">{{ h }} giờ</option>
                }
              </select>
              <i class="pi pi-hourglass absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
              <i class="pi pi-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs z-10"></i>
            </div>
            <p class="text-[11px] text-slate-400 mt-1 truncate h-4">Thời gian lưu trú</p>
          </div>
        </div>
      }

      <!-- 3. CHẾ ĐỘ THUÊ QUA ĐÊM (OVERNIGHT) -->
      @else if (normalizedRentalType() === 'Overnight') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
          <!-- Đêm nhận phòng -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Đêm nhận phòng
              </label>
              <span class="text-[11px] text-indigo-600 font-medium shrink-0">Nhận 21:00 - 23:00</span>
            </div>
            <div class="relative">
              <p-datepicker
                [(ngModel)]="inDateObject"
                (ngModelChange)="onInDateChange($event)"
                dateFormat="dd/mm/yy"
                [showIcon]="true"
                iconDisplay="input"
                [minDate]="minDate"
                appendTo="body"
                [firstDayOfWeek]="1"
                placeholder="dd/mm/yyyy"
                ariaLabel="Đêm nhận phòng qua đêm"
                styleClass="w-full"
                inputStyleClass="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs transition-colors"
              />
              <i class="pi pi-moon absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none text-sm z-10"></i>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 truncate h-4">
              {{ getFormattedDayOfWeek(inDateObject()) }}
            </p>
          </div>

          <!-- Trả phòng sáng hôm sau -->
          <div class="flex flex-col">
            <div class="flex items-center justify-between mb-1.5 h-6">
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
                Trả phòng sáng hôm sau
              </label>
              <span class="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                1 Đêm
              </span>
            </div>
            <div class="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 flex items-center justify-between shadow-2xs">
              <div class="flex items-center gap-2 truncate">
                <i class="pi pi-sun text-amber-500"></i>
                <span class="truncate">{{ overnightCheckOutDateStr() }}</span>
              </div>
              <span class="text-xs text-slate-500 shrink-0">Trước 12:00 trưa</span>
            </div>
            <p class="text-[11px] text-slate-400 mt-1 truncate h-4">
              Khung giờ trả phòng tiêu chuẩn qua đêm
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class BookingDatePickerComponent implements OnInit {
  @Input() rentalType: RentalType | string | number = 'Daily';
  @Input() checkInDate: string = '';
  @Input() checkOutDate: string = '';
  @Input() checkInTime: string = '12:00';
  @Input() durationHours: number = 2;

  @Output() checkInDateChange = new EventEmitter<string>();
  @Output() checkOutDateChange = new EventEmitter<string>();
  @Output() checkInTimeChange = new EventEmitter<string>();
  @Output() durationHoursChange = new EventEmitter<number>();
  @Output() rangeChange = new EventEmitter<BookingDateRange>();

  readonly minDate: Date = new Date();

  // Internal reactive Date objects for PrimeNG DatePicker
  readonly inDateObject = signal<Date | null>(null);
  readonly outDateObject = signal<Date | null>(null);

  readonly hourlyTimeSlots: string[] = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
  ];

  readonly durationOptions: number[] = [1, 2, 3, 4, 5, 6, 8, 12];

  readonly normalizedRentalType = computed<'Daily' | 'Hourly' | 'Overnight'>(() => {
    const val = this.rentalType;
    if (val === 'Hourly' || val === 1) return 'Hourly';
    if (val === 'Overnight' || val === 2) return 'Overnight';
    return 'Daily';
  });

  readonly minCheckOutDate = computed<Date>(() => {
    const inDate = this.inDateObject();
    if (!inDate) return new Date();
    const nextDay = new Date(inDate.getTime());
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay;
  });

  readonly computedNights = computed<number>(() => {
    const inD = this.inDateObject();
    const outD = this.outDateObject();
    if (!inD || !outD) return 1;
    const diffTime = outD.getTime() - inD.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  });

  readonly overnightCheckOutDateStr = computed<string>(() => {
    const inD = this.inDateObject();
    if (!inD) return '';
    const nextD = new Date(inD.getTime());
    nextD.setDate(nextD.getDate() + 1);
    const day = String(nextD.getDate()).padStart(2, '0');
    const month = String(nextD.getMonth() + 1).padStart(2, '0');
    const year = nextD.getFullYear();
    return `${day}/${month}/${year}`;
  });

  ngOnInit(): void {
    this.syncInitialDates();
  }

  private syncInitialDates(): void {
    const now = new Date();

    if (this.checkInDate) {
      const parsed = this.parseDateString(this.checkInDate);
      this.inDateObject.set(parsed || now);
    } else {
      this.inDateObject.set(now);
      this.checkInDateChange.emit(this.formatDateString(now));
    }

    if (this.checkOutDate) {
      const parsedOut = this.parseDateString(this.checkOutDate);
      this.outDateObject.set(parsedOut || this.calculateDefaultCheckOut(this.inDateObject() || now));
    } else {
      const defaultOut = this.calculateDefaultCheckOut(this.inDateObject() || now);
      this.outDateObject.set(defaultOut);
      this.checkOutDateChange.emit(this.formatDateString(defaultOut));
    }
  }

  private calculateDefaultCheckOut(inDate: Date): Date {
    const out = new Date(inDate.getTime());
    out.setDate(out.getDate() + 1);
    return out;
  }

  onInDateChange(date: Date | null): void {
    if (!date) return;
    this.inDateObject.set(date);
    const inStr = this.formatDateString(date);
    this.checkInDateChange.emit(inStr);

    // If checkOut is before or equal to checkIn, advance checkOut by 1 day
    const curOut = this.outDateObject();
    if (!curOut || curOut.getTime() <= date.getTime()) {
      const newOut = this.calculateDefaultCheckOut(date);
      this.outDateObject.set(newOut);
      const outStr = this.formatDateString(newOut);
      this.checkOutDateChange.emit(outStr);
    }

    this.emitRange();
  }

  onOutDateChange(date: Date | null): void {
    if (!date) return;
    const curIn = this.inDateObject();
    if (curIn && date.getTime() <= curIn.getTime()) {
      // Must be at least 1 day after check-in
      const fixedOut = this.calculateDefaultCheckOut(curIn);
      this.outDateObject.set(fixedOut);
      const outStr = this.formatDateString(fixedOut);
      this.checkOutDateChange.emit(outStr);
    } else {
      this.outDateObject.set(date);
      const outStr = this.formatDateString(date);
      this.checkOutDateChange.emit(outStr);
    }

    this.emitRange();
  }

  onCheckInTimeChange(time: string): void {
    this.checkInTimeChange.emit(time);
  }

  onDurationHoursChange(hours: any): void {
    this.durationHoursChange.emit(+hours);
  }

  private emitRange(): void {
    const inD = this.inDateObject();
    const outD = this.outDateObject();
    if (!inD || !outD) return;

    this.rangeChange.emit({
      checkInDate: this.formatDateString(inD),
      checkOutDate: this.formatDateString(outD),
      nightCount: this.computedNights()
    });
  }

  getFormattedDayOfWeek(date: Date | null): string {
    if (!date) return '';
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const d = date.getDate();
    const m = date.getMonth() + 1;
    const y = date.getFullYear();
    const dayName = dayNames[date.getDay()];
    return `${dayName}, ${d}/${m}/${y}`;
  }

  private formatDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateString(s: string): Date | null {
    if (!s) return null;
    const parts = s.split('-');
    if (parts.length !== 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const res = new Date(y, m, d);
    return isNaN(res.getTime()) ? null : res;
  }
}
