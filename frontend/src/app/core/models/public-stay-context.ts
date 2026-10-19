import { PublicPropertyDto, RentalType } from './public-booking.model';

export interface PublicStayContext {
  rentalType: RentalType;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  durationHours: number;
  guests: number;
}

export function readPublicStay(params: Record<string, unknown>): PublicStayContext {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const rentalType = params['rentalType'] ?? 'Daily';
  if (Number(params['roomsCount'] ?? 1) !== 1) throw new Error('Hiện mỗi lượt đặt hỗ trợ một phòng.');
  if (!['Hourly', 'Overnight', 'Daily'].includes(String(rentalType))) throw new Error('Hình thức thuê không hợp lệ.');
  const stay: PublicStayContext = {
    rentalType: rentalType as RentalType,
    checkInDate: String(params['checkInDate'] ?? today),
    checkOutDate: String(params['checkOutDate'] ?? tomorrow.toISOString().slice(0, 10)),
    checkInTime: String(params['checkInTime'] ?? '14:00'),
    durationHours: Number(params['durationHours'] ?? params['hours'] ?? 2),
    guests: Number(params['guests'] ?? 2),
  };
  for (const date of [stay.checkInDate, stay.checkOutDate]) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Ngày lưu trú không hợp lệ.');
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(stay.checkInTime)) throw new Error('Giờ nhận phòng không hợp lệ.');
  if (!Number.isInteger(stay.guests) || stay.guests < 1 || stay.guests > 20) throw new Error('Số khách phải từ 1 đến 20.');
  if (!Number.isInteger(stay.durationHours) || stay.durationHours < 1 || stay.durationHours > 24) throw new Error('Số giờ thuê không hợp lệ.');
  if (stay.rentalType !== 'Hourly' && stay.checkOutDate <= stay.checkInDate) throw new Error('Ngày trả phòng phải sau ngày nhận phòng.');
  if (stay.checkInDate < today) throw new Error('Ngày nhận phòng không được ở quá khứ.');
  return stay;
}

export function publicStayInterval(stay: PublicStayContext, property: PublicPropertyDto) {
  const supported = property.allowedRentalTypes?.includes(stay.rentalType) ??
    (stay.rentalType === 'Hourly' ? property.allowHourlyBooking : stay.rentalType === 'Overnight' ? property.allowOvernightBooking : property.allowDailyBooking);
  if (!supported) throw new Error('Cơ sở không hỗ trợ hình thức thuê này.');
  const startClock = stay.rentalType === 'Hourly' ? stay.checkInTime : property.checkInTime?.slice(0, 5);
  const endClock = property.checkOutTime?.slice(0, 5);
  if (!startClock || (stay.rentalType !== 'Hourly' && !endClock)) throw new Error('Cơ sở chưa công bố giờ nhận/trả phòng.');
  const start = new Date(`${stay.checkInDate}T${startClock}:00+07:00`);
  const end = stay.rentalType === 'Hourly'
    ? new Date(start.getTime() + stay.durationHours * 3600000)
    : new Date(`${stay.checkOutDate}T${endClock}:00+07:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || start <= new Date()) throw new Error('Khoảng thời gian lưu trú không hợp lệ hoặc đã qua.');
  return { rentalType: stay.rentalType === 'Hourly' ? 1 : stay.rentalType === 'Overnight' ? 2 : 3,
    startAtUtc: start.toISOString(), endAtUtc: end.toISOString(),
    checkInDate: stay.checkInDate, checkOutDate: stay.checkOutDate };
}
