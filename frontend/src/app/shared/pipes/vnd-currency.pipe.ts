import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'vndCurrency',
  standalone: true,
})
export class VndCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, suffix = ''): string {
    if (value === null || value === undefined || value === '') {
      return `0 ₫${suffix}`;
    }

    const numeric = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numeric)) {
      return `0 ₫${suffix}`;
    }

    const rounded = Math.round(numeric);
    const normalized = Object.is(rounded, -0) ? 0 : rounded;
    const sign = normalized < 0 ? '-' : '';
    const formattedInteger = Math.abs(normalized)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${sign}${formattedInteger} ₫${suffix}`;
  }
}
