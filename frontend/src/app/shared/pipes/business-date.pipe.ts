import { Pipe, PipeTransform } from '@angular/core';
import { formatBusinessDate, formatBusinessDateTime } from '../../core/utils/date-time.util';

/**
 * Pipe định dạng timestamp thành chuỗi Ngày & Giờ (dd/mm/yyyy HH:mm, 24h)
 * theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7).
 */
@Pipe({
  name: 'businessDateTime',
  standalone: true
})
export class BusinessDateTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return formatBusinessDateTime(value);
  }
}

/**
 * Pipe định dạng timestamp thành chuỗi Ngày (dd/mm/yyyy)
 * theo múi giờ nghiệp vụ Asia/Ho_Chi_Minh (UTC+7).
 */
@Pipe({
  name: 'businessDate',
  standalone: true
})
export class BusinessDatePipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    return formatBusinessDate(value);
  }
}
