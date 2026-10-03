import { useId, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { CategoryTag } from '../../components/Tag';
import { useToast } from '../../components/Toast';
import { applyRules, createRule, deleteRule, moveRule, updateRule } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Rule, RuleCondition } from '../../data/types';
import { describeCondition, findMatchingRule, ruleMatches, sortRules } from '../../domain/rules';
import { cx } from '../../lib/cx';
import { parseAmountToCents } from '../../lib/money';

export function RulesPage() {
  const rules = useCollection('rules');
  const categories = useCollection('categories');
  const transactions = useCollection('transactions');
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const editId = params.get('edit');
  const editing = editId ? rules.find((r) => r.id === editId) : undefined;
  const close = () => setParams({}, { replace: true });

  const sorted = useMemo(() => sortRules(rules), [rules]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const uncategorized = transactions.filter((t) => !t.categoryId);
  const wouldCategorize = uncategorized.filter((t) => sorted.some((r) => ruleMatches(r, t))).length;

  async function handleApply() {
    const changed = await applyRules();
    toast(changed ? `Categorized ${changed} transaction${changed === 1 ? '' : 's'}` : 'Nothing to categorize');
  }

  async function handleDelete(rule: Rule) {
    await deleteRule(rule.id);
    toast('Rule deleted');
  }

  return (
    <div className="page">
      <PageHeader
        title="Rules"
        subtitle="Rules pick a category automatically, for transactions you add and ones you import."
        actions={
          <>
            <Button icon="rules" onClick={handleApply} disabled={wouldCategorize === 0}>
              {wouldCategorize > 0 ? `Categorize ${wouldCategorize} uncategorized` : 'Nothing to categorize'}
            </Button>
            <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
              New rule
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <div className="card empty-card">
          <span className="coming-soon__icon">
            <Icon name="rules" size={24} />
          </span>
          <p className="coming-soon__title">No rules yet</p>
          <p className="coming-soon__body">
            Make one here, tick “Always file under…” when you add a transaction, or press Create rule after you pick a category.
          </p>
          <div className="empty-actions">
            <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
              New rule
            </Button>
          </div>
        </div>
      ) : (
        <div className="card rules-card">
          <p className="muted rules-card__intro">Rules run top to bottom. The first one that matches wins.</p>
          <ol className="rule-list">
            {sorted.map((r, i) => {
              const c = categoryById.get(r.categoryId);
              const matches = transactions.filter((t) => ruleMatches(r, t)).length;
              return (
                <li key={r.id} className="rule-row">
                  <span className="rule-row__order">{i + 1}</span>
                  <button type="button" className="rule-row__main" onClick={() => setParams({ edit: r.id })}>
                    <span className="rule-row__if">
                      If {r.conditions.map(describeCondition).join(' and ')}
                    </span>
                    <span className="rule-row__then">
                      <Icon name="chevronRight" size={14} />
                      {c ? (
                        <CategoryTag color={c.color} icon={c.icon}>
                          {c.name}
                        </CategoryTag>
                      ) : (
                        <span className="tag tag--empty">Deleted category</span>
                      )}
                      <span className="muted">
                        · matches {matches} transaction{matches === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                  <div className="rule-row__actions">
                    <Button variant="text" size="sm" icon="arrowUp" aria-label="Move up" disabled={i === 0} onClick={() => moveRule(r.id, -1)} />
                    <Button
                      variant="text"
                      size="sm"
                      icon="arrowDown"
                      aria-label="Move down"
                      disabled={i === sorted.length - 1}
                      onClick={() => moveRule(r.id, 1)}
                    />
                    <Button variant="text" size="sm" icon="trash" aria-label="Delete rule" className="row-delete" onClick={() => handleDelete(r)} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {(creating || editing) && (
        <Sheet title={editing ? 'Edit rule' : 'New rule'} onClose={close}>
          <RuleForm key={editing?.id ?? 'new'} initial={editing} onDone={close} />
        </Sheet>
      )}
    </div>
  );
}

// ---------- form ----------

type DraftField = 'description' | 'amount' | 'date';
type DraftOp = 'contains' | 'starts' | 'is' | 'equals' | 'greaterThan' | 'lessThan' | 'between';

interface DraftCondition {
  field: DraftField;
  op: DraftOp;
  value: string;
  value2: string;
}

const DESCRIPTION_OPS: Array<[DraftOp, string]> = [
  ['contains', 'contains'],
  ['starts', 'starts with'],
  ['is', 'is exactly'],
];
const DATE_OPS: Array<[DraftOp, string]> = [['between', 'is between']];
const AMOUNT_OPS: Array<[DraftOp, string]> = [
  ['equals', 'is exactly'],
  ['greaterThan', 'is over'],
  ['lessThan', 'is under'],
  ['between', 'is between'],
];

function toDraft(c: RuleCondition): DraftCondition {
  if (c.field === 'description') return { field: 'description', op: c.op, value: c.value, value2: '' };
  if (c.field === 'date') return { field: 'date', op: 'between', value: c.from, value2: c.to };
  return {
    field: 'amount',
    op: c.op,
    value: (c.valueCents / 100).toFixed(2),
    value2: c.op === 'between' ? (c.value2Cents / 100).toFixed(2) : '',
  };
}

/** Converts a draft into a stored condition, or returns an error message. */
function fromDraft(d: DraftCondition): RuleCondition | string {
  if (d.field === 'description') {
    const value = d.value.trim().toLowerCase();
    if (!value) return 'Type the text to look for';
    return { field: 'description', op: d.op as 'contains' | 'starts' | 'is', value };
  }
  if (d.field === 'date') {
    if (!d.value || !d.value2) return 'Pick both dates';
    const [from, to] = d.value <= d.value2 ? [d.value, d.value2] : [d.value2, d.value];
    return { field: 'date', op: 'between', from, to };
  }
  const a = parseAmountToCents(d.value);
  if (a === null) return 'Enter an amount like 15.99';
  if (d.op === 'between') {
    const b = parseAmountToCents(d.value2);
    if (b === null) return 'Enter the second amount';
    return { field: 'amount', op: 'between', valueCents: a, value2Cents: b };
  }
  return { field: 'amount', op: d.op as 'equals' | 'greaterThan' | 'lessThan', valueCents: a };
}

function RuleForm({ initial, onDone }: { initial?: Rule; onDone: () => void }) {
  const id = useId();
  const toast = useToast();
  const categories = useCollection('categories');
  const transactions = useCollection('transactions');
  const rules = useCollection('rules');
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? sortedCategories[0]?.id ?? '');
  const [drafts, setDrafts] = useState<DraftCondition[]>(
    initial ? initial.conditions.map(toDraft) : [{ field: 'description', op: 'contains', value: '', value2: '' }],
  );
  const [applyNow, setApplyNow] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const parsed = drafts.map(fromDraft);
  const conditions = parsed.filter((p): p is RuleCondition => typeof p !== 'string');
  const valid = conditions.length === drafts.length && !!categoryId;
  // The rule as it will run: in its existing place when editing, last when new.
  const preview: Rule = {
    id: initial?.id ?? 'preview',
    order: initial?.order ?? Math.max(0, ...rules.map((r) => r.order)) + 1,
    categoryId,
    conditions,
    createdAt: initial?.createdAt ?? '9999',
    updatedAt: '',
  };
  const effectiveRules = [...rules.filter((r) => r.id !== initial?.id), preview];
  const matching = valid ? transactions.filter((t) => ruleMatches(preview, t)) : [];
  // Only transactions this rule actually wins; a higher rule keeps its own matches.
  const toChange = matching.filter(
    (t) => findMatchingRule(effectiveRules, t)?.id === preview.id && t.categoryId !== categoryId,
  );
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const updateDraft = (i: number, patch: Partial<DraftCondition>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    let ruleId: string;
    if (initial) {
      await updateRule(initial.id, { categoryId, conditions });
      ruleId = initial.id;
    } else {
      ruleId = (await createRule({ categoryId, conditions })).id;
    }
    let changed = 0;
    if (applyNow && toChange.length > 0) changed = await applyRules({ onlyUncategorized: false, onlyRuleId: ruleId });
    toast(`${initial ? 'Rule saved' : 'Rule created'}${changed ? ` · updated ${changed} transaction${changed === 1 ? '' : 's'}` : ''}`);
    onDone();
  }

  return (
    <form className="sheet-form" onSubmit={handleSubmit} noValidate>
      <div className="sheet__body">
        <div className="rule-builder">
          <span className="field__label">When</span>
          {drafts.map((d, i) => {
            const error = submitted && typeof parsed[i] === 'string' ? (parsed[i] as string) : null;
            return (
              <div key={i} className="rule-condition">
                {i > 0 && <span className="rule-condition__and">and</span>}
                <div className="rule-condition__row">
                  <label className="sr-only" htmlFor={`${id}-field-${i}`}>
                    Field
                  </label>
                  <select
                    id={`${id}-field-${i}`}
                    className="input"
                    value={d.field}
                    onChange={(e) => {
                      const field = e.target.value as DraftField;
                      updateDraft(i, {
                        field,
                        op: field === 'description' ? 'contains' : field === 'date' ? 'between' : 'equals',
                        value: '',
                        value2: '',
                      });
                    }}
                  >
                    <option value="description">Description</option>
                    <option value="amount">Amount</option>
                    <option value="date">Date</option>
                  </select>
                  <label className="sr-only" htmlFor={`${id}-op-${i}`}>
                    Match
                  </label>
                  <select
                    id={`${id}-op-${i}`}
                    className="input"
                    value={d.op}
                    onChange={(e) => updateDraft(i, { op: e.target.value as DraftOp })}
                  >
                    {(d.field === 'description' ? DESCRIPTION_OPS : d.field === 'date' ? DATE_OPS : AMOUNT_OPS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {drafts.length > 1 && (
                    <Button
                      variant="text"
                      size="sm"
                      icon="close"
                      aria-label="Remove this condition"
                      onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}
                    />
                  )}
                </div>
                <div className="rule-condition__values">
                  {d.field === 'date' ? (
                    <>
                      <input
                        type="date"
                        className={cx('input', error && 'input--invalid')}
                        aria-label="From"
                        value={d.value}
                        onChange={(e) => updateDraft(i, { value: e.target.value })}
                      />
                      <span className="muted">to</span>
                      <input
                        type="date"
                        className="input"
                        aria-label="To"
                        value={d.value2}
                        onChange={(e) => updateDraft(i, { value2: e.target.value })}
                      />
                    </>
                  ) : d.field === 'description' ? (
                    <input
                      className={cx('input', error && 'input--invalid')}
                      aria-label="Text to look for"
                      placeholder="e.g. trader joe"
                      value={d.value}
                      onChange={(e) => updateDraft(i, { value: e.target.value })}
                      autoFocus={i === 0 && !initial}
                    />
                  ) : (
                    <>
                      <div className={cx('money-input', error && 'money-input--invalid')}>
                        <span aria-hidden="true">$</span>
                        <input
                          aria-label="Amount"
                          inputMode="decimal"
                          placeholder="15.99"
                          value={d.value}
                          onChange={(e) => updateDraft(i, { value: e.target.value })}
                        />
                      </div>
                      {d.op === 'between' && (
                        <>
                          <span className="muted">and</span>
                          <div className="money-input">
                            <span aria-hidden="true">$</span>
                            <input
                              aria-label="Second amount"
                              inputMode="decimal"
                              placeholder="20.00"
                              value={d.value2}
                              onChange={(e) => updateDraft(i, { value2: e.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
                {error && <span className="field__error">{error}</span>}
              </div>
            );
          })}
          {drafts.length < 3 && (
            <Button
              variant="text"
              size="sm"
              icon="plus"
              className="rule-builder__add"
              onClick={() => setDrafts((ds) => [...ds, { field: 'amount', op: 'equals', value: '', value2: '' }])}
            >
              Add condition
            </Button>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${id}-cat`} className="field__label">
            Set the category to
          </label>
          <div className="select-with-icon">
            <CategoryIcon category={selectedCategory} size={28} />
            <select id={`${id}-cat`} className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {sortedCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="type-details">
          <p className="muted">
            {valid
              ? `Matches ${matching.length} existing transaction${matching.length === 1 ? '' : 's'}${
                  toChange.length ? `, ${toChange.length} of them in a different category right now` : ''
                }.`
              : 'Fill in the conditions to see which transactions match.'}
          </p>
          {toChange.length > 0 && (
            <label className="rule-offer rule-offer--plain">
              <input type="checkbox" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} />
              <span>
                {toChange.length === 1 ? 'Also move that one' : `Also move those ${toChange.length}`} to{' '}
                {selectedCategory?.name}
              </span>
            </label>
          )}
        </div>
      </div>
      <div className="sheet__footer">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" className="sheet__submit">
          {initial ? 'Save rule' : 'Create rule'}
        </Button>
      </div>
    </form>
  );
}
