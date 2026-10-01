import type { ButtonHTMLAttributes, Ref } from 'react';
import { cx } from '../lib/cx';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Style guide rules: one `primary` per screen; `danger` only to confirm a delete.
 * Icon-only buttons must pass an `aria-label`.
 */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !children;
  return (
    <button
      type={type}
      className={cx('btn', `btn--${variant}`, `btn--${size}`, iconOnly && 'btn--icon', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} strokeWidth={2.4} />}
      {children}
    </button>
  );
}
