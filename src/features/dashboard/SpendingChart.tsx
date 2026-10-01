import type { Cents } from '../../data/types';
import { formatCents, formatCompact } from '../../lib/money';

interface SpendingChartProps {
  /** Running totals for this month, day 1 through today (or month end). */
  current: Cents[];
  /** Running totals for the whole previous month. */
  previous: Cents[];
  daysInMonth: number;
  currentLabel: string;
  previousLabel: string;
}

const W = 660;
const H = 232;
const LEFT = 40;
const RIGHT = 640;
const TOP = 20;
const BOTTOM = 200;

function niceMax(value: Cents): Cents {
  if (value <= 0) return 100000;
  const step = [1, 2, 2.5, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(value / 4)));
  const s = step.find((x) => x * 4 >= value) ?? step[step.length - 1];
  return s * 4;
}

/** Cumulative spending, this month (solid, shaded) vs last month (dashed). */
export function SpendingChart({ current, previous, daysInMonth, currentLabel, previousLabel }: SpendingChartProps) {
  const max = niceMax(Math.max(1, ...current, ...previous));
  const x = (day: number) => LEFT + ((day - 1) / Math.max(1, daysInMonth - 1)) * (RIGHT - LEFT);
  const y = (v: Cents) => BOTTOM - (v / max) * (BOTTOM - TOP);
  const points = (series: Cents[]) =>
    series
      .slice(0, daysInMonth)
      .map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ');

  const lastDay = current.length;
  const lastValue = current[lastDay - 1] ?? 0;
  const prevAtSameDay = previous[Math.min(lastDay, previous.length) - 1];
  const area =
    lastDay > 0 ? `M${x(1)} ${BOTTOM} L${points(current).replaceAll(' ', ' L')} L${x(lastDay)} ${BOTTOM} Z` : '';
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  const dayTicks = [1, 8, 15, 22, daysInMonth];

  return (
    <svg
      className="spending-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Running total: ${formatCents(lastValue, { whole: true })} spent by day ${lastDay}${
        prevAtSameDay !== undefined ? `, compared with ${formatCents(prevAtSameDay, { whole: true })} by the same day last month` : ''
      }`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line x1={LEFT} x2={RIGHT + 12} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-baseline' : 'chart-grid'} />
          <text x={0} y={y(t) + 4} className="chart-label">
            {formatCompact(t)}
          </text>
        </g>
      ))}
      {dayTicks.map((d, i) => (
        <text key={d} x={x(d)} y={224} className="chart-label" textAnchor={i === 0 ? 'start' : 'middle'}>
          {d}
        </text>
      ))}

      {previous.length > 0 && <polyline points={points(previous)} className="chart-line chart-line--previous" />}
      {lastDay > 0 && (
        <>
          <path d={area} className="chart-area" />
          <polyline points={points(current)} className="chart-line chart-line--current" />
          <line x1={x(lastDay)} x2={x(lastDay)} y1={y(lastValue) + 6} y2={BOTTOM} className="chart-today" />
          {prevAtSameDay !== undefined && (
            <circle cx={x(lastDay)} cy={y(prevAtSameDay)} r={4} className="chart-dot chart-dot--previous" />
          )}
          <circle cx={x(lastDay)} cy={y(lastValue)} r={5.5} className="chart-dot chart-dot--current" />
          <text
            x={x(lastDay) + (lastDay > daysInMonth * 0.8 ? -10 : 12)}
            y={y(lastValue) + 20}
            textAnchor={lastDay > daysInMonth * 0.8 ? 'end' : 'start'}
            className="chart-callout chart-callout--current"
          >
            {currentLabel} · {formatCents(lastValue, { whole: true })}
          </text>
          {prevAtSameDay !== undefined && (
            <text
              x={x(lastDay) + (lastDay > daysInMonth * 0.8 ? -10 : 12)}
              y={y(prevAtSameDay) - 10}
              textAnchor={lastDay > daysInMonth * 0.8 ? 'end' : 'start'}
              className="chart-callout"
            >
              {previousLabel} · {formatCents(prevAtSameDay, { whole: true })}
            </text>
          )}
        </>
      )}
    </svg>
  );
}
