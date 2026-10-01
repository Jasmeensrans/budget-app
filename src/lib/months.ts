import type { ISODate, MonthKey } from '../data/types';
import { toISODate, todayISO } from './dates';

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthOf(todayISO());
}

function parts(key: MonthKey): [number, number] {
  const [y, m] = key.split('-').map(Number);
  return [y, m];
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = parts(key);
  return monthOf(toISODate(new Date(y, m - 1 + n, 1)));
}

export function daysInMonth(key: MonthKey): number {
  const [y, m] = parts(key);
  return new Date(y, m, 0).getDate();
}

export function dateInMonth(key: MonthKey, day: number): ISODate {
  return `${key}-${String(day).padStart(2, '0')}`;
}

export function monthStart(key: MonthKey): ISODate {
  return dateInMonth(key, 1);
}

export function monthEnd(key: MonthKey): ISODate {
  return dateInMonth(key, daysInMonth(key));
}

/** Whole months from `from` to `to` (Sep → Nov = 2). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const [y1, m1] = parts(from);
  const [y2, m2] = parts(to);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** Inclusive list of months from `from` to `to`. Empty if `to` is before `from`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let k = from; k <= to; k = addMonths(k, 1)) out.push(k);
  return out;
}

const longFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const nameFmt = new Intl.DateTimeFormat('en-US', { month: 'long' });

function toDate(key: MonthKey): Date {
  const [y, m] = parts(key);
  return new Date(y, m - 1, 1);
}

/** "September 2026" */
export function formatMonthLong(key: MonthKey): string {
  return longFmt.format(toDate(key));
}

/** "Mar 2027" */
export function formatMonthShort(key: MonthKey): string {
  return shortFmt.format(toDate(key));
}

/** "September" */
export function formatMonthName(key: MonthKey): string {
  return nameFmt.format(toDate(key));
}
