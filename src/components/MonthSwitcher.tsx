import type { MonthKey } from '../data/types';
import { addMonths, currentMonthKey, formatMonthLong } from '../lib/months';
import { Icon } from './Icon';

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  const atCurrent = month >= currentMonthKey();
  return (
    <div className="month-switcher">
      <button type="button" aria-label="Previous month" onClick={() => onChange(addMonths(month, -1))}>
        <Icon name="chevronLeft" size={18} />
      </button>
      <span className="month-switcher__label">{formatMonthLong(month)}</span>
      <button type="button" aria-label="Next month" onClick={() => onChange(addMonths(month, 1))} disabled={atCurrent}>
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}
