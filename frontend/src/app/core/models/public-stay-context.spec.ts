import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicPropertyDto } from './public-booking.model';
import { publicStayInterval, readPublicStay } from './public-stay-context';

describe('Public stay contract', () => {
  afterEach(() => vi.useRealTimers());
  const property = { allowedRentalTypes: ['Daily', 'Hourly', 'Overnight'], checkInTime: '14:00:00', checkOutTime: '12:00:00' } as PublicPropertyDto;
  function params() {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-18T00:00:00Z'));
    return { checkInDate: '2026-10-20', checkOutDate: '2026-10-22', guests: '4' };
  }
  it('uses Vietnam property hours and preserves a multi-night stay', () => {
    expect(publicStayInterval(readPublicStay(params()), property)).toEqual({ rentalType: 3,
      startAtUtc: '2026-10-20T07:00:00.000Z', endAtUtc: '2026-10-22T05:00:00.000Z', checkInDate: '2026-10-20', checkOutDate: '2026-10-22' });
  });
  it('normalizes legacy hours and crosses midnight correctly', () => {
    const stay = readPublicStay({ ...params(), rentalType: 'Hourly', hours: '4', checkInTime: '23:00' });
    expect(stay.guests).toBe(4);
    expect(publicStayInterval(stay, property).endAtUtc).toBe('2026-10-20T20:00:00.000Z');
  });
  it('rejects invalid dates, occupancy and unsupported modes', () => {
    expect(() => readPublicStay({ ...params(), checkInDate: '2026-02-30' })).toThrow();
    expect(() => readPublicStay({ ...params(), guests: 0 })).toThrow();
    expect(() => publicStayInterval(readPublicStay(params()), { ...property, allowedRentalTypes: ['Hourly'] })).toThrow();
  });
});
