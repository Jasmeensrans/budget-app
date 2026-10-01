import type { Cents } from '../data/types';

const MINUS = '−'; // a true minus sign, not a hyphen

const withCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const wholeDollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

interface FormatOptions {
  /** Prefix positive amounts with "+" (money in). */
  showPlus?: boolean;
  /** Round to whole dollars: $3,144 instead of $3,144.00. */
  whole?: boolean;
}

/** −$64.18, +$2,840.00, $3,144 */
export function formatCents(cents: Cents, { showPlus = false, whole = false }: FormatOptions = {}): string {
  const body = (whole ? wholeDollars : withCents).format(Math.abs(cents) / 100);
  if (cents < 0 && body !== '$0' && body !== '$0.00') return MINUS + body;
  if (showPlus && cents > 0) return '+' + body;
  return body;
}

/** Axis labels: $4k, $2.5k, $500. */
export function formatCompact(cents: Cents): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) return `$${Number((dollars / 1000).toFixed(1))}k`;
  return `$${Math.round(dollars)}`;
}

/**
 * Parses what someone types into an amount field: "24.5", "$1,024.50", "24".
 * Returns cents, or null if it isn't a valid amount with at most 2 decimals.
 */
export function parseAmountToCents(raw: string, { allowZero = false } = {}): Cents | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (cents === 0 && !allowZero) return null;
  return cents;
}

/** Dollars (as typed in import files) to integer cents. */
export function dollarsToCents(dollars: number): Cents {
  return Math.round(dollars * 100);
}
