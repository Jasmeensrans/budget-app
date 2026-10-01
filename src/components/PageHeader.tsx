import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Hide the actions on phones, where the tab bar's + button already covers them. */
  hideActionsOnMobile?: boolean;
}

export function PageHeader({ title, subtitle, actions, hideActionsOnMobile = false }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div className={cx('page-header__actions', hideActionsOnMobile && 'page-header__actions--desktop')}>{actions}</div>
      )}
    </header>
  );
}
