import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Icon } from '../../components/Icon';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { Progress } from '../../components/Progress';
import { Sheet } from '../../components/Sheet';
import { Pill } from '../../components/Tag';
import { useToast } from '../../components/Toast';
import { useCollection } from '../../data/live';
import type { Category, RolloverBudget } from '../../data/types';
import { budgetStatus, monthOverview, type BudgetStatus } from '../../domain/budgets';
import { CATEGORY_COLORS } from '../../lib/categoryColors';
import { cx } from '../../lib/cx';
import { formatCents } from '../../lib/money';
import { addMonths, currentMonthKey, formatMonthName, formatMonthShort } from '../../lib/months';
import { BudgetForm } from './BudgetForm';

export function BudgetsPage() {
  const budgets = useCollection('budgets');
  const categories = useCollection('categories');
  const transactions = useCollection('transactions');
  const contributions = useCollection('contributions');
  const [month, setMonth] = useState(currentMonthKey());
  const [params, setParams] = useSearchParams();
  const isCreating = params.get('new') === '1';
  const editId = params.get('edit');
  const editing = editId ? budgets.find((b) => b.id === editId) : undefined;
  const toast = useToast();
  const closeSheet = () => setParams({}, { replace: true });

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const statuses = useMemo(
    () => budgets.map((b) => budgetStatus(b, transactions, contributions, month)),
    [budgets, transactions, contributions, month],
  );
  const overview = monthOverview(statuses);
  const monthly = statuses.filter((s) => s.budget.type === 'fixed' && s.budget.period === 'month');
  const yearly = statuses.filter((s) => s.budget.type === 'fixed' && s.budget.period === 'year');
  const rollover = statuses.filter((s) => s.budget.type !== 'fixed');
  const byName = (a: BudgetStatus, b: BudgetStatus) =>
    (categoryById.get(a.budget.categoryId)?.name ?? '').localeCompare(categoryById.get(b.budget.categoryId)?.name ?? '');

  const edit = (s: BudgetStatus) => setParams({ edit: s.budget.id });

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <MonthSwitcher month={month} onChange={setMonth} />
          <h1 className="page-header__title">Budgets</h1>
        </div>
        <div className="page-header__actions">
          <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
            New budget
          </Button>
        </div>
      </header>

      {budgets.length === 0 ? (
        <div className="card empty-card">
          <span className="coming-soon__icon">
            <Icon name="budget" size={24} />
          </span>
          <p className="coming-soon__title">No budgets yet</p>
          <p className="coming-soon__body">
            Set a goal for a category, a flexible amount that carries over, or a sinking fund for a big expense.
          </p>
          <div className="empty-actions">
            <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
              New budget
            </Button>
          </div>
        </div>
      ) : (
        <>
          <section className="card summary-card" aria-label="Month summary">
            <SummaryStat label={`Budgeted for ${formatMonthName(month)}`} value={formatCents(overview.budgetedCents, { whole: true })} />
            <SummaryStat label="Spent" value={formatCents(overview.spentInBudgetsCents, { whole: true })} />
            <SummaryStat
              label="Left"
              value={formatCents(overview.leftCents, { whole: true })}
              tone={overview.leftCents >= 0 ? 'good' : 'over'}
            />
            <div className="summary-card__pills">
              <Pill tone="good">{overview.onTrack} on track</Pill>
              {overview.over > 0 && <Pill tone="over">{overview.over} over</Pill>}
            </div>
          </section>

          {monthly.length > 0 && (
            <section className="card">
              <div className="card__header">
                <h2 className="card-title">Fixed · monthly</h2>
                <Pill>Resets {formatMonthShort(addMonths(month, 1)).replace(/ \d{4}$/, '')} 1</Pill>
              </div>
              <ul className="budget-list">
                {[...monthly].sort(byName).map((s) => (
                  <BudgetRow key={s.budget.id} status={s} category={categoryById.get(s.budget.categoryId)} onEdit={() => edit(s)} />
                ))}
              </ul>
            </section>
          )}

          {yearly.length > 0 && (
            <section className="card">
              <div className="card__header">
                <div className="card-heading">
                  <h2 className="card-title">Fixed · yearly</h2>
                  <span className="muted pace-legend">
                    <span className="pace-legend__mark" aria-hidden="true" /> marks an even pace for the year so far
                  </span>
                </div>
              </div>
              <ul className="budget-list">
                {[...yearly].sort(byName).map((s) => (
                  <BudgetRow key={s.budget.id} status={s} category={categoryById.get(s.budget.categoryId)} onEdit={() => edit(s)} />
                ))}
              </ul>
            </section>
          )}

          {rollover.length > 0 && (
            <section className="budget-section">
              <div className="card-heading">
                <h2 className="section-title">Flexible and sinking funds</h2>
                <span className="muted">Anything you don’t spend rolls into next month</span>
              </div>
              <div className="fund-grid">
                {[...rollover].sort(byName).map((s) => (
                  <FundCard key={s.budget.id} status={s} category={categoryById.get(s.budget.categoryId)} month={month} onEdit={() => edit(s)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(isCreating || editing) && (
        <Sheet title={editing ? `Edit ${categoryById.get(editing.categoryId)?.name ?? ''} budget` : 'New budget'} onClose={closeSheet}>
          <BudgetForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onDone={(message) => {
              toast(message);
              closeSheet();
            }}
            onCancel={closeSheet}
          />
        </Sheet>
      )}
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'over' }) {
  return (
    <div className="summary-stat">
      <span className="stat__label">{label}</span>
      <span className={cx('summary-stat__value', tone === 'good' && 'text-good', tone === 'over' && 'text-over')}>{value}</span>
    </div>
  );
}

function BudgetRow({ status, category, onEdit }: { status: BudgetStatus; category?: Category; onEdit: () => void }) {
  const color = CATEGORY_COLORS[category?.color ?? 'brand'].bar;
  const pct = Math.round(status.ratio * 100);
  return (
    <li className="budget-row">
      <button type="button" className="budget-row__name" onClick={onEdit}>
        <CategoryIcon category={category} size={32} />
        <span>{category?.name ?? 'Deleted category'}</span>
      </button>
      <div className="budget-row__numbers">
        <span className="amount">{formatCents(status.spentCents, { whole: true })}</span>
        <span className="muted"> of {formatCents(status.availableCents, { whole: true })}</span>
      </div>
      <div className="budget-row__bar">
        <div className="pace-track">
          <Progress value={status.spentCents} max={status.availableCents} color={color} label={`${category?.name} budget used`} />
          {status.paceRatio !== null && (
            <span className="pace-mark" style={{ left: `${Math.min(100, status.paceRatio * 100)}%` }} aria-hidden="true" />
          )}
        </div>
        <span className={cx('budget-row__note', status.over && 'text-over')}>
          {status.over
            ? `${formatCents(-status.leftCents, { whole: true })} over`
            : `${formatCents(status.leftCents, { whole: true })} left`}
          {Number.isFinite(pct) && ` · ${pct}%`}
        </span>
      </div>
      <Button variant="text" size="sm" icon="pencil" aria-label={`Edit ${category?.name} budget`} onClick={onEdit} className="row-delete" />
    </li>
  );
}

function FundCard({
  status,
  category,
  month,
  onEdit,
}: {
  status: BudgetStatus;
  category?: Category;
  month: string;
  onEdit: () => void;
}) {
  const b = status.budget as RolloverBudget;
  const color = CATEGORY_COLORS[category?.color ?? 'brand'].bar;
  const prevName = formatMonthName(addMonths(month, -1)).slice(0, 3);
  return (
    <div className="card fund-card">
      <div className="fund-card__top">
        <CategoryIcon category={category} size={32} />
        <span className="fund-card__name">{category?.name ?? 'Deleted category'}</span>
        <Pill tone={b.type === 'sinking' ? 'info' : 'neutral'}>{b.type === 'sinking' ? 'Sinking fund' : 'Flexible'}</Pill>
      </div>
      <div>
        <span className={cx('fund-card__left', status.over && 'text-over')}>{formatCents(status.leftCents, { whole: true })}</span>
        <span className="muted"> left to spend</span>
      </div>
      <Progress value={status.spentCents} max={status.availableCents} color={color} label={`${category?.name} fund used`} />
      <dl className="fund-card__lines">
        <div>
          <dt>Carried over from {prevName}</dt>
          <dd>{formatCents(status.carriedInCents, { showPlus: true, whole: true })}</dd>
        </div>
        <div>
          <dt>Added this month</dt>
          <dd>{formatCents(status.addedCents, { showPlus: true, whole: true })}</dd>
        </div>
        <div>
          <dt>Spent this month</dt>
          <dd>{formatCents(-status.spentCents, { whole: true })}</dd>
        </div>
      </dl>
      {b.type === 'sinking' && (
        <p className="fund-card__goal">
          <Icon name="target" size={14} />
          Saving {formatCents(b.targetCents, { whole: true })} by {formatMonthShort(b.targetMonth)}
        </p>
      )}
      <Button variant="text" size="sm" icon="pencil" aria-label={`Edit ${category?.name} budget`} onClick={onEdit} className="fund-card__delete" />
    </div>
  );
}
