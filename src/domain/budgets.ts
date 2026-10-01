import type {
  Budget,
  Category,
  CategoryKind,
  Cents,
  Contribution,
  ISODate,
  MonthKey,
  NewDoc,
  RolloverBudget,
  SinkingBudget,
  Transaction,
} from '../data/types';
import { dayOfMonth, parseISODate, todayISO } from '../lib/dates';
import { addMonths, currentMonthKey, monthEnd, monthRange, monthsBetween, monthStart } from '../lib/months';

/**
 * Pure budget math. No React, no storage: everything takes plain data in and returns numbers,
 * so it can be unit-tested and reused unchanged once Firestore is connected.
 */

// ---------- spending ----------

/** Money spent in a category between two dates (inclusive). Refunds (positive amounts) reduce it. */
export function netSpendCents(txs: Transaction[], categoryId: string, from: ISODate, to: ISODate): Cents {
  let spent = 0;
  for (const t of txs) {
    if (t.categoryId === categoryId && t.date >= from && t.date <= to) spent -= t.amountCents;
  }
  return spent;
}

/** Decides how a transaction counts: spending, income, or a transfer that doesn't count. */
export type KindOf = (t: Pick<Transaction, 'categoryId' | 'amountCents'>) => CategoryKind;

/**
 * Uses each category's kind. Uncategorized money in counts as income and money out as
 * spending. A positive amount in a spending category is a refund and reduces spending.
 */
export function makeKindOf(categories: Category[]): KindOf {
  const kinds = new Map(categories.map((c) => [c.id, c.kind]));
  return (t) => (t.categoryId && kinds.get(t.categoryId)) || (t.amountCents > 0 ? 'income' : 'spending');
}

export interface PeriodTotals {
  spentCents: Cents;
  incomeCents: Cents;
}

/** Spending (net of refunds) and income between two dates. Transfers are left out. */
export function periodTotals(txs: Transaction[], kindOf: KindOf, from: ISODate, to: ISODate): PeriodTotals {
  let spent = 0;
  let income = 0;
  for (const t of txs) {
    if (t.date < from || t.date > to) continue;
    const kind = kindOf(t);
    if (kind === 'spending') spent -= t.amountCents;
    else if (kind === 'income') income += t.amountCents;
  }
  return { spentCents: spent, incomeCents: income };
}

export interface CategorySpend {
  /** null = uncategorized. */
  categoryId: string | null;
  /** Net spending (refunds subtract). */
  spentCents: Cents;
  count: number;
}

/**
 * Spending per category between two dates, budget or not, largest first.
 * Only spending counts: income and transfers are left out.
 */
export function spendingByCategory(txs: Transaction[], kindOf: KindOf, from: ISODate, to: ISODate): CategorySpend[] {
  const byCategory = new Map<string | null, CategorySpend>();
  for (const t of txs) {
    if (t.date < from || t.date > to || kindOf(t) !== 'spending') continue;
    let entry = byCategory.get(t.categoryId);
    if (!entry) {
      entry = { categoryId: t.categoryId, spentCents: 0, count: 0 };
      byCategory.set(t.categoryId, entry);
    }
    entry.spentCents -= t.amountCents;
    entry.count++;
  }
  return [...byCategory.values()].filter((e) => e.spentCents > 0).sort((a, b) => b.spentCents - a.spentCents);
}

/** Running total of spending for each day of the month. Index 0 = day 1. */
export function cumulativeSpendByDay(txs: Transaction[], kindOf: KindOf, month: MonthKey, throughDay: number): Cents[] {
  const perDay = new Array<number>(throughDay).fill(0);
  const from = monthStart(month);
  const to = monthEnd(month);
  for (const t of txs) {
    if (t.date < from || t.date > to || kindOf(t) !== 'spending') continue;
    const d = dayOfMonth(t.date);
    if (d <= throughDay) perDay[d - 1] -= t.amountCents;
  }
  for (let i = 1; i < perDay.length; i++) perDay[i] += perDay[i - 1];
  return perDay;
}

// ---------- budget status ----------

export interface BudgetStatus {
  budget: Budget;
  /** What's available this period (limit, or carried over + added for rollover budgets). */
  availableCents: Cents;
  spentCents: Cents;
  leftCents: Cents;
  /** spent / available; above 1 means over budget. */
  ratio: number;
  over: boolean;
  /** Yearly fixed budgets: where an even pace would put you (0–1). */
  paceRatio: number | null;
  /** Rollover budgets only. */
  carriedInCents: Cents;
  addedCents: Cents;
}

function contributionTotal(contributions: Contribution[], budgetId: string, filter: (month: MonthKey) => boolean): Cents {
  let total = 0;
  for (const c of contributions) if (c.budgetId === budgetId && filter(c.month)) total += c.amountCents;
  return total;
}

/** Balance of a rollover budget at the very start of `month`. */
export function rolloverBalanceBefore(
  b: RolloverBudget,
  contributions: Contribution[],
  txs: Transaction[],
  month: MonthKey,
): Cents {
  if (month <= b.startMonth) return b.startBalanceCents;
  const added = contributionTotal(contributions, b.id, (m) => m < month);
  const spent = netSpendCents(txs, b.categoryId, monthStart(b.startMonth), monthEnd(addMonths(month, -1)));
  return b.startBalanceCents + added - spent;
}

function yearProgress(month: MonthKey): number {
  if (month === currentMonthKey()) {
    const today = parseISODate(todayISO());
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear() + 1, 0, 1);
    return (today.getTime() - start.getTime()) / (end.getTime() - start.getTime());
  }
  return Number(month.slice(5, 7)) / 12;
}

export function budgetStatus(
  b: Budget,
  txs: Transaction[],
  contributions: Contribution[],
  month: MonthKey,
): BudgetStatus {
  let available: Cents;
  let spent: Cents;
  let paceRatio: number | null = null;
  let carriedIn = 0;
  let added = 0;

  if (b.type === 'fixed') {
    available = b.amountCents;
    if (b.period === 'month') {
      spent = netSpendCents(txs, b.categoryId, monthStart(month), monthEnd(month));
    } else {
      const year = month.slice(0, 4);
      spent = netSpendCents(txs, b.categoryId, `${year}-01-01`, monthEnd(month));
      paceRatio = yearProgress(month);
    }
  } else if (month < b.startMonth) {
    available = 0;
    spent = 0;
  } else {
    carriedIn = rolloverBalanceBefore(b, contributions, txs, month);
    added = contributionTotal(contributions, b.id, (m) => m === month);
    available = carriedIn + added;
    spent = netSpendCents(txs, b.categoryId, monthStart(month), monthEnd(month));
  }

  const left = available - spent;
  return {
    budget: b,
    availableCents: available,
    spentCents: spent,
    leftCents: left,
    ratio: available > 0 ? spent / available : spent > 0 ? Infinity : 0,
    over: left < 0,
    paceRatio,
    carriedInCents: carriedIn,
    addedCents: added,
  };
}

// ---------- monthly contributions ----------

/** Sinking funds: what to put in this month to reach the target on time (rounded up to whole dollars). */
export function sinkingMonthlyCents(b: SinkingBudget, balanceBefore: Cents, month: MonthKey): Cents {
  const monthsLeft = monthsBetween(month, b.targetMonth) + 1;
  if (monthsLeft <= 0) return 0;
  const remaining = b.targetCents - balanceBefore;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthsLeft / 100) * 100;
}

/**
 * The `monthly` contributions that should exist but don't yet, from each rollover budget's
 * start month through `throughMonth`. Past records are never rewritten, so changing a budget's
 * amount only affects months that haven't been written yet.
 */
export function planMissingContributions(
  budgets: Budget[],
  contributions: Contribution[],
  txs: Transaction[],
  throughMonth: MonthKey,
): NewDoc<Contribution>[] {
  const planned: NewDoc<Contribution>[] = [];
  for (const b of budgets) {
    if (b.type === 'fixed') continue;
    const known = contributions.filter((c) => c.budgetId === b.id);
    const hasMonthly = new Set(known.filter((c) => c.kind === 'monthly').map((c) => c.month));
    const running: Contribution[] = [...known];

    for (const month of monthRange(b.startMonth, throughMonth)) {
      if (hasMonthly.has(month)) continue;
      const amount =
        b.type === 'flexible'
          ? b.amountCents
          : sinkingMonthlyCents(b, rolloverBalanceBefore(b, running, txs, month), month);
      const doc: NewDoc<Contribution> = { budgetId: b.id, month, amountCents: amount, kind: 'monthly', note: '' };
      planned.push(doc);
      running.push({ ...doc, id: `planned-${month}`, createdAt: '', updatedAt: '' });
    }
  }
  return planned;
}

// ---------- month overview ----------

export interface MonthOverview {
  /** Fixed monthly limits plus what's available in rollover budgets. */
  budgetedCents: Cents;
  /** Spent in budgeted categories (monthly fixed + rollover). */
  spentInBudgetsCents: Cents;
  leftCents: Cents;
  onTrack: number;
  over: number;
}

export function monthOverview(statuses: BudgetStatus[]): MonthOverview {
  let budgeted = 0;
  let spent = 0;
  let onTrack = 0;
  let over = 0;
  for (const s of statuses) {
    if (s.budget.type === 'fixed' && s.budget.period === 'year') continue;
    budgeted += s.availableCents;
    spent += s.spentCents;
    if (s.over) over++;
    else onTrack++;
  }
  return { budgetedCents: budgeted, spentInBudgetsCents: spent, leftCents: budgeted - spent, onTrack, over };
}
