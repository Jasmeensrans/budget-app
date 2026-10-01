import { Link } from 'react-router-dom';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Icon } from '../../components/Icon';
import type { Budget, Category, Cents } from '../../data/types';
import type { CategorySpend } from '../../domain/budgets';
import { cx } from '../../lib/cx';
import { formatCents } from '../../lib/money';
import { SpendingDonut } from './SpendingDonut';

interface CategoryBreakdownProps {
  rows: CategorySpend[];
  /** Money in this month (income categories and uncategorized money in). */
  incomeCents: Cents;
  /** Same period last month, keyed by category id ('' for uncategorized). */
  previous: Map<string, Cents>;
  categoryById: Map<string, Category>;
  budgetByCategory: Map<string, Budget>;
  previousName: string;
  month: string;
}

/**
 * Where the month's income went: a donut of every category's slice (plus what was left over),
 * then each category with spending, budgeted or not, with a bar measured against income.
 */
export function CategoryBreakdown({
  rows,
  incomeCents,
  previous,
  categoryById,
  budgetByCategory,
  previousName,
  month,
}: CategoryBreakdownProps) {
  const spent = rows.reduce((sum, r) => sum + r.spentCents, 0);
  // Bars are measured against income (or total spending in a month with no income yet).
  const base = incomeCents > 0 ? incomeCents : spent;

  return (
    <div className="breakdown-wrap">
      <SpendingDonut rows={rows} incomeCents={incomeCents} categoryById={categoryById} month={month} />

      <ul className="breakdown">
        {rows.map((r) => {
          const category = r.categoryId ? categoryById.get(r.categoryId) : undefined;
          const name = r.categoryId ? (category?.name ?? 'Deleted category') : 'Uncategorized';
          const prev = previous.get(r.categoryId ?? '') ?? 0;
          const delta = r.spentCents - prev;
          const hasBudget = r.categoryId ? budgetByCategory.has(r.categoryId) : false;
          const width = base > 0 ? Math.min(100, (r.spentCents / base) * 100) : 0;

          return (
            <li key={r.categoryId ?? 'none'}>
              <Link to={`/transactions?category=${r.categoryId ?? 'none'}&month=${month}`} className="breakdown__row">
                {category ? (
                  <CategoryIcon category={category} size={32} />
                ) : (
                  <span className="cat-icon cat-icon--empty" style={{ width: 32, height: 32 }}>
                    <Icon name="tag" size={16} />
                  </span>
                )}
                <div className="breakdown__body">
                  <div className="breakdown__top">
                    <span className="breakdown__name">
                      {name}
                      {!hasBudget && <span className="breakdown__nobudget">No budget</span>}
                    </span>
                    <span className="amount">{formatCents(r.spentCents, { whole: true })}</span>
                  </div>
                  <div className="breakdown__bar" aria-hidden="true">
                    <div style={{ width: `${width}%` }} />
                  </div>
                  <div className="breakdown__meta">
                    <span>
                      {r.count} {r.count === 1 ? 'transaction' : 'transactions'}
                    </span>
                    {prev > 0 && delta !== 0 && (
                      <span className={cx(delta > 0 ? 'text-over' : 'text-good')}>
                        {delta > 0 ? '+' : '−'}
                        {formatCents(Math.abs(delta), { whole: true })} vs {previousName}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
