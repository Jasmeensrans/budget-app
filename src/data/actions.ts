import { useEffect } from 'react';
import { planMissingContributions } from '../domain/budgets';
import { findMatchingRule, sortRules } from '../domain/rules';
import type { CategoryColorName } from '../lib/categoryColors';
import { currentMonthKey } from '../lib/months';
import { createLocalRepository } from './localRepository';
import { current, repo, useCollection, useCollectionsLoaded, whenLoaded } from './live';
import { DEFAULT_CATEGORIES } from './defaults';
import type {
  Account,
  AppSettings,
  Budget,
  Category,
  Cents,
  CollectionName,
  DocPatch,
  ID,
  MonthKey,
  NewDoc,
  Rule,
  Transaction,
} from './types';
import { SCHEMA_VERSION } from './types';

/** Every write the app performs. Screens call these instead of touching `repo` directly. */

// ---------- transactions ----------

export function addTransaction(input: NewDoc<Transaction>) {
  return repo.create('transactions', input);
}

export function updateTransaction(id: ID, patch: DocPatch<Transaction>) {
  return repo.update('transactions', id, patch);
}

export function deleteTransaction(id: ID) {
  return repo.remove('transactions', id);
}

/** Puts a deleted transaction back (for Undo). It gets a new id. */
export function restoreTransaction(tx: Transaction) {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = tx;
  return repo.create('transactions', rest);
}

export function setTransactionCategory(id: ID, categoryId: ID | null) {
  return repo.update('transactions', id, { categoryId });
}

// ---------- categories ----------

const NEW_CATEGORY_COLORS: CategoryColorName[] = ['green', 'pink', 'blue', 'purple', 'peach', 'yellow', 'teal', 'brown', 'sky'];

/** A color for a new category, preferring ones not in use yet. */
export function nextCategoryColor(existing: Category[] = current('categories')): CategoryColorName {
  const used = new Set(existing.map((c) => c.color));
  return NEW_CATEGORY_COLORS.find((c) => !used.has(c)) ?? NEW_CATEGORY_COLORS[existing.length % NEW_CATEGORY_COLORS.length];
}

export function createCategory(input: NewDoc<Category>) {
  return repo.create('categories', input);
}

export function updateCategory(id: ID, patch: DocPatch<Category>) {
  return repo.update('categories', id, patch);
}

/** Deletes a category: its transactions become uncategorized, and its budget and rules are removed. */
export async function deleteCategory(id: ID) {
  const txPatches = current('transactions')
    .filter((t) => t.categoryId === id)
    .map((t) => ({ id: t.id, patch: { categoryId: null } }));
  await repo.updateMany('transactions', txPatches);
  for (const b of current('budgets').filter((b) => b.categoryId === id)) await deleteBudget(b.id);
  await repo.removeMany(
    'rules',
    current('rules')
      .filter((r) => r.categoryId === id)
      .map((r) => r.id),
  );
  await repo.remove('categories', id);
}

let seedingCategories: Promise<unknown> | null = null;

/**
 * First run: create the starter categories. Waits for categories to load first,
 * so an account whose data is still arriving from the cloud never gets duplicates.
 */
export async function ensureDefaultCategories() {
  await whenLoaded('categories');
  if (current('categories').length > 0) return;
  seedingCategories ??= repo.createMany('categories', DEFAULT_CATEGORIES);
  await seedingCategories;
}

// ---------- rules ----------

export function createRule(input: Omit<NewDoc<Rule>, 'order'>) {
  const order = Math.max(0, ...current('rules').map((r) => r.order)) + 1;
  return repo.create('rules', { ...input, order });
}

export function updateRule(id: ID, patch: DocPatch<Rule>) {
  return repo.update('rules', id, patch);
}

export function deleteRule(id: ID) {
  return repo.remove('rules', id);
}

/** Moves a rule one place up (-1) or down (+1) in the running order. */
export async function moveRule(id: ID, direction: -1 | 1) {
  const sorted = sortRules(current('rules'));
  const i = sorted.findIndex((r) => r.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= sorted.length) return;
  [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
  await repo.updateMany(
    'rules',
    sorted.map((r, index) => ({ id: r.id, patch: { order: index + 1 } })),
  );
}

/**
 * Runs the rules over existing transactions and returns how many changed.
 * By default only uncategorized ones are touched, so manual choices stay.
 * With `onlyRuleId`, only transactions that rule wins are changed (rule order still applies,
 * so a higher rule keeps its matches).
 */
export async function applyRules({
  onlyUncategorized = true,
  onlyRuleId = null as ID | null,
}: { onlyUncategorized?: boolean; onlyRuleId?: ID | null } = {}) {
  const rules = current('rules');
  const patches: Array<{ id: ID; patch: { categoryId: ID } }> = [];
  for (const t of current('transactions')) {
    if (onlyUncategorized && t.categoryId) continue;
    const rule = findMatchingRule(rules, t);
    if (!rule || (onlyRuleId && rule.id !== onlyRuleId)) continue;
    if (rule.categoryId !== t.categoryId) patches.push({ id: t.id, patch: { categoryId: rule.categoryId } });
  }
  await repo.updateMany('transactions', patches);
  return patches.length;
}

// ---------- import ----------

export interface ImportRowInput extends NewDoc<Transaction> {
  /** Set when the row should go into a category that doesn't exist yet. */
  newCategoryName: string | null;
}

/** Creates any new categories, then all transactions, in two batches. */
export async function importTransactions(rows: ImportRowInput[]) {
  const names = [...new Set(rows.map((r) => r.newCategoryName).filter((n): n is string => !!n))];
  const existing = current('categories');
  const colorsSoFar = [...existing];
  const newCategories: NewDoc<Category>[] = names.map((name) => {
    const color = nextCategoryColor(colorsSoFar);
    colorsSoFar.push({ id: '', name, color, icon: 'tag', kind: 'spending', createdAt: '', updatedAt: '' });
    return { name, color, icon: 'tag', kind: 'spending' };
  });
  const created = newCategories.length ? await repo.createMany('categories', newCategories) : [];
  const idByName = new Map(created.map((c) => [c.name, c.id]));
  const txs: NewDoc<Transaction>[] = rows.map(({ newCategoryName, ...tx }) => ({
    ...tx,
    categoryId: newCategoryName ? (idByName.get(newCategoryName) ?? null) : tx.categoryId,
  }));
  await repo.createMany('transactions', txs);
  return { transactions: txs.length, categories: created.length };
}

// ---------- budgets ----------

export function createBudget(input: NewDoc<Budget>) {
  return repo.create('budgets', input);
}

export function updateBudget(id: ID, patch: DocPatch<Budget>) {
  return repo.update('budgets', id, patch);
}

/** Deletes a budget and its contribution history. */
export async function deleteBudget(id: ID) {
  const contributionIds = current('contributions')
    .filter((c) => c.budgetId === id)
    .map((c) => c.id);
  await repo.removeMany('contributions', contributionIds);
  await repo.remove('budgets', id);
}

/** Manually add money to (positive) or take money out of (negative) a flexible or sinking budget. */
export function addAdjustment(budgetId: ID, month: MonthKey, amountCents: Cents, note: string) {
  return repo.create('contributions', { budgetId, month, amountCents, kind: 'adjustment', note });
}

const inFlight = new Set<string>();

/**
 * Keeps flexible and sinking budgets topped up: writes each month's contribution
 * the first time the app is opened in that month. Mount once, in the app shell.
 */
export function useContributionSync() {
  const budgets = useCollection('budgets');
  const contributions = useCollection('contributions');
  const transactions = useCollection('transactions');
  // Planning before everything has loaded would re-write contributions that already exist.
  const ready = useCollectionsLoaded(['budgets', 'contributions', 'transactions']);

  useEffect(() => {
    if (!ready) return;
    const missing = planMissingContributions(budgets, contributions, transactions, currentMonthKey()).filter((c) => {
      const key = `${c.budgetId}:${c.month}`;
      if (inFlight.has(key)) return false;
      inFlight.add(key);
      return true;
    });
    if (missing.length > 0) void repo.createMany('contributions', missing);
  }, [ready, budgets, contributions, transactions]);
}

// ---------- accounts & settings ----------

export function createAccount(input: NewDoc<Account>) {
  return repo.create('accounts', input);
}

export function updateAccount(id: ID, patch: DocPatch<Account>) {
  return repo.update('accounts', id, patch);
}

/** Deletes an account. Its transactions stay, without an account. */
export async function deleteAccount(id: ID) {
  const patches = current('transactions')
    .filter((t) => t.accountId === id)
    .map((t) => ({ id: t.id, patch: { accountId: null } }));
  await repo.updateMany('transactions', patches);
  await repo.remove('accounts', id);
}

export const DEFAULT_SETTINGS: NewDoc<AppSettings> = { cadToUsd: 0.72 };

/** The single settings document, with defaults filled in. */
export function useSettings(): NewDoc<AppSettings> {
  const docs = useCollection('settings');
  return { ...DEFAULT_SETTINGS, ...(docs[0] ?? {}) };
}

export async function saveSettings(patch: DocPatch<AppSettings>) {
  const existing = current('settings')[0];
  if (existing) await repo.update('settings', existing.id, patch);
  else await repo.create('settings', { ...DEFAULT_SETTINGS, ...patch });
}

// ---------- whole-account ----------

const ALL_COLLECTIONS: CollectionName[] = ['accounts', 'settings', 'categories', 'transactions', 'budgets', 'contributions', 'rules'];

/** A full JSON backup of every collection. */
export function exportAll() {
  return {
    app: 'my-budget',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    collections: Object.fromEntries(ALL_COLLECTIONS.map((name) => [name, current(name)])),
  };
}

/**
 * Replaces everything with the contents of a backup made by `exportAll`.
 * Ids are kept, so links between categories, rules, budgets and transactions survive.
 */
export async function restoreBackup(backup: unknown) {
  const data = backup as { app?: string; collections?: Record<string, unknown> };
  if (!data || typeof data !== 'object' || !data.collections || typeof data.collections !== 'object') {
    throw new Error('This file isn’t a My Budget backup.');
  }
  for (const name of ALL_COLLECTIONS) {
    const docs = data.collections[name];
    if (docs !== undefined && !Array.isArray(docs)) throw new Error(`“${name}” in the backup isn’t a list.`);
  }
  for (const name of ALL_COLLECTIONS) {
    await repo.removeMany(
      name,
      current(name).map((d) => d.id),
    );
    const docs = (data.collections[name] ?? []) as never[];
    if (docs.length) await repo.putMany(name, docs);
  }
  inFlight.clear();
}

export interface MergeResult {
  accounts: number;
  categories: number;
  rules: number;
  transactions: number;
  skippedTransactions: number;
}

/**
 * Adds a file's data to what's already here, without deleting anything (unlike restore).
 * - Accounts and categories are matched by name; only missing ones are created.
 * - Rules are added unless an identical rule (same conditions and category) exists.
 *   Their `order` places them among existing rules (e.g. 17.5 sits between 17 and 18),
 *   then all rules are renumbered.
 * - A transaction is skipped if you already have one with the same date, amount and bank text
 *   (counted one for one, so identical same-day purchases are kept).
 * - Budgets, contributions and settings in the file are ignored.
 */
export async function mergeBackup(backup: unknown): Promise<MergeResult> {
  const data = backup as { collections?: Record<string, unknown> };
  if (!data || typeof data !== 'object' || !data.collections || typeof data.collections !== 'object') {
    throw new Error('This file isn’t a My Budget data file.');
  }
  const col = data.collections as {
    accounts?: Account[];
    categories?: Category[];
    rules?: Rule[];
    transactions?: Transaction[];
  };
  const byName = <T extends { name: string }>(items: T[], name: string) =>
    items.find((i) => i.name.trim().toLowerCase() === name.trim().toLowerCase());

  // Accounts
  const accountIds = new Map<string, string>();
  let accountsAdded = 0;
  for (const a of col.accounts ?? []) {
    const existing = byName(current('accounts'), a.name);
    if (existing) accountIds.set(a.id, existing.id);
    else {
      const created = await repo.create('accounts', { name: a.name, currency: a.currency, kind: a.kind });
      accountIds.set(a.id, created.id);
      accountsAdded++;
    }
  }

  // Categories
  const categoryIds = new Map<string, string>();
  const newCategories: Category[] = [];
  for (const c of col.categories ?? []) {
    const existing = byName(current('categories'), c.name);
    if (existing) categoryIds.set(c.id, existing.id);
    else if (!byName(newCategories, c.name)) newCategories.push(c);
  }
  if (newCategories.length) {
    const created = await repo.createMany(
      'categories',
      newCategories.map((c) => ({ name: c.name, color: c.color, icon: c.icon, kind: c.kind ?? 'spending' })),
    );
    newCategories.forEach((c, i) => categoryIds.set(c.id, created[i].id));
  }
  for (const c of col.categories ?? []) {
    if (!categoryIds.has(c.id)) categoryIds.set(c.id, categoryIds.get(byName(newCategories, c.name)!.id)!);
  }
  const categoriesAdded = newCategories.length;

  // Rules
  const ruleKey = (r: Pick<Rule, 'conditions' | 'categoryId'>) => JSON.stringify([r.categoryId, r.conditions]);
  const existingRules = current('rules');
  const known = new Set(existingRules.map(ruleKey));
  const newRules: NewDoc<Rule>[] = [];
  for (const r of [...(col.rules ?? [])].sort((a, b) => a.order - b.order)) {
    const categoryId = categoryIds.get(r.categoryId);
    if (!categoryId) continue;
    const candidate = { conditions: r.conditions, categoryId };
    if (known.has(ruleKey(candidate))) continue;
    known.add(ruleKey(candidate));
    newRules.push({ ...candidate, order: r.order });
  }
  const createdRules: Rule[] = newRules.length ? await repo.createMany('rules', newRules) : [];
  if (createdRules.length) {
    const all = sortRules([...existingRules.filter((r) => !createdRules.some((c) => c.id === r.id)), ...createdRules]);
    await repo.updateMany(
      'rules',
      all.map((r, i) => ({ id: r.id, patch: { order: i + 1 } })),
    );
  }

  // Transactions
  const fingerprint = (t: Pick<Transaction, 'date' | 'amountCents' | 'rawDescription' | 'description'>) =>
    `${t.date}|${t.amountCents}|${(t.rawDescription ?? t.description).toLowerCase()}`;
  // Count what's already here, so two identical purchases on the same day stay two:
  // each existing copy cancels exactly one copy in the file.
  const existing = new Map<string, number>();
  for (const t of current('transactions')) existing.set(fingerprint(t), (existing.get(fingerprint(t)) ?? 0) + 1);
  const toAdd: NewDoc<Transaction>[] = [];
  let skipped = 0;
  for (const t of col.transactions ?? []) {
    const left = existing.get(fingerprint(t)) ?? 0;
    if (left > 0) {
      existing.set(fingerprint(t), left - 1);
      skipped++;
      continue;
    }
    toAdd.push({
      date: t.date,
      amountCents: t.amountCents,
      description: t.description,
      rawDescription: t.rawDescription ?? null,
      categoryId: t.categoryId ? (categoryIds.get(t.categoryId) ?? null) : null,
      accountId: t.accountId ? (accountIds.get(t.accountId) ?? null) : null,
      original: t.original ?? null,
      note: t.note ?? '',
      source: t.source ?? 'import',
      importId: t.importId ?? null,
    });
  }
  if (toAdd.length) await repo.createMany('transactions', toAdd);

  return {
    accounts: accountsAdded,
    categories: categoriesAdded,
    rules: createdRules.length,
    transactions: toAdd.length,
    skippedTransactions: skipped,
  };
}

/** What this browser has saved locally (from before signing in). */
export async function readLocalData() {
  const local = createLocalRepository();
  const data: Record<string, unknown[]> = {};
  for (const name of ALL_COLLECTIONS) {
    data[name] = await new Promise<unknown[]>((resolve) => {
      let unsubscribe: (() => void) | null = null;
      unsubscribe = local.subscribe(name, (docs) => {
        resolve(docs);
        unsubscribe?.();
      });
    });
  }
  return data as { [K in CollectionName]: unknown[] };
}

/**
 * Copies this browser's local data into the signed-in account. Ids are kept, so running
 * it twice overwrites rather than duplicates. The account's starter categories are
 * replaced so your own categories (and the rules pointing at them) win.
 */
export async function copyLocalDataToCloud() {
  const local = await readLocalData();
  const starterIds = current('categories').map((c) => c.id);
  await repo.removeMany('categories', starterIds);
  for (const name of ALL_COLLECTIONS) {
    const docs = local[name] as never[];
    if (docs.length) await repo.putMany(name, docs);
  }
  inFlight.clear();
  return { transactions: local.transactions.length, categories: local.categories.length, rules: local.rules.length };
}

/** Deletes everything, then recreates the starter categories. */
export async function deleteAllData() {
  for (const name of ALL_COLLECTIONS) {
    await repo.removeMany(
      name,
      current(name).map((d) => d.id),
    );
  }
  inFlight.clear();
  seedingCategories = null;
  await ensureDefaultCategories();
}

