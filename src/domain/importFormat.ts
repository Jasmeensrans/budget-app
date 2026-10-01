import type { Cents, ISODate } from '../data/types';
import { parseISODate, toISODate } from '../lib/dates';

/**
 * Bulk import. Three inputs are accepted, detected automatically:
 *
 * 1. Lines (what the AI prompt asks for), one transaction per line:
 *      2026-09-24 | Trader Joe's | -64.18 | Groceries
 *    date | description | amount | category (category may be blank)
 *    Money out is negative, money in is positive.
 *
 * 2. A bank CSV export with a header row containing Date, Description and Amount
 *    (e.g. Amex's activity.csv). Credit card exports list purchases as positive
 *    numbers, so the caller says whether to flip signs.
 *
 * 3. JSON: { "transactions": [{ "date", "amount", "description", "category", "id" }] } or a bare array.
 *
 * Amounts are in the account's own currency; conversion to USD happens after parsing.
 */

export type ImportFormat = 'lines' | 'csv' | 'json';

export interface ParsedImportRow {
  /** 1-based position among the transactions found. */
  position: number;
  date: ISODate;
  /** In the account's currency, negative = money out. */
  amountCents: Cents;
  /** Exactly as provided (the bank's text). */
  rawDescription: string;
  /** Category the AI suggested, if any. Matched to your categories by name later. */
  categoryName: string | null;
  importId: string | null;
}

export interface ParseResult {
  format: ImportFormat | null;
  rows: ParsedImportRow[];
  /** Lines that couldn't be read. */
  errors: string[];
  /** Lines skipped on purpose, like $0.00 balance checks. */
  skipped: number;
}

export interface ParseOptions {
  /** For CSV exports from credit cards, where purchases are positive. */
  positiveIsSpending?: boolean;
}

export const LINES_EXAMPLE = `2026-09-24 | Trader Joe's | -64.18 | Groceries
2026-09-23 | UBER *TRIP | -18.40 | Transport
2026-09-22 | ACH Debit: VENMO - PAYMENT | -80.00 |
2026-09-15 | ACH Deposit: ACME CORP PAYROLL | 2500.00 | Income`;

// ---------- small parsers ----------

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function validDate(y: number, m: number, d: number): ISODate | null {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return toISODate(parseISODate(iso)) === iso ? iso : null;
}

/** 2026-09-24, 09/24/2026, 9/24/26, "September 24, 2026", "Sep 24 2026". */
export function parseDate(raw: string): ISODate | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return validDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  m = s.match(/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m) {
    const month = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)];
    return month ? validDate(+m[3], month, +m[2]) : null;
  }
  return null;
}

/** "-64.18", "−$1,024.50", "– $70.93 CAD", "(12.00)", "$3,887.31" → cents. */
export function parseAmount(raw: string): Cents | null {
  let s = raw.trim().replace(/^"|"$/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[A-Za-z$€£\s]/g, '');
  if (/^[-−–—]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  }
  s = s.replace(/,/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}

/** Splits one CSV line, honoring quotes. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** Removes the ``` fences chat apps put around code blocks. */
function unwrap(text: string): string {
  const fenced = text.match(/```[a-z]*\s*\n?([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

// ---------- main parser ----------

export function parseImport(text: string, { positiveIsSpending = false }: ParseOptions = {}): ParseResult {
  const body = unwrap(text);
  if (!body) return { format: null, rows: [], errors: ['Paste some transactions first.'], skipped: 0 };

  const rows: ParsedImportRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const push = (label: string, date: string, amount: string, description: string, category: string | null, importId: string | null, flip = false) => {
    const d = parseDate(date);
    let a = parseAmount(amount);
    const problems: string[] = [];
    if (!d) problems.push(`the date “${date.trim()}” should look like 2026-09-24`);
    if (a === null) problems.push(`the amount “${amount.trim()}” should be a number like -64.18`);
    if (problems.length) {
      errors.push(`${label}: ${problems.join('; ')}.`);
      return;
    }
    if (a === 0) {
      skipped++;
      return;
    }
    if (flip) a = -a!;
    rows.push({
      position: rows.length + 1,
      date: d!,
      amountCents: a!,
      rawDescription: description.trim() || 'Untitled transaction',
      categoryName: category?.trim() || null,
      importId,
    });
  };

  // JSON
  if (body.startsWith('{') || body.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch (e) {
      return { format: 'json', rows, errors: [`That looks like JSON but can’t be read (${(e as Error).message}).`], skipped };
    }
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { transactions?: unknown })?.transactions)
        ? (data as { transactions: unknown[] }).transactions
        : null;
    if (!items) return { format: 'json', rows, errors: ['Expected a "transactions" list.'], skipped };
    items.forEach((item, i) => {
      const o = (item ?? {}) as Record<string, unknown>;
      push(
        `Transaction ${i + 1}`,
        String(o.date ?? ''),
        String(o.amount ?? ''),
        typeof o.description === 'string' ? o.description : '',
        typeof o.category === 'string' ? o.category : null,
        typeof o.id === 'string' || typeof o.id === 'number' ? String(o.id) : null,
      );
    });
    return { format: 'json', rows, errors, skipped };
  }

  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // CSV with a header row
  const header = splitCsvLine(lines[0].toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const dateCol = col('date', 'transaction date', 'posted date');
  const amountCol = col('amount');
  const descCol = col('description', 'payee', 'merchant', 'name');
  if (lines[0].includes(',') && dateCol >= 0 && amountCol >= 0) {
    const catCol = col('category');
    lines.slice(1).forEach((line, i) => {
      const cells = splitCsvLine(line);
      push(
        `Row ${i + 2}`,
        cells[dateCol] ?? '',
        cells[amountCol] ?? '',
        descCol >= 0 ? (cells[descCol] ?? '') : '',
        catCol >= 0 ? (cells[catCol] ?? null) : null,
        null,
        positiveIsSpending,
      );
    });
    return { format: 'csv', rows, errors, skipped };
  }

  // Lines: date | description | amount | category
  lines.forEach((line, i) => {
    if (line.startsWith('#')) return;
    const parts = line.split('|').map((p) => p.trim());
    if (i === 0 && parts[0].toLowerCase().includes('date') && parts.length >= 3) return; // a header line
    if (parts.length < 3) {
      errors.push(`Line ${i + 1}: expected “date | description | amount | category”.`);
      return;
    }
    // Descriptions may contain "|", so the amount is the last numeric field before an optional category.
    const last = parts[parts.length - 1];
    const lastIsAmount = parseAmount(last) !== null;
    const amount = lastIsAmount ? last : parts[parts.length - 2];
    const category = lastIsAmount ? null : last;
    const description = parts.slice(1, lastIsAmount ? -1 : -2).join(' | ');
    push(`Line ${i + 1}`, parts[0], amount, description, category, null);
  });
  return { format: 'lines', rows, errors, skipped };
}

/** The prompt to paste into ChatGPT, Gemini or Claude along with screenshots. Kept short on purpose. */
export function buildAiPrompt(categoryNames: string[]): string {
  return `List every posted transaction in these screenshots. Reply with only a code block, one line each:
YYYY-MM-DD | description | amount | category

- description: exactly as shown
- amount: negative for money out, positive for money in, digits only (e.g. -64.18)
- category: one of ${categoryNames.join(', ')}, only if it's obvious; otherwise leave it blank
- skip pending items, balances and $0.00 lines; if no year is shown, use ${new Date().getFullYear()}`;
}
