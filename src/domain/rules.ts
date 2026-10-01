import type { Cents, Rule, RuleCondition } from '../data/types';
import { formatCents } from '../lib/money';

/**
 * Rule matching. A rule matches when ALL its conditions match; rules run in `order`
 * and the first match wins. Amounts are compared without their sign.
 */

export interface Matchable {
  description: string;
  /** The bank's original text. Description conditions match either this or the clean name. */
  rawDescription?: string | null;
  amountCents: Cents;
}

export function conditionMatches(c: RuleCondition, tx: Matchable): boolean {
  if (c.field === 'description') {
    const v = c.value.trim().toLowerCase();
    if (!v) return false;
    return [tx.description, tx.rawDescription].some((text) => {
      if (!text) return false;
      const d = text.trim().toLowerCase();
      if (c.op === 'contains') return d.includes(v);
      if (c.op === 'starts') return d.startsWith(v);
      return d === v;
    });
  }
  const a = Math.abs(tx.amountCents);
  switch (c.op) {
    case 'equals':
      return a === c.valueCents;
    case 'greaterThan':
      return a > c.valueCents;
    case 'lessThan':
      return a < c.valueCents;
    case 'between':
      return a >= Math.min(c.valueCents, c.value2Cents) && a <= Math.max(c.valueCents, c.value2Cents);
  }
}

export function ruleMatches(rule: Rule, tx: Matchable): boolean {
  return rule.conditions.length > 0 && rule.conditions.every((c) => conditionMatches(c, tx));
}

export function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
}

/** The first rule (by order) that matches, or null. */
export function findMatchingRule(rules: Rule[], tx: Matchable): Rule | null {
  return sortRules(rules).find((r) => ruleMatches(r, tx)) ?? null;
}

/** "description contains “trader joe”", "amount is between $1,600 and $1,700" */
export function describeCondition(c: RuleCondition): string {
  if (c.field === 'description') {
    const op = c.op === 'contains' ? 'contains' : c.op === 'starts' ? 'starts with' : 'is exactly';
    return `description ${op} “${c.value}”`;
  }
  const money = (v: Cents) => formatCents(v);
  switch (c.op) {
    case 'equals':
      return `amount is ${money(c.valueCents)}`;
    case 'greaterThan':
      return `amount is over ${money(c.valueCents)}`;
    case 'lessThan':
      return `amount is under ${money(c.valueCents)}`;
    case 'between':
      return `amount is between ${money(Math.min(c.valueCents, c.value2Cents))} and ${money(Math.max(c.valueCents, c.value2Cents))}`;
  }
}
