import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useSettings } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { NewDoc, Transaction } from '../../data/types';
import { describeCondition, findMatchingRule } from '../../domain/rules';
import { CATEGORY_COLORS } from '../../lib/categoryColors';
import { cx } from '../../lib/cx';
import { todayISO } from '../../lib/dates';
import { formatCents, parseAmountToCents } from '../../lib/money';

const LAST_ACCOUNT_KEY = 'budget-app:last-account';

function lastAccountId(): string | null {
  try {
    return localStorage.getItem(LAST_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

type Direction = 'out' | 'in';

export interface TransactionFormResult {
  tx: NewDoc<Transaction>;
  /** Set when the person ticked "Always file … under …". */
  createRuleFor: { description: string; categoryId: string } | null;
}

interface TransactionFormProps {
  /** Present when editing an existing transaction. */
  initial?: Transaction;
  onSave: (result: TransactionFormResult) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function TransactionForm({ initial, onSave, onDelete, onClose }: TransactionFormProps) {
  const categories = useCollection('categories');
  const rules = useCollection('rules');
  const accounts = useCollection('accounts');
  const settings = useSettings();
  const id = useId();
  const amountRef = useRef<HTMLInputElement>(null);
  const editing = !!initial;

  const [direction, setDirection] = useState<Direction>(initial && initial.amountCents > 0 ? 'in' : 'out');
  // CAD transactions are edited in CAD, their original currency.
  const [amount, setAmount] = useState(
    initial ? (Math.abs(initial.original?.amountCents ?? initial.amountCents) / 100).toFixed(2) : '',
  );
  const [accountId, setAccountId] = useState<string | null>(() => {
    if (initial) return initial.accountId;
    const last = lastAccountId();
    return accounts.some((a) => a.id === last) ? last : (accounts[0]?.id ?? null);
  });
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  /** Once someone picks a category by hand, rules stop overriding it. */
  const [picked, setPicked] = useState(editing);
  const [note, setNote] = useState(initial?.note ?? '');
  const [makeRule, setMakeRule] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? 'USD';
  const parsed = parseAmountToCents(amount);
  /** In the account's currency. */
  const signed = parsed === null ? 0 : direction === 'out' ? -parsed : parsed;
  const unchangedOriginal =
    !!initial?.original && initial.original.currency === currency && initial.original.amountCents === signed;
  /** Always USD. An unchanged CAD amount keeps the conversion it was saved with. */
  const usd = currency === 'USD' ? signed : unchangedOriginal ? initial!.amountCents : Math.round(signed * settings.cadToUsd);
  const rule = description.trim()
    ? findMatchingRule(rules, { description, rawDescription: initial?.rawDescription, amountCents: usd })
    : null;
  const effectiveCategoryId = picked ? categoryId : (rule?.categoryId ?? categoryId);
  const ruleApplied = !picked && !!rule;
  const effectiveCategory = categories.find((c) => c.id === effectiveCategoryId);
  const canOfferRule = !!description.trim() && !!effectiveCategoryId && !rule;

  const amountError = submitted && parsed === null ? 'Enter an amount like 24.50' : null;
  const dateError = submitted && !date ? 'Pick a date' : null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (parsed === null || !date) {
      if (parsed === null) amountRef.current?.focus();
      return;
    }
    try {
      if (accountId) localStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    } catch {
      // Remembering the account is only a convenience.
    }
    onSave({
      tx: {
        date,
        amountCents: usd,
        description: description.trim() || 'Untitled transaction',
        rawDescription: initial?.rawDescription ?? null,
        categoryId: effectiveCategoryId,
        accountId,
        original: currency === 'USD' ? null : { amountCents: signed, currency },
        note: note.trim(),
        source: initial?.source ?? 'manual',
        importId: initial?.importId ?? null,
      },
      createRuleFor:
        makeRule && canOfferRule ? { description: description.trim(), categoryId: effectiveCategoryId! } : null,
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  return (
    <form className="tx-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate aria-labelledby={`${id}-title`}>
      <div className="tx-form__header">
        <h2 id={`${id}-title`} className="tx-form__title">
          {editing ? 'Edit transaction' : 'New transaction'}
        </h2>
        <Button variant="text" icon="close" aria-label="Close" onClick={onClose} className="tx-form__close" />
      </div>

      <div className="tx-form__body">
        <div className="segmented" role="group" aria-label="Transaction type">
          <button type="button" aria-pressed={direction === 'out'} onClick={() => setDirection('out')}>
            Money out
          </button>
          <button type="button" aria-pressed={direction === 'in'} onClick={() => setDirection('in')}>
            Money in
          </button>
        </div>

        <div className="field">
          <label htmlFor={`${id}-account`} className="field__label">
            Account
          </label>
          <select
            id={`${id}-account`}
            className="input"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value || null)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
            <option value="">No account</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor={`${id}-amount`} className="field__label">
            Amount{currency !== 'USD' && ` in ${currency}`}
          </label>
          <div className={cx('amount-input', amountError && 'amount-input--invalid')}>
            <span className={cx('amount-input__sign', direction === 'in' && 'amount-input__sign--in')}>
              {direction === 'out' ? '−$' : '+$'}
            </span>
            <input
              ref={amountRef}
              id={`${id}-amount`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amountError ? true : undefined}
              aria-describedby={amountError ? `${id}-amount-error` : undefined}
            />
            {currency !== 'USD' && <span className="amount-input__currency">{currency}</span>}
          </div>
          {currency !== 'USD' && parsed !== null && (
            <span className="muted">
              ≈ {formatCents(usd, { showPlus: true })} USD at 1 {currency} = {settings.cadToUsd} USD
            </span>
          )}
          {amountError && (
            <span id={`${id}-amount-error`} className="field__error">
              {amountError}
            </span>
          )}
        </div>

        <div className="tx-form__row">
          <div className="field">
            <label htmlFor={`${id}-date`} className="field__label">
              Date
            </label>
            <input
              id={`${id}-date`}
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={dateError ? true : undefined}
            />
            {dateError && <span className="field__error">{dateError}</span>}
          </div>
          <div className="field">
            <label htmlFor={`${id}-desc`} className="field__label">
              Description
            </label>
            <input
              id={`${id}-desc`}
              className="input"
              placeholder="e.g. Farmers market"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">
            Category <span className="tx-form__optional">Optional</span>
          </legend>
          {ruleApplied && rule && (
            <p className="rule-hint">
              <Icon name="rules" size={14} />
              Set by your rule: {rule.conditions.map(describeCondition).join(' and ')}
            </p>
          )}
          <div className="chip-grid">
            {categories.map((c) => {
              const colors = CATEGORY_COLORS[c.color];
              const selected = effectiveCategoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={selected}
                  onClick={() => {
                    setPicked(true);
                    setCategoryId(selected ? null : c.id);
                  }}
                  style={{ background: colors.bg, color: colors.fg, borderColor: selected ? colors.fg : 'transparent' }}
                >
                  <Icon name={selected ? 'check' : c.icon} size={14} strokeWidth={selected ? 2.6 : 2} />
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        {canOfferRule && effectiveCategory && (
          <label className="rule-offer">
            <input type="checkbox" checked={makeRule} onChange={(e) => setMakeRule(e.target.checked)} />
            <span>
              <strong>
                Always file “{description.trim()}” under {effectiveCategory.name}
              </strong>
              <span className="muted">Creates a rule for future transactions and imports</span>
            </span>
          </label>
        )}

        <div className="field">
          <label htmlFor={`${id}-note`} className="field__label">
            Note <span className="tx-form__optional">Optional</span>
          </label>
          <textarea
            id={`${id}-note`}
            className="input textarea"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {initial && (
          <dl className="tx-origin">
            <div>
              <dt>Added</dt>
              <dd>
                {initial.source === 'import' ? 'Imported' : 'By hand'}
                {account ? ` · ${account.name}` : ''}
              </dd>
            </div>
            {initial.rawDescription && initial.rawDescription !== initial.description && (
              <div>
                <dt>Bank text</dt>
                <dd className="mono">{initial.rawDescription}</dd>
              </div>
            )}
            {initial.original && (
              <div>
                <dt>Original amount</dt>
                <dd>
                  {formatCents(initial.original.amountCents, { showPlus: true })} {initial.original.currency}
                </dd>
              </div>
            )}
          </dl>
        )}

        {editing && onDelete && (
          <Button variant="text" icon="trash" className="tx-form__delete" onClick={onDelete}>
            Delete transaction
          </Button>
        )}
      </div>

      <div className="tx-form__footer">
        <Button onClick={onClose} className="tx-form__cancel">
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="lg" className="tx-form__save">
          {editing ? 'Save changes' : 'Save transaction'}
        </Button>
      </div>
    </form>
  );
}
