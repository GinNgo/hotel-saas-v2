import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { DateRangeFilterComponent, DateRangeFilterValue } from './date-range-filter.component';

describe('DateRangeFilterComponent Logic', () => {
  it('initializes with default single mode and empty values', () => {
    const comp = new DateRangeFilterComponent();
    expect(comp.mode).toBe('single');
    expect(comp.fromDate).toBe('');
    expect(comp.toDate).toBe('');
    expect(comp.hasFilter()).toBe(false);
  });

  it('switches between single and range modes cleanly', () => {
    const comp = new DateRangeFilterComponent();
    comp.setMode('range');
    expect(comp.mode).toBe('range');

    comp.setMode('single');
    expect(comp.mode).toBe('single');
    expect(comp.toDate).toBe('');
    expect(comp.toDateValue).toBeNull();
  });

  it('emits accurate Vietnam UTC interval for single date mode (e.g. 2026-10-09)', () => {
    const comp = new DateRangeFilterComponent();
    let emitted: DateRangeFilterValue | null = null;
    comp.filterChange.subscribe(val => { emitted = val; });

    comp.fromDate = '2026-10-09';
    comp.onDateChange();

    expect(emitted).not.toBeNull();
    expect(emitted!.mode).toBe('single');
    expect(emitted!.fromDate).toBe('2026-10-09');
    expect(emitted!.toDate).toBe('2026-10-09');
    expect(emitted!.startUtc).toBe('2026-10-08T17:00:00.000Z');
    expect(emitted!.endExclusiveUtc).toBe('2026-10-09T17:00:00.000Z');
  });

  it('emits error and rejects invalid date like 2026-02-31 without auto-normalizing', () => {
    const comp = new DateRangeFilterComponent();
    let emitted: DateRangeFilterValue | null = null;
    comp.filterChange.subscribe(val => { emitted = val; });

    comp.fromDate = '2026-02-31';
    comp.onDateChange();

    expect(emitted).toBeNull();
    expect(comp.errorMessage()).toBe('Ngày không hợp lệ (không tồn tại trong lịch).');
  });

  it('emits validation error when fromDate > toDate in range mode', () => {
    const comp = new DateRangeFilterComponent();
    comp.mode = 'range';
    comp.fromDate = '2026-10-15';
    comp.toDate = '2026-10-10';

    let emitted: DateRangeFilterValue | null = null;
    comp.filterChange.subscribe(val => { emitted = val; });

    comp.onDateChange();

    expect(emitted).toBeNull();
    expect(comp.errorMessage()).toBe('Từ ngày không được lớn hơn Đến ngày');
  });

  it('emits null and clears error when resetFilter is called', () => {
    const comp = new DateRangeFilterComponent();
    comp.fromDate = '2026-10-09';
    comp.errorMessage.set('Lỗi trước đó');

    let emitted: DateRangeFilterValue | null = 'not-null' as any;
    comp.filterChange.subscribe(val => { emitted = val; });

    comp.resetFilter();

    expect(comp.fromDate).toBe('');
    expect(comp.toDate).toBe('');
    expect(comp.fromDateValue).toBeNull();
    expect(comp.toDateValue).toBeNull();
    expect(comp.errorMessage()).toBeNull();
    expect(emitted).toBeNull();
  });
});
