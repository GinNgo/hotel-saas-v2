import { Component, EventEmitter, HostListener, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePicker } from 'primeng/datepicker';
import {
  BUSINESS_TIMEZONE_OFFSET_HOURS,
  formatCalendarDate,
  parseCalendarDate,
  parseDateParts,
  getStartOfDayUtc,
  getStartOfNextDayUtc
} from '../../../core/utils/date-time.util';

export interface DateRangeFilterValue {
  mode: 'single' | 'range';
  fromDate: string; // Định dạng YYYY-MM-DD
  toDate: string;   // Định dạng YYYY-MM-DD
  startUtc: string; // ISO UTC bắt đầu: [start
  endExclusiveUtc: string; // ISO UTC đầu ngày tiếp theo: endExclusive)
}

// Re-export utility constants & functions for backwards-compatibility
export { BUSINESS_TIMEZONE_OFFSET_HOURS, getStartOfDayUtc, getStartOfNextDayUtc };

/**
 * Component lọc ngày dùng chung sử dụng PrimeNG p-datepicker:
 * - Thay thế date input mặc định bằng PrimeNG p-datepicker (v22).
 * - Locale tiếng Việt, tuần bắt đầu Thứ Hai.
 * - Hiển thị dd/mm/yyyy.
 * - Giữ showTime=false: Bộ lọc chỉ áp dụng cho ngày lịch [00:00:00, 00:00:00 ngày kế tiếp)
 *   theo múi giờ Asia/Ho_Chi_Minh (+07:00). Chưa hỗ trợ lọc theo giờ/phút (không trình bày như datetime hoàn chỉnh).
 * - Date filter hỗ trợ một ngày hoặc khoảng ngày, clear/reset.
 * - Áp dụng design tokens; popup không bị cắt (appendTo="body"), mobile dùng touchUI.
 * - Accessible label, keyboard/focus và thông báo validation rõ ràng.
 * - Validate YYYY-MM-DD nghiêm ngặt, từ chối 31/02, 31/04, năm không nhuận, không tự động normalize.
 * - Date-only giữ nguyên giá trị ngày lịch, không chuyển UTC tùy tiện.
 * - Quy đổi biên ngày theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7) thành [startUtc, endExclusiveUtc).
 */
@Component({
  selector: 'app-date-range-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePicker],
  template: `
    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
      <!-- Mode Toggle -->
      <div class="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0 shadow-2xs" role="group" aria-label="Chế độ lọc thời gian">
        <button
          type="button"
          (click)="setMode('single')"
          aria-label="Chế độ lọc một ngày"
          class="px-2.5 py-1 rounded-md font-medium transition-colors"
          [class.bg-emerald-600]="mode === 'single'"
          [class.text-white]="mode === 'single'"
          [class.text-slate-600]="mode !== 'single'"
          [class.hover:text-slate-900]="mode !== 'single'"
        >
          Một ngày
        </button>
        <button
          type="button"
          (click)="setMode('range')"
          aria-label="Chế độ lọc khoảng ngày"
          class="px-2.5 py-1 rounded-md font-medium transition-colors"
          [class.bg-emerald-600]="mode === 'range'"
          [class.text-white]="mode === 'range'"
          [class.text-slate-600]="mode !== 'range'"
          [class.hover:text-slate-900]="mode !== 'range'"
        >
          Khoảng ngày
        </button>
      </div>

      <!-- PrimeNG DatePicker Inputs Container -->
      <div class="flex flex-wrap items-center gap-2">
        @if (mode === 'single') {
          <div class="flex items-center gap-1.5">
            <label for="filterSingleDateInput" class="text-slate-500 font-medium whitespace-nowrap">{{ label }}:</label>
            <p-datepicker
              inputId="filterSingleDateInput"
              name="filterSingleDate"
              [(ngModel)]="fromDateValue"
              (ngModelChange)="onFromDateChange($event)"
              dateFormat="dd/mm/yy"
              [showIcon]="true"
              iconDisplay="input"
              [showClear]="true"
              [showButtonBar]="true"
              [touchUI]="isMobile()"
              appendTo="body"
              [firstDayOfWeek]="1"
              placeholder="dd/mm/yyyy"
              [ariaLabel]="label + ' (dd/mm/yyyy)'"
              styleClass="w-36 sm:w-44 text-xs"
              inputStyleClass="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-2xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        } @else {
          <div class="flex items-center gap-1.5">
            <label for="filterFromDateInput" class="text-slate-500 font-medium whitespace-nowrap">Từ ngày:</label>
            <p-datepicker
              inputId="filterFromDateInput"
              name="filterFromDate"
              [(ngModel)]="fromDateValue"
              (ngModelChange)="onFromDateChange($event)"
              dateFormat="dd/mm/yy"
              [showIcon]="true"
              iconDisplay="input"
              [showClear]="true"
              [showButtonBar]="true"
              [touchUI]="isMobile()"
              appendTo="body"
              [firstDayOfWeek]="1"
              placeholder="dd/mm/yyyy"
              ariaLabel="Từ ngày (dd/mm/yyyy)"
              styleClass="w-36 sm:w-44 text-xs"
              inputStyleClass="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-2xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div class="flex items-center gap-1.5">
            <label for="filterToDateInput" class="text-slate-500 font-medium whitespace-nowrap">Đến ngày:</label>
            <p-datepicker
              inputId="filterToDateInput"
              name="filterToDate"
              [(ngModel)]="toDateValue"
              (ngModelChange)="onToDateChange($event)"
              dateFormat="dd/mm/yy"
              [showIcon]="true"
              iconDisplay="input"
              [showClear]="true"
              [showButtonBar]="true"
              [touchUI]="isMobile()"
              appendTo="body"
              [firstDayOfWeek]="1"
              placeholder="dd/mm/yyyy"
              ariaLabel="Đến ngày (dd/mm/yyyy)"
              styleClass="w-36 sm:w-44 text-xs"
              inputStyleClass="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 shadow-2xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        }

        <!-- Reset Button -->
        @if (hasFilter()) {
          <button
            type="button"
            (click)="resetFilter()"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-200"
            title="Xóa toàn bộ bộ lọc ngày"
            aria-label="Xóa toàn bộ bộ lọc ngày"
          >
            <i class="pi pi-times text-[10px]"></i>
            <span>Xóa lọc</span>
          </button>
        }
      </div>

      <!-- Validation Error -->
      @if (errorMessage()) {
        <div class="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1 sm:mt-0" role="alert" aria-live="polite">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ errorMessage() }}</span>
        </div>
      }
    </div>
  `
})
export class DateRangeFilterComponent implements OnInit {
  @Input() label: string = 'Ngày tạo';
  @Input() initialFromDate: string = '';
  @Input() initialToDate: string = '';

  @Output() filterChange = new EventEmitter<DateRangeFilterValue | null>();

  mode: 'single' | 'range' = 'single';
  fromDate: string = '';
  toDate: string = '';

  fromDateValue: Date | null = null;
  toDateValue: Date | null = null;

  errorMessage = signal<string | null>(null);
  isMobile = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile.set(window.innerWidth < 768);
    }
  }

  ngOnInit(): void {
    if (this.initialFromDate) {
      if (parseDateParts(this.initialFromDate)) {
        this.fromDate = this.initialFromDate;
        this.fromDateValue = parseCalendarDate(this.initialFromDate);
      } else {
        this.errorMessage.set('Ngày khởi tạo không hợp lệ.');
      }
    }
    if (this.initialToDate) {
      if (parseDateParts(this.initialToDate)) {
        this.toDate = this.initialToDate;
        this.toDateValue = parseCalendarDate(this.initialToDate);
        this.mode = 'range';
      } else {
        this.errorMessage.set('Ngày kết thúc khởi tạo không hợp lệ.');
      }
    }
    if (this.fromDate || this.toDate) {
      this.onDateChange();
    }
  }

  setMode(mode: 'single' | 'range'): void {
    this.mode = mode;
    if (mode === 'single') {
      this.toDate = '';
      this.toDateValue = null;
    }
    this.onDateChange();
  }

  hasFilter(): boolean {
    return !!this.fromDate || !!this.toDate;
  }

  resetFilter(): void {
    this.fromDate = '';
    this.toDate = '';
    this.fromDateValue = null;
    this.toDateValue = null;
    this.errorMessage.set(null);
    this.filterChange.emit(null);
  }

  onFromDateChange(val: Date | null): void {
    this.fromDateValue = val;
    this.fromDate = formatCalendarDate(val);
    this.onDateChange();
  }

  onToDateChange(val: Date | null): void {
    this.toDateValue = val;
    this.toDate = formatCalendarDate(val);
    this.onDateChange();
  }

  onDateChange(): void {
    this.errorMessage.set(null);

    if (!this.fromDate && !this.toDate) {
      this.filterChange.emit(null);
      return;
    }

    if (this.mode === 'single') {
      if (!this.fromDate) {
        this.filterChange.emit(null);
        return;
      }
      if (!parseDateParts(this.fromDate)) {
        this.errorMessage.set('Ngày không hợp lệ (không tồn tại trong lịch).');
        return;
      }
      // Một ngày: [startOfDay, startOfNextDay) theo Asia/Ho_Chi_Minh (+07:00)
      const startUtc = getStartOfDayUtc(this.fromDate);
      const endExclusiveUtc = getStartOfNextDayUtc(this.fromDate);

      this.filterChange.emit({
        mode: 'single',
        fromDate: this.fromDate,
        toDate: this.fromDate,
        startUtc,
        endExclusiveUtc
      });
      return;
    }

    // Khoảng ngày:
    if (this.fromDate && this.toDate) {
      if (!parseDateParts(this.fromDate)) {
        this.errorMessage.set('Từ ngày không hợp lệ (không tồn tại trong lịch).');
        return;
      }
      if (!parseDateParts(this.toDate)) {
        this.errorMessage.set('Đến ngày không hợp lệ (không tồn tại trong lịch).');
        return;
      }
      if (this.fromDate > this.toDate) {
        this.errorMessage.set('Từ ngày không được lớn hơn Đến ngày');
        return;
      }

      const startUtc = getStartOfDayUtc(this.fromDate);
      const endExclusiveUtc = getStartOfNextDayUtc(this.toDate);

      this.filterChange.emit({
        mode: 'range',
        fromDate: this.fromDate,
        toDate: this.toDate,
        startUtc,
        endExclusiveUtc
      });
    } else if (this.fromDate && !this.toDate) {
      if (!parseDateParts(this.fromDate)) {
        this.errorMessage.set('Từ ngày không hợp lệ (không tồn tại trong lịch).');
        return;
      }
      // Chỉ có từ ngày: [startOfDay(fromDate), vô cùng)
      const startUtc = getStartOfDayUtc(this.fromDate);
      this.filterChange.emit({
        mode: 'range',
        fromDate: this.fromDate,
        toDate: '',
        startUtc,
        endExclusiveUtc: ''
      });
    } else if (!this.fromDate && this.toDate) {
      if (!parseDateParts(this.toDate)) {
        this.errorMessage.set('Đến ngày không hợp lệ (không tồn tại trong lịch).');
        return;
      }
      // Chỉ có đến ngày: (-vô cùng, startOfNextDay(toDate))
      const endExclusiveUtc = getStartOfNextDayUtc(this.toDate);
      this.filterChange.emit({
        mode: 'range',
        fromDate: '',
        toDate: this.toDate,
        startUtc: '',
        endExclusiveUtc
      });
    }
  }
}
