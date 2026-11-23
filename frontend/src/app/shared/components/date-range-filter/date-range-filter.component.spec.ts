import '@angular/compiler';
import { SimpleChange } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
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

  it('clears DatePicker values when parent resets initialFromDate and initialToDate via ngOnChanges', () => {
    const comp = new DateRangeFilterComponent();
    comp.mode = 'range';
    comp.fromDate = '2026-10-01';
    comp.toDate = '2026-10-31';
    comp.fromDateValue = new Date(2026, 9, 1, 12, 0, 0);
    comp.toDateValue = new Date(2026, 9, 31, 12, 0, 0);
    comp.activePreset.set('30d');

    const emitSpy = vi.fn();
    comp.filterChange.subscribe(emitSpy);

    comp.initialFromDate = '';
    comp.initialToDate = '';
    comp.ngOnChanges({
      initialFromDate: new SimpleChange('2026-10-01', '', false),
      initialToDate: new SimpleChange('2026-10-31', '', false)
    });

    expect(comp.fromDate).toBe('');
    expect(comp.toDate).toBe('');
    expect(comp.fromDateValue).toBeNull();
    expect(comp.toDateValue).toBeNull();
    expect(comp.activePreset()).toBeNull();
    expect(comp.hasFilter()).toBe(false);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('keeps single mode intact when parent echoes single-date selection back via inputs', () => {
    const comp = new DateRangeFilterComponent();
    comp.mode = 'single';
    comp.fromDate = '2026-10-09';
    comp.fromDateValue = new Date(2026, 9, 9, 12, 0, 0);

    comp.initialFromDate = '2026-10-09';
    comp.initialToDate = '2026-10-09';
    comp.ngOnChanges({
      initialFromDate: new SimpleChange('', '2026-10-09', false),
      initialToDate: new SimpleChange('', '2026-10-09', false)
    });

    expect(comp.mode).toBe('single');
    expect(comp.fromDate).toBe('2026-10-09');
  });

  it('applies quick presets (Hôm nay, 7 ngày, 30 ngày) and emits immediately', () => {
    const comp = new DateRangeFilterComponent();
    const emissions: Array<DateRangeFilterValue | null> = [];
    comp.filterChange.subscribe(val => emissions.push(val));

    // 2026-11-23 10:00 UTC => 2026-11-23 17:00 Asia/Ho_Chi_Minh
    const refNow = new Date('2026-11-23T10:00:00.000Z');

    comp.applyPreset('today', refNow);
    expect(comp.mode).toBe('single');
    expect(comp.activePreset()).toBe('today');
    expect(emissions[0]).toEqual({
      mode: 'single',
      fromDate: '2026-11-23',
      toDate: '2026-11-23',
      startUtc: '2026-11-22T17:00:00.000Z',
      endExclusiveUtc: '2026-11-23T17:00:00.000Z'
    });

    comp.applyPreset('7d', refNow);
    expect(comp.mode).toBe('range');
    expect(comp.activePreset()).toBe('7d');
    expect(emissions[1]).toEqual({
      mode: 'range',
      fromDate: '2026-11-17',
      toDate: '2026-11-23',
      startUtc: '2026-11-16T17:00:00.000Z',
      endExclusiveUtc: '2026-11-23T17:00:00.000Z'
    });

    comp.applyPreset('30d', refNow);
    expect(comp.mode).toBe('range');
    expect(comp.activePreset()).toBe('30d');
    expect(emissions[2]).toEqual({
      mode: 'range',
      fromDate: '2026-10-25',
      toDate: '2026-11-23',
      startUtc: '2026-10-24T17:00:00.000Z',
      endExclusiveUtc: '2026-11-23T17:00:00.000Z'
    });
  });
});
