import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { useConfirm } from '../../components/Confirm';
import { addAdjustment, createBudget, deleteBudget, updateBudget } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Budget, BudgetPeriod, BudgetType, NewDoc } from '../../data/types';
import { cx } from '../../lib/cx';
import { formatCents, parseAmountToCents } from '../../lib/money';
import { addMonths, currentMonthKey, formatMonthShort, monthsBetween } from '../../lib/months';

const TYPES: Array<{ type: BudgetType; title: string; description: string }> = [
  { type: 'fixed', title: 'Fixed', description: 'A goal for each month or year, like $500 for groceries.' },
  { type: 'flexible', title: 'Flexible', description: 'Adds a set amount each month. Leftovers carry over.' },
  { type: 'sinking', title: 'Sinking fund', description: 'Save toward a target by a date, like car insurance.' },
];

const centsToInput = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, '');

/** "-50", "+120.5", "75" → signed cents, or null. */
function parseSignedCents(raw: string): number | null {
  const t = raw.trim();
  const negative = t.startsWith('-') || t.startsWith('−');
  const cents = parseAmountToCents(t.replace(/^[-−+]/, ''));
  return cents === null ? null : negative ? -cents : cents;
}

interface BudgetFormProps {
  /** Present when editing. The category and type can't change once created. */
  initial?: Budget;
  onDone: (message: string) => void;
  onCancel: () => void;
}

export function BudgetForm({ initial, onDone, onCancel }: BudgetFormProps) {
  const id = useId();
  const confirm = useConfirm();
  const categories = useCollection('categories');
  const budgets = useCollection('budgets');
  const taken = new Set(budgets.filter((b) => b.id !== initial?.id).map((b) => b.categoryId));
  const available = categories
    .filter((c) => !taken.has(c.id) && (c.name !== 'Income' || c.id === initial?.categoryId))
    .sort((a, b) => a.name.localeCompare(b.name));

  const thisMonth = currentMonthKey();
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? available[0]?.id ?? '');
  const [type, setType] = useState<BudgetType>(initial?.type ?? 'fixed');
  const [amount, setAmount] = useState(initial && initial.type !== 'sinking' ? centsToInput(initial.amountCents) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(initial?.type === 'fixed' ? initial.period : 'month');
  const [target, setTarget] = useState(initial?.type === 'sinking' ? centsToInput(initial.targetCents) : '');
  const [targetMonth, setTargetMonth] = useState(initial?.type === 'sinking' ? initial.targetMonth : addMonths(thisMonth, 6));
  const [startBalance, setStartBalance] = useState('');
  const [adjustment, setAdjustment] = useState('');
  const [adjustmentNote, setAdjustmentNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const amountCents = parseAmountToCents(amount);
  const targetCents = parseAmountToCents(target);
  const startCents = startBalance.trim() ? parseAmountToCents(startBalance, { allowZero: true }) : 0;
  const adjustmentCents = adjustment.trim() ? parseSignedCents(adjustment) : 0;
  const monthsLeft = monthsBetween(thisMonth, targetMonth) + 1;
  const sinkingMonthly =
    targetCents !== null && startCents !== null && monthsLeft > 0
      ? Math.ceil(Math.max(0, targetCents - startCents) / monthsLeft / 100) * 100
      : null;

  const errors = {
    category: !categoryId ? 'Pick a category' : null,
    amount: type !== 'sinking' && amountCents === null ? 'Enter an amount like 500' : null,
    target: type === 'sinking' && targetCents === null ? 'Enter a target like 1200' : null,
    targetMonth: type === 'sinking' && monthsLeft < 1 ? 'Pick this month or later' : null,
    startBalance: !initial && type !== 'fixed' && startCents === null ? 'Enter an amount like 200, or leave it blank' : null,
    adjustment: adjustmentCents === null ? 'Enter an amount like 50 or -50' : null,
  };
  const show = (e: string | null) => (submitted ? e : null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setSaving(true);

    if (initial) {
      if (initial.type === 'fixed') await updateBudget(initial.id, { amountCents: amountCents!, period });
      else if (initial.type === 'flexible') await updateBudget(initial.id, { amountCents: amountCents! });
      else await updateBudget(initial.id, { targetCents: targetCents!, targetMonth });
      if (initial.type !== 'fixed' && adjustmentCents) {
        await addAdjustment(initial.id, thisMonth, adjustmentCents, adjustmentNote.trim());
      }
      onDone('Budget saved');
      return;
    }

    let doc: NewDoc<Budget>;
    if (type === 'fixed') {
      doc = { type, categoryId, amountCents: amountCents!, period };
    } else if (type === 'flexible') {
      doc = { type, categoryId, amountCents: amountCents!, startMonth: thisMonth, startBalanceCents: startCents! };
    } else {
      doc = { type, categoryId, targetCents: targetCents!, targetMonth, startMonth: thisMonth, startBalanceCents: startCents! };
    }
    await createBudget(doc);
    onDone('Budget created');
  }

  async function handleDelete() {
    if (!initial) return;
    const name = categories.find((c) => c.id === initial.categoryId)?.name ?? 'this category';
    const ok = await confirm({ title: `Delete the budget for ${name}?`, body: 'Its transactions stay.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await deleteBudget(initial.id);
    onDone('Budget deleted');
  }

  if (!initial && available.length === 0) {
    return (
      <>
        <div className="sheet__body">
          <p className="muted">Every category already has a budget. Add a new category first.</p>
        </div>
        <div className="sheet__footer">
          <Button onClick={onCancel}>Close</Button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="sheet-form">
      <div className="sheet__body">
        <div className="field">
          <label htmlFor={`${id}-cat`} className="field__label">
            Category
          </label>
          <div className="select-with-icon">
            <CategoryIcon category={categories.find((c) => c.id === categoryId)} size={28} />
            <select
              id={`${id}-cat`}
              className="input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={!!initial}
              autoFocus={!initial}
            >
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {show(errors.category) && <span className="field__error">{errors.category}</span>}
        </div>

        {!initial && (
          <fieldset className="field tx-form__fieldset">
            <legend className="field__label tx-form__legend">Budget type</legend>
            <div className="type-cards">
              {TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  className="type-card"
                  aria-pressed={type === t.type}
                  onClick={() => setType(t.type)}
                >
                  <span className="type-card__title">
                    <span className="radio-dot" aria-hidden="true" />
                    {t.title}
                  </span>
                  <span className="type-card__desc">{t.description}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="type-details">
          {type === 'sinking' ? (
            <div className="tx-form__row">
              <MoneyField
                id={`${id}-target`}
                label="Target"
                value={target}
                onChange={setTarget}
                error={show(errors.target)}
                placeholder="1,200"
              />
              <div className="field">
                <label htmlFor={`${id}-by`} className="field__label">
                  Needed by
                </label>
                <input
                  id={`${id}-by`}
                  type="month"
                  className="input"
                  min={thisMonth}
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                />
                {show(errors.targetMonth) && <span className="field__error">{errors.targetMonth}</span>}
              </div>
            </div>
          ) : (
            <div className="tx-form__row">
              <MoneyField
                id={`${id}-amount`}
                label={type === 'flexible' ? 'Added each month' : 'Goal amount'}
                value={amount}
                onChange={setAmount}
                error={show(errors.amount)}
                placeholder="500"
              />
              {type === 'fixed' && (
                <div className="field">
                  <span className="field__label">Resets every</span>
                  <div className="segmented" role="group" aria-label="Budget period">
                    <button type="button" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>
                      Month
                    </button>
                    <button type="button" aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>
                      Year
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!initial && type !== 'fixed' && (
            <MoneyField
              id={`${id}-start`}
              label="Starting balance"
              optional
              value={startBalance}
              onChange={setStartBalance}
              error={show(errors.startBalance)}
              placeholder="0"
            />
          )}

          <p className="muted type-details__help">
            {type === 'fixed' &&
              (period === 'month'
                ? 'Progress starts fresh on the 1st of every month.'
                : 'Tracks January to December, with a marker for where an even pace would put you.')}
            {type === 'flexible' &&
              (initial
                ? 'A new amount applies from next month. Months already added stay as they were.'
                : 'Each month adds this amount. Anything you don’t spend carries over to the next month.')}
            {type === 'sinking' &&
              (sinkingMonthly !== null && monthsLeft > 0
                ? initial
                  ? `Changes apply from next month's contribution onward.`
                  : `About ${formatCents(sinkingMonthly, { whole: true })} a month for ${monthsLeft} month${
                      monthsLeft === 1 ? '' : 's'
                    } reaches ${formatCents(targetCents!, { whole: true })} by ${formatMonthShort(targetMonth)}.`
                : 'Enter a target and a month, and the monthly amount is worked out for you.')}
          </p>
        </div>

        {initial && initial.type !== 'fixed' && (
          <div className="type-details">
            <div className="tx-form__row">
              <div className="field">
                <label htmlFor={`${id}-adj`} className="field__label">
                  Add or take out money <span className="tx-form__optional">Optional</span>
                </label>
                <div className={cx('money-input', show(errors.adjustment) && 'money-input--invalid')}>
                  <span aria-hidden="true">$</span>
                  <input
                    id={`${id}-adj`}
                    inputMode="decimal"
                    placeholder="50 or -50"
                    value={adjustment}
                    onChange={(e) => setAdjustment(e.target.value)}
                  />
                </div>
                {show(errors.adjustment) && <span className="field__error">{errors.adjustment}</span>}
              </div>
              <div className="field">
                <label htmlFor={`${id}-adj-note`} className="field__label">
                  Note <span className="tx-form__optional">Optional</span>
                </label>
                <input
                  id={`${id}-adj-note`}
                  className="input"
                  placeholder="e.g. Birthday money"
                  value={adjustmentNote}
                  onChange={(e) => setAdjustmentNote(e.target.value)}
                />
              </div>
            </div>
            <p className="muted type-details__help">Applies to this month. Use a minus sign to move money out.</p>
          </div>
        )}

        {initial && (
          <Button variant="text" icon="trash" className="tx-form__delete" onClick={handleDelete}>
            Delete budget
          </Button>
        )}
      </div>

      <div className="sheet__footer">
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={saving} className="sheet__submit">
          {initial ? 'Save changes' : 'Create budget'}
        </Button>
      </div>
    </form>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  placeholder: string;
  optional?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label} {optional && <span className="tx-form__optional">Optional</span>}
      </label>
      <div className={cx('money-input', error && 'money-input--invalid')}>
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <span id={`${id}-error`} className="field__error">
          {error}
        </span>
      )}
    </div>
  );
}
