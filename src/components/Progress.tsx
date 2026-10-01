interface ProgressProps {
  /** Amount used so far. */
  value: number;
  max: number;
  /** Bar color while under budget (a category `bar` shade or a token). */
  color?: string;
  label: string;
}

/** Budget bar: turns coral when value goes over max. */
export function Progress({ value, max, color = 'var(--green-800)', label }: ProgressProps) {
  const over = value > max;
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <div className="progress__fill" style={{ width: `${pct}%`, background: over ? 'var(--over-bar)' : color }} />
    </div>
  );
}
