import { describe, expect, it } from 'vitest';
import { VndCurrencyPipe } from './vnd-currency.pipe';

describe('VndCurrencyPipe', () => {
  const pipe = new VndCurrencyPipe();

  it('formats integer VND amounts with dot grouping and đ symbol', () => {
    expect(pipe.transform(1200000)).toBe('1.200.000 ₫');
    expect(pipe.transform(0)).toBe('0 ₫');
    expect(pipe.transform(500)).toBe('500 ₫');
  });

  it('rounds fractional values cleanly and handles string/negative inputs', () => {
    expect(pipe.transform(1851851.85)).toBe('1.851.852 ₫');
    expect(pipe.transform(-250000)).toBe('-250.000 ₫');
    expect(pipe.transform('3500000')).toBe('3.500.000 ₫');
    expect(pipe.transform(-0.1)).toBe('0 ₫');
  });

  it('appends optional suffix and falls back cleanly for empty or invalid values', () => {
    expect(pipe.transform(1200000, '/đêm')).toBe('1.200.000 ₫/đêm');
    expect(pipe.transform(null)).toBe('0 ₫');
    expect(pipe.transform(undefined)).toBe('0 ₫');
    expect(pipe.transform('')).toBe('0 ₫');
    expect(pipe.transform(Number.NaN)).toBe('0 ₫');
  });
});
