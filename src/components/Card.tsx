import type { HTMLAttributes } from 'react';
import { cx } from '../lib/cx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Green-tinted card: reserve it for the one number that matters most on a screen. */
  tinted?: boolean;
}

export function Card({ tinted = false, className, ...rest }: CardProps) {
  return <div className={cx('card', tinted && 'card--tinted', className)} {...rest} />;
}
