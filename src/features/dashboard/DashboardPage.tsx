import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Icon, type IconName } from '../../components/Icon';
import { MonthSwitcher } from '../../components/MonthSwitcher';
import { Progress } from '../../components/Progress';
import { CategoryIcon } from '../../components/CategoryIcon';
import { CategoryTag, Pill } from '../../components/Tag';
import { useCollection } from '../../data/live';
import type { Category, RolloverBudget } from '../../data/types';
import {
  budgetStatus,
  cumulativeSpendByDay,
  makeKindOf,
  monthOverview,
  periodTotals,
  spendingByCategory,
  type BudgetStatus,
} from '../../domain/budgets';
import { CATEGORY_COLORS } from '../../lib/categoryColors';
import { cx } from '../../lib/cx';
import { dayOfMonth, formatShortDate, greeting, todayISO } from '../../lib/dates';
import { formatCents } from '../../lib/money';
import {
  addMonths,
  currentMonthKey,
  dateInMonth,
  daysInMonth,
  formatMonthName,
  monthEnd,
  monthStart,
} from '../../lib/months';
import { CategoryBreakdown } from './CategoryBreakdown';
import { SpendingChart } from './SpendingChart';

export function DashboardPage() {
  const transactions = useCollection('transactions');
  const categories = useCollection('categories');
  const budgets = useCollection('budgets');
  const contributions = useCollection('contributions');
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonthKey());

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const budgetByCategory = useMemo(() => new Map(budgets.map((b) => [b.categoryId, b])), [budgets]);

  const view = useMemo(() => {
    const today = todayISO();
    const isCurrent = month === currentMonthKey();
    const days = daysInMonth(month);
    const throughDay = isCurrent ? dayOfMonth(today) : days;
    const prev = addMonths(month, -1);
    const prevDays = daysInMonth(prev);
    const throughDate = dateInMonth(month, throughDay);

    const kindOf = makeKindOf(categories);
    const spent = periodTotals(transactions, kindOf, monthStart(month), throughDate).spentCents;
    const prevSameDay = periodTotals(transactions, kindOf, monthStart(prev), dateInMonth(prev, Math.min(throughDay, prevDays))).spentCents;
    // Only compare with last month if the data covers it from (nearly) the start.
    const earliest = transactions.reduce((min, t) => (t.date < min ? t.date : min), '9999-12-31');
    const prevHasData = earliest <= dateInMonth(prev, 7);
    // Comparing an empty month (e.g. the 1st, before anything is entered) with last month is just noise.
    const hasThisMonth = transactions.some((t) => t.date >= monthStart(month) && t.date <= monthEnd(month));
    const compare = prevHasData && hasThisMonth;
    const income = periodTotals(transactions, kindOf, monthStart(month), monthEnd(month)).incomeCents;
    const statuses = budgets.map((b) => budgetStatus(b, transactions, contributions, month));
    const prevSameDate = dateInMonth(prev, Math.min(throughDay, prevDays));
    const byCategory = spendingByCategory(transactions, kindOf, monthStart(month), throughDate);
    const prevByCategory = new Map(
      spendingByCategory(transactions, kindOf, monthStart(prev), prevSameDate).map((r) => [r.categoryId ?? '', r.spentCents]),
    );
    const overview = monthOverview(statuses);

    return {
      isCurrent,
      days,
      daysLeft: days - throughDay,
      prev,
      spent,
      income,
      diff: spent - prevSameDay,
      prevHasData,
      hasThisMonth,
      compare,
      overview,
      statuses,
      byCategory,
      prevByCategory,
      current: cumulativeSpendByDay(transactions, kindOf, month, throughDay),
      previous: prevHasData ? cumulativeSpendByDay(transactions, kindOf, prev, prevDays) : [],
      recent: [...transactions]
        .filter((t) => t.date <= monthEnd(month))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, 7),
    };
  }, [transactions, categories, budgets, contributions, month]);

  const monthly = view.statuses
    .filter((s) => s.budget.type === 'fixed' && s.budget.period === 'month')
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  const rollover = view.statuses.filter((s) => s.budget.type !== 'fixed');
  const prevName = formatMonthName(view.prev);
  const perDay = view.daysLeft > 0 ? Math.max(0, view.overview.leftCents) / view.daysLeft : 0;

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <MonthSwitcher month={month} onChange={setMonth} />
          <h1 className="page-header__title">{view.isCurrent ? greeting() : formatMonthName(month)}</h1>
          <p className="page-header__subtitle">
            {view.compare ? (
              <>
                You've spent{' '}
                <strong className={view.diff <= 0 ? 'text-good' : 'text-over'}>
                  {formatCents(Math.abs(view.diff), { whole: true })} {view.diff <= 0 ? 'less' : 'more'}
                </strong>{' '}
                than {view.isCurrent ? 'this time' : 'in'} last month.{view.diff <= 0 ? ' Nice pace.' : ''}
              </>
            ) : !view.hasThisMonth ? (
              view.isCurrent ? (
                `Nothing spent in ${formatMonthName(month)} yet.`
              ) : (
                `No transactions in ${formatMonthName(month)}.`
              )
            ) : (
              `Here's how ${formatMonthName(month)} is going.`
            )}
          </p>
        </div>
        <div className="page-header__actions page-header__actions--desktop">
          <Button icon="upload" onClick={() => navigate('/import')}>
            Bulk import
          </Button>
          <Button variant="primary" icon="plus" onClick={() => navigate('/transactions?new=1')}>
            Add transaction
          </Button>
        </div>
      </header>


      <section className="grid-3" aria-label={`${formatMonthName(month)} at a glance`}>
        <StatCard label="Spent so far" icon="wallet" badge="green">
          <span className="stat__value">{formatCents(view.spent, { whole: true })}</span>
          {view.compare && (
            <span>
              <Pill tone={view.diff <= 0 ? 'good' : 'over'}>
                <Icon name="arrowDown" size={13} strokeWidth={2.4} className={view.diff > 0 ? 'flip' : undefined} />
                {formatCents(Math.abs(view.diff), { whole: true })} {view.diff <= 0 ? 'less' : 'more'} than {prevName}
              </Pill>
            </span>
          )}
        </StatCard>

        <StatCard label="Left to spend" icon="budget" badge="yellow">
          {view.overview.budgetedCents === 0 ? (
            <>
              <span className="stat__value">—</span>
              <span className="stat__meta">
                No monthly budgets yet. <Link to="/budgets?new=1">Create one</Link>
              </span>
            </>
          ) : (
            <>
          <span className="stat__value-row">
            <span className="stat__value">{formatCents(view.overview.leftCents, { whole: true })}</span>
            <span className="muted">of {formatCents(view.overview.budgetedCents, { whole: true })} budgeted</span>
          </span>
          <Progress
            value={view.overview.spentInBudgetsCents}
            max={view.overview.budgetedCents}
            label="Share of this month's budgets spent"
          />
          <span className="stat__meta">
            {view.isCurrent
              ? view.daysLeft === 0
                ? 'Last day of the month'
                : `${view.daysLeft} ${view.daysLeft === 1 ? 'day' : 'days'} left · about ${formatCents(perDay, { whole: true })} a day`
              : `${formatMonthName(month)} is finished`}
          </span>
            </>
          )}
        </StatCard>

        <StatCard label="Income" icon="dollar" badge="green">
          <span className="stat__value">{formatCents(view.income, { whole: true })}</span>
          <span className="stat__meta">
            Net so far{' '}
            <strong className={view.income - view.spent >= 0 ? 'text-good' : 'text-over'}>
              {formatCents(view.income - view.spent, { showPlus: true, whole: true })}
            </strong>
          </span>
        </StatCard>
      </section>

      <section className="dash-row">
        <div className="card chart-card">
          <div className="card__header">
            <div className="card-heading">
              <h2 className="card-title">Spending pace</h2>
              <span className="muted">Running total this month, compared with {prevName}</span>
            </div>
            <div className="chart-legend">
              <span>
                <span className="chart-legend__line" />
                {formatMonthName(month)}
              </span>
              <span>
                <span className="chart-legend__line chart-legend__line--previous" />
                {prevName}
              </span>
            </div>
          </div>
          <SpendingChart
            current={view.current}
            previous={view.previous}
            daysInMonth={view.days}
            currentLabel={view.isCurrent ? 'Today' : 'Total'}
            previousLabel={prevName.slice(0, 3)}
          />
        </div>

        <div className="card">
          <div className="card__header">
            <h2 className="card-title">Budgets</h2>
            <Link to="/budgets" className="link-strong">
              See all
            </Link>
          </div>
          {monthly.length === 0 ? (
            <p className="muted card-empty">
              No monthly budgets yet. <Link to="/budgets?new=1">Create one</Link>
            </p>
          ) : (
            <>
              <div className="pill-row">
                <Pill tone="good">{view.overview.onTrack} on track</Pill>
                {view.overview.over > 0 && <Pill tone="over">{view.overview.over} over</Pill>}
              </div>
              <ul className="budget-mini-list">
                {monthly.map((s) => (
                  <BudgetMini key={s.budget.id} status={s} category={categoryById.get(s.budget.categoryId)} />
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="card breakdown-card" aria-labelledby="breakdown-title">
        <div className="card__header">
          <div className="card-heading">
            <h2 id="breakdown-title" className="card-title">
              Where your money went
            </h2>
            <span className="muted">
              Everything you spent in {formatMonthName(month)}, budgeted or not. Pick a category to see its transactions.
            </span>
          </div>
        </div>
        {view.byCategory.length === 0 ? (
          <p className="muted card-empty">No spending in {formatMonthName(month)} yet.</p>
        ) : (
          <CategoryBreakdown
            rows={view.byCategory}
            incomeCents={view.income}
            previous={view.prevByCategory}
            categoryById={categoryById}
            budgetByCategory={budgetByCategory}
            previousName={prevName.slice(0, 3)}
            month={month}
          />
        )}
      </section>

      <section className="dash-row">
        <div className="card">
          <div className="card__header">
            <h2 className="card-title">Recent transactions</h2>
            <Link to="/transactions" className="link-strong">
              View all
            </Link>
          </div>
          {view.recent.length === 0 ? (
            <p className="muted card-empty">Nothing here yet.</p>
          ) : (
            <ul className="recent-list">
              {view.recent.map((t) => {
                const c = t.categoryId ? categoryById.get(t.categoryId) : undefined;
                return (
                  <li key={t.id} className="recent-row">
                    <span className="recent-row__date">{formatShortDate(t.date)}</span>
                    <span className="recent-row__desc">{t.description}</span>
                    <span className="recent-row__cat">
                      {c ? (
                        <CategoryTag color={c.color} icon={c.icon}>
                          {c.name}
                        </CategoryTag>
                      ) : (
                        <span className="tag tag--empty">Uncategorized</span>
                      )}
                    </span>
                    <span className={cx('amount recent-row__amount', t.amountCents > 0 && 'amount--in')}>
                      {formatCents(t.amountCents, { showPlus: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card__header">
            <div className="card-heading">
              <h2 className="card-title">Flexible funds</h2>
              <span className="muted">Unspent money rolls into next month</span>
            </div>
            <span className="icon-badge" style={{ background: CATEGORY_COLORS.blue.bg, color: CATEGORY_COLORS.blue.fg }}>
              <Icon name="refresh" size={17} />
            </span>
          </div>
          {rollover.length === 0 ? (
            <p className="muted card-empty">
              Flexible budgets and sinking funds show up here. <Link to="/budgets?new=1">Create one</Link>
            </p>
          ) : (
            <ul className="fund-list">
              {rollover.map((s) => (
                <FundRow key={s.budget.id} status={s} category={categoryById.get(s.budget.categoryId)} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

const BADGES = {
  green: { background: 'var(--green-100)', color: 'var(--green-800)' },
  yellow: { background: CATEGORY_COLORS.yellow.bg, color: CATEGORY_COLORS.yellow.fg },
};

function StatCard({
  label,
  icon,
  badge,
  children,
}: {
  label: string;
  icon: IconName;
  badge: keyof typeof BADGES;
  children: ReactNode;
}) {
  return (
    <div className="card stat">
      <div className="card__header">
        <span className="stat__label">{label}</span>
        <span className="icon-badge" style={BADGES[badge]}>
          <Icon name={icon} size={17} />
        </span>
      </div>
      {children}
    </div>
  );
}

function BudgetMini({ status, category }: { status: BudgetStatus; category?: Category }) {
  const color = CATEGORY_COLORS[category?.color ?? 'brand'].bar;
  return (
    <li className="budget-mini">
      <div className="budget-mini__top">
        <CategoryIcon category={category} />
        <span className="budget-mini__name">{category?.name ?? 'Deleted category'}</span>
        <span className="muted">
          <strong className="amount">{formatCents(status.spentCents, { whole: true })}</strong> /{' '}
          {formatCents(status.availableCents, { whole: true })}
        </span>
      </div>
      <Progress value={status.spentCents} max={status.availableCents} color={color} label={`${category?.name} budget used`} />
      <span className={cx('budget-mini__note', status.over && 'text-over')}>
        {status.over
          ? `${formatCents(-status.leftCents, { whole: true })} over budget`
          : `${formatCents(status.leftCents, { whole: true })} left`}
      </span>
    </li>
  );
}

function FundRow({ status, category }: { status: BudgetStatus; category?: Category }) {
  const b = status.budget as RolloverBudget;
  const color = CATEGORY_COLORS[category?.color ?? 'brand'].bar;
  const detail =
    b.type === 'flexible'
      ? `${formatCents(b.amountCents, { whole: true })}/mo + ${formatCents(status.carriedInCents, { whole: true })} carried over`
      : `Saving ${formatCents(b.targetCents, { whole: true })} · ${formatCents(status.addedCents, { whole: true })} added this month`;
  return (
    <li className="fund-row">
      <CategoryIcon category={category} size={36} />
      <div className="fund-row__body">
        <div className="fund-row__top">
          <span className="fund-row__name">{category?.name ?? 'Deleted category'}</span>
          <span>
            <strong className={cx('amount', status.over && 'text-over')}>{formatCents(status.leftCents, { whole: true })}</strong>{' '}
            <span className="muted">left</span>
          </span>
        </div>
        <Progress value={status.spentCents} max={status.availableCents} color={color} label={`${category?.name} fund used`} />
        <span className="muted fund-row__detail">
          {detail} · {formatCents(status.spentCents, { whole: true })} spent
        </span>
      </div>
    </li>
  );
}
