import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Category, Cents } from '../../data/types';
import type { CategorySpend } from '../../domain/budgets';
import { cx } from '../../lib/cx';
import { formatCents } from '../../lib/money';

/**
 * Slice colors, in fixed order (validated for colorblind separation between neighbors).
 * Categories take them in order of spending; past seven, the rest fold into "Other".
 */
const SLICE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];
const OTHER_COLOR = '#8a877f';
const LEFT_OVER_COLOR = '#dcd9d1';

interface Slice {
  key: string;
  label: string;
  cents: Cents;
  color: string;
  /** Where clicking the legend item goes, if anywhere. */
  href: string | null;
}

interface SpendingDonutProps {
  rows: CategorySpend[];
  incomeCents: Cents;
  categoryById: Map<string, Category>;
  month: string;
}

const SIZE = 220;
const R = 84;
const STROKE = 30;
const CIRC = 2 * Math.PI * R;
const GAP = 2; // surface gap between slices, in px along the ring

/** One chart of the whole month: every category's slice of income, plus what was left over. */
export function SpendingDonut({ rows, incomeCents, categoryById, month }: SpendingDonutProps) {
  const [active, setActive] = useState<string | null>(null);
  const spent = rows.reduce((s, r) => s + r.spentCents, 0);
  const leftOver = incomeCents - spent;

  const top = rows.slice(0, SLICE_COLORS.length);
  const rest = rows.slice(SLICE_COLORS.length);
  const slices: Slice[] = top.map((r, i) => ({
    key: r.categoryId ?? 'none',
    label: r.categoryId ? (categoryById.get(r.categoryId)?.name ?? 'Deleted category') : 'Uncategorized',
    cents: r.spentCents,
    color: SLICE_COLORS[i],
    href: `/transactions?category=${r.categoryId ?? 'none'}&month=${month}`,
  }));
  if (rest.length > 0) {
    slices.push({
      key: 'other',
      label: `Other (${rest.length})`,
      cents: rest.reduce((s, r) => s + r.spentCents, 0),
      color: OTHER_COLOR,
      href: null,
    });
  }
  if (leftOver > 0) {
    slices.push({ key: 'left', label: 'Left over', cents: leftOver, color: LEFT_OVER_COLOR, href: null });
  }

  const total = slices.reduce((s, x) => s + x.cents, 0);
  let offset = 0;
  const arcs = slices.map((s) => {
    const len = total > 0 ? (s.cents / total) * CIRC : 0;
    const arc = { ...s, len, start: offset };
    offset += len;
    return arc;
  });

  const activeSlice = slices.find((s) => s.key === active);
  const summary = slices.map((s) => `${s.label} ${formatCents(s.cents, { whole: true })}`).join(', ');

  return (
    <div className="donut">
      <div className="donut__chart" onMouseLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${incomeCents > 0 ? `Income ${formatCents(incomeCents, { whole: true })}: ` : ''}${summary}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((a) => {
              const visible = Math.max(0, a.len - (arcs.length > 1 ? GAP : 0));
              return (
                <circle
                  key={a.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={active === a.key ? STROKE + 6 : STROKE}
                  strokeDasharray={`${visible} ${CIRC - visible}`}
                  strokeDashoffset={-a.start}
                  className={cx('donut__slice', active && active !== a.key && 'is-dim')}
                  onMouseEnter={() => setActive(a.key)}
                />
              );
            })}
          </g>
        </svg>
        <div className="donut__center" aria-hidden="true">
          {activeSlice ? (
            <>
              <span className="donut__center-label">{activeSlice.label}</span>
              <span className="donut__center-value">{formatCents(activeSlice.cents, { whole: true })}</span>
            </>
          ) : (
            <>
              <span className="donut__center-label">Spent</span>
              <span className="donut__center-value">{formatCents(spent, { whole: true })}</span>
              {incomeCents > 0 && (
                <span className="donut__center-sub">of {formatCents(incomeCents, { whole: true })} income</span>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="donut__legend">
        {slices.map((s) => {
          const content = (
            <>
              <span className="donut__key" style={{ background: s.color }} aria-hidden="true" />
              <span className="donut__name">{s.label}</span>
              <span className="amount">{formatCents(s.cents, { whole: true })}</span>
            </>
          );
          return (
            <li
              key={s.key}
              className={cx(active === s.key && 'is-active', active && active !== s.key && 'is-dim')}
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
            >
              {s.href ? (
                <Link to={s.href} className="donut__item">
                  {content}
                </Link>
              ) : (
                <span className="donut__item">{content}</span>
              )}
            </li>
          );
        })}
        {leftOver < 0 && incomeCents > 0 && (
          <li className="donut__over text-over">Spent {formatCents(-leftOver, { whole: true })} more than came in</li>
        )}
      </ul>
    </div>
  );
}
