import type { ISODate } from '../data/types';

/** Today as a local YYYY-MM-DD string (not UTC, so late evenings don't roll over). */
export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as a local date. `new Date('2026-09-24')` would be UTC midnight. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayOfMonth(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

const dayHeading = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** "Today", "Yesterday", or "Tuesday, Sep 22". */
export function formatDayHeading(iso: ISODate): string {
  if (iso === todayISO()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === toISODate(yesterday)) return 'Yesterday';
  return dayHeading.format(parseISODate(iso));
}

/** "Sep 24" */
export function formatShortDate(iso: ISODate): string {
  return shortDate.format(parseISODate(iso));
}

/** "Good morning" / "Good afternoon" / "Good evening" */
export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
