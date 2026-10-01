import { useId, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { createAccount, deleteAccount, updateAccount } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Account, AccountKind, CurrencyCode } from '../../data/types';
import { makeKindOf, periodTotals } from '../../domain/budgets';
import { formatShortDate } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import { currentMonthKey, formatMonthName, monthEnd, monthStart } from '../../lib/months';

export const ACCOUNT_KINDS: Array<{ kind: AccountKind; label: string; icon: IconName; help: string }> = [
  { kind: 'checking', label: 'Checking', icon: 'bank', help: 'Everyday bank account.' },
  { kind: 'savings', label: 'Savings', icon: 'piggy', help: 'Savings or investment cash.' },
  {
    kind: 'credit',
    label: 'Credit card',
    icon: 'card',
    help: 'When you upload this card’s CSV export, positive amounts are read as purchases.',
  },
];

const kindInfo = (kind: AccountKind) => ACCOUNT_KINDS.find((k) => k.kind === kind) ?? ACCOUNT_KINDS[0];

export function AccountsPage() {
  const accounts = useCollection('accounts');
  const transactions = useCollection('transactions');
  const categories = useCollection('categories');
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const editId = params.get('edit');
  const editing = editId ? accounts.find((a) => a.id === editId) : undefined;
  const close = () => setParams({}, { replace: true });

  const month = currentMonthKey();
  const stats = useMemo(() => {
    const kindOf = makeKindOf(categories);
    const byAccount = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const key = t.accountId ?? '';
      byAccount.set(key, [...(byAccount.get(key) ?? []), t]);
    }
    return new Map(
      [...byAccount].map(([key, txs]) => {
        const totals = periodTotals(txs, kindOf, monthStart(month), monthEnd(month));
        const last = txs.reduce((max, t) => (t.date > max ? t.date : max), '');
        return [key, { count: txs.length, spent: totals.spentCents, income: totals.incomeCents, last }];
      }),
    );
  }, [transactions, categories, month]);
  const unassigned = stats.get('');

  return (
    <div className="page">
      <PageHeader
        title="Accounts"
        subtitle="Where your transactions come from. Pick one when you import or add a transaction."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
            New account
          </Button>
        }
      />

      {accounts.length === 0 ? (
        <div className="card empty-card">
          <span className="coming-soon__icon">
            <Icon name="bank" size={24} />
          </span>
          <p className="coming-soon__title">No accounts yet</p>
          <p className="coming-soon__body">Add your checking account, credit cards and savings so you can tell where each transaction came from.</p>
          <div className="empty-actions">
            <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
              New account
            </Button>
          </div>
        </div>
      ) : (
        <div className="account-grid">
          {accounts.map((a) => {
            const s = stats.get(a.id);
            const info = kindInfo(a.kind);
            return (
              <div key={a.id} className="card account-card">
                <button type="button" className="account-card__main" onClick={() => setParams({ edit: a.id })}>
                  <span className="icon-badge account-card__icon">
                    <Icon name={info.icon} size={20} />
                  </span>
                  <span className="account-card__text">
                    <span className="account-card__name">{a.name}</span>
                    <span className="muted">
                      {info.label} · {a.currency}
                    </span>
                  </span>
                  <Icon name="pencil" size={16} className="category-card__edit" />
                </button>
                <dl className="account-card__stats">
                  <div>
                    <dt>Spent in {formatMonthName(month)}</dt>
                    <dd>{formatCents(s?.spent ?? 0, { whole: true })}</dd>
                  </div>
                  <div>
                    <dt>Money in</dt>
                    <dd className="text-good">{formatCents(s?.income ?? 0, { whole: true })}</dd>
                  </div>
                  <div>
                    <dt>Transactions</dt>
                    <dd>{s?.count ?? 0}</dd>
                  </div>
                </dl>
                <div className="account-card__footer">
                  <span className="muted">{s?.last ? `Latest ${formatShortDate(s.last)}` : 'No transactions yet'}</span>
                  <Link to={`/transactions?account=${a.id}`} className="link-strong">
                    View transactions
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unassigned && unassigned.count > 0 && (
        <p className="muted">
          {unassigned.count} transaction{unassigned.count === 1 ? ' has' : 's have'} no account.{' '}
          <Link to="/transactions?account=none">See them</Link>, then open one to set its account.
        </p>
      )}

      {(creating || editing) && (
        <Sheet title={editing ? `Edit ${editing.name}` : 'New account'} onClose={close}>
          <AccountForm
            key={editing?.id ?? 'new'}
            initial={editing}
            existingNames={accounts.filter((a) => a.id !== editing?.id).map((a) => a.name.toLowerCase())}
            transactionCount={editing ? (stats.get(editing.id)?.count ?? 0) : 0}
            onDone={close}
          />
        </Sheet>
      )}
    </div>
  );
}

function AccountForm({
  initial,
  existingNames,
  transactionCount,
  onDone,
}: {
  initial?: Account;
  existingNames: string[];
  transactionCount: number;
  onDone: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<AccountKind>(initial?.kind ?? 'checking');
  const [currency, setCurrency] = useState<CurrencyCode>(initial?.currency ?? 'USD');
  const [submitted, setSubmitted] = useState(false);

  const trimmed = name.trim();
  const error = !trimmed
    ? 'Give it a name, like “Amex” or “Chase checking”'
    : existingNames.includes(trimmed.toLowerCase())
      ? 'There’s already an account with that name'
      : null;
  const currencyLocked = !!initial && transactionCount > 0 && currency !== initial.currency;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    if (initial) {
      await updateAccount(initial.id, { name: trimmed, kind, currency });
      toast(`Saved ${trimmed}`);
    } else {
      await createAccount({ name: trimmed, kind, currency });
      toast(`Added ${trimmed}`);
    }
    onDone();
  }

  async function handleDelete() {
    if (!initial) return;
    const note = transactionCount > 0 ? ` Its ${transactionCount} transactions stay, just without an account.` : '';
    const ok = await confirm({ title: `Delete ${initial.name}?`, body: note.trim() || undefined, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await deleteAccount(initial.id);
    toast(`Deleted ${initial.name}`);
    onDone();
  }

  return (
    <form className="sheet-form" onSubmit={handleSubmit} noValidate>
      <div className="sheet__body">
        <div className="field">
          <label htmlFor={`${id}-name`} className="field__label">
            Name
          </label>
          <input
            id={`${id}-name`}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amex"
            autoFocus
            aria-invalid={submitted && error ? true : undefined}
          />
          {submitted && error && <span className="field__error">{error}</span>}
        </div>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">Type</legend>
          <div className="segmented segmented--3" role="group" aria-label="Account type">
            {ACCOUNT_KINDS.map((k) => (
              <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>
                {k.label}
              </button>
            ))}
          </div>
          <p className="muted type-hint">{kindInfo(kind).help}</p>
        </fieldset>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">Currency</legend>
          <div className="segmented" role="group" aria-label="Currency">
            {(['USD', 'CAD'] as CurrencyCode[]).map((c) => (
              <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}>
                {c}
              </button>
            ))}
          </div>
          <p className="muted type-hint">
            {currencyLocked
              ? 'Heads up: transactions already in this account keep the amounts they were saved with.'
              : currency === 'CAD'
                ? 'Amounts are converted to USD with the rate in Settings, and keep their CAD amount too.'
                : 'Amounts are used as they are.'}
          </p>
        </fieldset>

        {initial && (
          <Button variant="text" icon="trash" className="tx-form__delete" onClick={handleDelete}>
            Delete account
          </Button>
        )}
      </div>
      <div className="sheet__footer">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" className="sheet__submit">
          {initial ? 'Save changes' : 'Add account'}
        </Button>
      </div>
    </form>
  );
}
