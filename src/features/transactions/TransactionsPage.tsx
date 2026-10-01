import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CategoryPicker } from '../../components/CategoryPicker';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { CategoryTag } from '../../components/Tag';
import { useToast } from '../../components/Toast';
import {
  addTransaction,
  createRule,
  deleteTransaction,
  restoreTransaction,
  setTransactionCategory,
  updateTransaction,
} from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Cents, Transaction } from '../../data/types';
import { makeKindOf, periodTotals } from '../../domain/budgets';
import { findMatchingRule } from '../../domain/rules';
import { cx } from '../../lib/cx';
import { formatDayHeading } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { formatMonthLong, monthOf } from '../../lib/months';
import { TransactionForm, type TransactionFormResult } from './TransactionForm';

interface DayGroup {
  date: string;
  totalCents: Cents;
  items: Transaction[];
}

function groupByDay(transactions: Transaction[]): DayGroup[] {
  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const groups: DayGroup[] = [];
  for (const tx of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.date) {
      last.items.push(tx);
      last.totalCents += tx.amountCents;
    } else {
      groups.push({ date: tx.date, totalCents: tx.amountCents, items: [tx] });
    }
  }
  return groups;
}

type Filter = 'all' | 'uncategorized';

export function TransactionsPage() {
  const transactions = useCollection('transactions');
  const categories = useCollection('categories');
  const rules = useCollection('rules');
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [freshId, setFreshId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const updateParams = (change: (p: URLSearchParams) => void, replace = false) => {
    const next = new URLSearchParams(params);
    change(next);
    setParams(next, { replace });
  };

  const isAdding = params.get('new') === '1';
  const editId = params.get('edit');
  const editing = editId ? transactions.find((t) => t.id === editId) : undefined;
  /** A category id, or 'none' for uncategorized. Set by the dashboard's spending-by-category card. */
  const categoryFilter = params.get('category');
  /** "YYYY-MM", or null for all months. */
  const monthFilter = params.get('month');
  /** An account id, 'none' for no account, or null for all accounts. */
  const accountFilter = params.get('account');

  const openForm = () =>
    updateParams((p) => {
      p.delete('edit');
      p.set('new', '1');
    });
  const openEdit = (id: string) =>
    updateParams((p) => {
      p.delete('new');
      p.set('edit', id);
    });
  const closeForm = () =>
    updateParams((p) => {
      p.delete('new');
      p.delete('edit');
    }, true);

  const accounts = useCollection('accounts');
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const months = useMemo(
    () => [...new Set(transactions.map((t) => monthOf(t.date)))].sort().reverse(),
    [transactions],
  );
  const inMonth = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!monthFilter || t.date.startsWith(monthFilter)) &&
          (!accountFilter || (accountFilter === 'none' ? !t.accountId : t.accountId === accountFilter)),
      ),
    [transactions, monthFilter, accountFilter],
  );
  const uncategorized = inMonth.filter((t) => !t.categoryId).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inMonth.filter((t) => {
      if (filter === 'uncategorized' && t.categoryId) return false;
      if (categoryFilter === 'none' && t.categoryId) return false;
      if (categoryFilter && categoryFilter !== 'none' && t.categoryId !== categoryFilter) return false;
      return !q || t.description.toLowerCase().includes(q) || t.note.toLowerCase().includes(q);
    });
  }, [inMonth, filter, query, categoryFilter]);
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const spent = useMemo(
    () => periodTotals(inMonth, makeKindOf(categories), '0000-01-01', '9999-12-31').spentCents,
    [inMonth, categories],
  );
  const filteredCategory = categoryFilter && categoryFilter !== 'none' ? categoryById.get(categoryFilter) : undefined;

  async function maybeCreateRule(result: TransactionFormResult) {
    if (!result.createRuleFor) return false;
    await createRule({
      categoryId: result.createRuleFor.categoryId,
      conditions: [{ field: 'description', op: 'contains', value: result.createRuleFor.description.toLowerCase() }],
    });
    return true;
  }

  async function handleSave(result: TransactionFormResult) {
    const ruleCreated = await maybeCreateRule(result);
    const suffix = ruleCreated ? ' · rule created' : '';
    if (editing) {
      await updateTransaction(editing.id, result.tx);
      toast(`Saved ${result.tx.description}${suffix}`);
    } else {
      const tx = await addTransaction(result.tx);
      setFreshId(tx.id);
      toast(`Added ${tx.description} · ${formatCents(tx.amountCents, { showPlus: true })}${suffix}`);
    }
    closeForm();
  }

  async function handleDelete(tx: Transaction) {
    await deleteTransaction(tx.id);
    if (editId === tx.id) closeForm();
    toast(`Deleted ${tx.description}`, {
      label: 'Undo',
      run: async () => {
        const restored = await restoreTransaction(tx);
        setFreshId(restored.id);
      },
    });
  }

  async function handleCategoryChange(tx: Transaction, categoryId: string | null) {
    await setTransactionCategory(tx.id, categoryId);
    const category = categoryId ? categoryById.get(categoryId) : undefined;
    if (!category) {
      toast(`Removed the category from ${tx.description}`);
      return;
    }
    if (findMatchingRule(rules, tx)) {
      toast(`${tx.description} is now ${category.name}`);
      return;
    }
    toast(`${tx.description} is now ${category.name}. Do this every time?`, {
      label: 'Create rule',
      run: async () => {
        await createRule({
          categoryId: category.id,
          conditions: [{ field: 'description', op: 'contains', value: tx.description.toLowerCase() }],
        });
        toast(`Rule created: “${tx.description}” → ${category.name}`);
      },
    });
  }

  const filters: Array<[Filter, string]> = [
    ['all', 'All'],
    ['uncategorized', 'Uncategorized'],
  ];
  const formOpen = isAdding || !!editing;

  return (
    <div className={cx('tx-layout', formOpen && 'tx-layout--editing')}>
      <div className="page">
        <PageHeader
          title="Transactions"
          hideActionsOnMobile
          subtitle={
            inMonth.length > 0
              ? `${monthFilter ? formatMonthLong(monthFilter) : 'All time'} · ${inMonth.length} transactions · ${formatCents(spent, { whole: true })} spent`
              : undefined
          }
          actions={
            <>
              <Button icon="upload" onClick={() => navigate('/import')}>
                Bulk import
              </Button>
              <Button variant="primary" icon="plus" onClick={openForm}>
                Add transaction
              </Button>
            </>
          }
        />

        {transactions.length === 0 ? (
          <div className="card empty-card">
            <span className="coming-soon__icon">
              <Icon name="list" size={24} />
            </span>
            <p className="coming-soon__title">No transactions yet</p>
            <p className="coming-soon__body">Add one by hand, or import a batch from screenshots or a bank CSV.</p>
            <div className="empty-actions">
              <Button variant="primary" icon="plus" onClick={openForm}>
                Add transaction
              </Button>
              <Button icon="upload" onClick={() => navigate('/import')}>
                Bulk import
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="toolbar">
              <label className="search">
                <Icon name="search" size={16} />
                <span className="sr-only">Search transactions</span>
                <input placeholder="Search transactions" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label className="month-select">
                <span className="sr-only">Month</span>
                <select
                  className="input"
                  value={monthFilter ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateParams((p) => {
                      if (value) p.set('month', value);
                      else p.delete('month');
                    });
                  }}
                >
                  <option value="">All months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLong(m)}
                    </option>
                  ))}
                </select>
              </label>
              {accounts.length > 0 && (
                <label className="month-select">
                  <span className="sr-only">Account</span>
                  <select
                    className="input"
                    value={accountFilter ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      updateParams((p) => {
                        if (value) p.set('account', value);
                        else p.delete('account');
                      });
                    }}
                  >
                    <option value="">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                    <option value="none">No account</option>
                  </select>
                </label>
              )}
              {categoryFilter && (
                <button
                  type="button"
                  className="filter-chip filter-chip--active-category"
                  onClick={() => updateParams((p) => p.delete('category'))}
                >
                  {filteredCategory ? (
                    <CategoryTag color={filteredCategory.color} icon={filteredCategory.icon}>
                      {filteredCategory.name}
                    </CategoryTag>
                  ) : (
                    <span className="tag tag--empty">Uncategorized</span>
                  )}
                  <Icon name="close" size={14} strokeWidth={2.4} />
                  <span className="sr-only">Clear category filter</span>
                </button>
              )}
              <div className="filter-chips" role="group" aria-label="Filter">
                {filters.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="filter-chip"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                    {value === 'uncategorized' && uncategorized > 0 && <span className="count-badge">{uncategorized}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="card tx-card">
              {groups.length === 0 && <p className="muted card-empty">No transactions match.</p>}
              {groups.map((g) => (
                <section key={g.date} className="tx-group" aria-label={formatDayHeading(g.date)}>
                  <div className="tx-group__header">
                    <span>{formatDayHeading(g.date)}</span>
                    <span>{formatCents(g.totalCents, { showPlus: true })}</span>
                  </div>
                  <ul className="tx-group__items">
                    {g.items.map((tx) => (
                      <li
                        key={tx.id}
                        className={cx('tx-row', tx.id === freshId && 'tx-row--fresh', tx.id === editId && 'tx-row--selected')}
                      >
                        <button type="button" className="tx-row__main" onClick={() => openEdit(tx.id)}>
                          <span className="tx-row__desc">{tx.description}</span>
                          {tx.note && <span className="tx-row__meta">{tx.note}</span>}
                        </button>
                        <div className="tx-row__category">
                          <CategoryPicker
                            value={tx.categoryId}
                            label={`Category for ${tx.description}`}
                            onChange={(id) => handleCategoryChange(tx, id)}
                          />
                        </div>
                        <span className={cx('tx-row__amount amount', tx.amountCents > 0 && 'amount--in')}>
                          {formatCents(tx.amountCents, { showPlus: true })}
                          {tx.original && (
                            <span className="tx-row__original">
                              {formatCents(tx.original.amountCents, { showPlus: true })} {tx.original.currency}
                            </span>
                          )}
                        </span>
                        <Button
                          variant="text"
                          size="sm"
                          icon="trash"
                          className="tx-row__delete"
                          aria-label={`Delete ${tx.description}`}
                          onClick={() => handleDelete(tx)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <aside className="tx-editor" aria-label={editing ? 'Edit transaction' : 'New transaction'}>
          <TransactionForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onSave={handleSave}
            onDelete={editing ? () => handleDelete(editing) : undefined}
            onClose={closeForm}
          />
        </aside>
      )}
    </div>
  );
}
