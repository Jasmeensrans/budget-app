import type { IconName } from '../components/Icon';
import type { CategoryColorName } from '../lib/categoryColors';

/**
 * The data contract. Every persisted document is described here.
 *
 * Storage layout (same for localStorage today and Firestore later):
 *   users/{uid}/{collection}/{id}
 *
 * Rules that keep documents Firestore-safe:
 * - JSON values only: no Date objects, no `undefined` (use null), no functions.
 * - Money is always integer cents (`...Cents`), never floating dollars.
 * - Dates are strings: ISODate "2026-09-24", MonthKey "2026-09", Timestamp ISO 8601.
 * - Anything derivable (totals, balances, progress) is computed, never stored.
 */

export type ID = string;
/** Local calendar date, "YYYY-MM-DD". */
export type ISODate = string;
/** Calendar month, "YYYY-MM". */
export type MonthKey = string;
/** ISO 8601 date-time, e.g. "2026-09-24T18:00:00.000Z". */
export type Timestamp = string;
/** Integer number of cents. Negative = money out. */
export type Cents = number;
/** Currencies an account can hold. Everything is reported in USD. */
export type CurrencyCode = 'USD' | 'CAD';

export const SCHEMA_VERSION = 1;

/** Fields the data layer sets on every document. */
export interface DocMeta {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------- categories ----------

/**
 * spending: counts toward spending (positive amounts here are refunds and reduce it).
 * income: counts as money in.
 * transfer: money moving between your own accounts, like card payments. Counted as neither.
 */
export type CategoryKind = 'spending' | 'income' | 'transfer';

export interface Category extends DocMeta {
  name: string;
  color: CategoryColorName;
  icon: IconName;
  kind: CategoryKind;
}

// ---------- accounts ----------

export type AccountKind = 'checking' | 'savings' | 'credit';

export interface Account extends DocMeta {
  name: string;
  currency: CurrencyCode;
  /** Credit card CSV exports list purchases as positive numbers; the importer flips them. */
  kind: AccountKind;
}

// ---------- settings (a single document) ----------

export interface AppSettings extends DocMeta {
  /** How many US dollars one Canadian dollar buys, e.g. 0.72. */
  cadToUsd: number;
}

// ---------- transactions ----------

export type TransactionSource = 'manual' | 'import';

export interface Transaction extends DocMeta {
  date: ISODate;
  /** Negative = money out, positive = money in. */
  amountCents: Cents;
  /** Clean display name, e.g. "Trader Joe's". */
  description: string;
  /** Text exactly as the bank showed it, e.g. "AplPay TRADER JOE S #552". Rules match both. */
  rawDescription: string | null;
  /** null = uncategorized. */
  categoryId: ID | null;
  accountId: ID | null;
  /** Set when the account isn't in USD: the amount before conversion. `amountCents` is always USD. */
  original: { amountCents: Cents; currency: CurrencyCode } | null;
  note: string;
  source: TransactionSource;
  /** Optional id from the import file, used to skip duplicates. */
  importId: string | null;
}

// ---------- budgets ----------

export type BudgetPeriod = 'month' | 'year';

/** A goal per month or per year. Nothing carries over. */
export interface FixedBudget extends DocMeta {
  type: 'fixed';
  categoryId: ID;
  amountCents: Cents;
  period: BudgetPeriod;
}

/** Adds a set amount every month; unspent money carries over. */
export interface FlexibleBudget extends DocMeta {
  type: 'flexible';
  categoryId: ID;
  /** Added each month (written as a Contribution when the month starts). */
  amountCents: Cents;
  startMonth: MonthKey;
  startBalanceCents: Cents;
}

/** Saves toward a target by a month; the monthly amount is worked out from what's left. */
export interface SinkingBudget extends DocMeta {
  type: 'sinking';
  categoryId: ID;
  targetCents: Cents;
  targetMonth: MonthKey;
  startMonth: MonthKey;
  startBalanceCents: Cents;
}

export type Budget = FixedBudget | FlexibleBudget | SinkingBudget;
export type RolloverBudget = FlexibleBudget | SinkingBudget;
export type BudgetType = Budget['type'];

/**
 * Money put into a flexible or sinking budget. One `monthly` record per month
 * (written when the month starts), plus optional manual `adjustment`s.
 * Stored as a top-level collection with `budgetId` so it's one query in Firestore.
 */
export interface Contribution extends DocMeta {
  budgetId: ID;
  month: MonthKey;
  amountCents: Cents;
  kind: 'monthly' | 'adjustment';
  note: string;
}

// ---------- rules (used from Phase 2) ----------

export type RuleCondition =
  | { field: 'description'; op: 'contains' | 'starts' | 'is'; value: string }
  | { field: 'amount'; op: 'equals' | 'greaterThan' | 'lessThan'; valueCents: Cents }
  | { field: 'amount'; op: 'between'; valueCents: Cents; value2Cents: Cents }
  /** Inclusive date range, e.g. a trip: everything spent from `from` to `to`. */
  | { field: 'date'; op: 'between'; from: ISODate; to: ISODate };

export interface Rule extends DocMeta {
  /** Lower runs first; the first matching rule wins. */
  order: number;
  categoryId: ID;
  /** All conditions must match. Amounts are compared without their sign. */
  conditions: RuleCondition[];
}

// ---------- collection registry ----------

export interface Collections {
  accounts: Account;
  settings: AppSettings;
  categories: Category;
  transactions: Transaction;
  budgets: Budget;
  contributions: Contribution;
  rules: Rule;
}

export type CollectionName = keyof Collections;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A document before the data layer assigns id and timestamps. */
export type NewDoc<T> = DistributiveOmit<T, keyof DocMeta>;

/** Fields you may change on an existing document. */
export type DocPatch<T> = Partial<NewDoc<T>>;
