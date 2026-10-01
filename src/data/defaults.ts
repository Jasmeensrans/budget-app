import type { Category, NewDoc } from './types';

/** Categories a brand-new setup starts with. */

export const DEFAULT_CATEGORIES: NewDoc<Category>[] = [
  { name: 'Groceries', color: 'green', icon: 'cart', kind: 'spending' },
  { name: 'Dining out', color: 'pink', icon: 'utensils', kind: 'spending' },
  { name: 'Transport', color: 'blue', icon: 'car', kind: 'spending' },
  { name: 'Shopping', color: 'purple', icon: 'bag', kind: 'spending' },
  { name: 'Entertainment', color: 'peach', icon: 'ticket', kind: 'spending' },
  { name: 'Bills', color: 'yellow', icon: 'receipt', kind: 'spending' },
  { name: 'Gifts', color: 'pink', icon: 'gift', kind: 'spending' },
  { name: 'Health', color: 'teal', icon: 'heart', kind: 'spending' },
  { name: 'Rent', color: 'brown', icon: 'home', kind: 'spending' },
  { name: 'Travel', color: 'sky', icon: 'globe', kind: 'spending' },
  { name: 'Income', color: 'brand', icon: 'dollar', kind: 'income' },
  { name: 'Transfers', color: 'sky', icon: 'refresh', kind: 'transfer' },
];
