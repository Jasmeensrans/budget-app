import type { ReactNode } from 'react';
import { CATEGORY_COLORS, type CategoryColorName } from '../lib/categoryColors';
import { Icon, type IconName } from './Icon';

/** Notion-style category label, with an optional icon. */
export function CategoryTag({ color, icon, children }: { color: CategoryColorName; icon?: IconName; children: ReactNode }) {
  const c = CATEGORY_COLORS[color];
  return (
    <span className="tag" style={{ background: c.bg, color: c.fg }}>
      {icon && <Icon name={icon} size={13} />}
      <span className="tag__label">{children}</span>
    </span>
  );
}

export type PillTone = 'good' | 'over' | 'warn' | 'info' | 'neutral';

/** Rounded status label, e.g. "On track" or "$36 over". */
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
