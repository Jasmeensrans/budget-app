import type { Category } from '../data/types';
import { CATEGORY_COLORS } from '../lib/categoryColors';
import { Icon } from './Icon';

/** A category's icon in a pastel square. */
export function CategoryIcon({ category, size = 28 }: { category?: Category; size?: number }) {
  const c = CATEGORY_COLORS[category?.color ?? 'brand'];
  return (
    <span className="cat-icon" style={{ background: c.bg, color: c.fg, width: size, height: size }}>
      <Icon name={category?.icon ?? 'tag'} size={Math.round(size * 0.54)} />
    </span>
  );
}
