import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';

const LINKS: Array<{ to: string; label: string; description: string; icon: IconName }> = [
  { to: '/accounts', label: 'Accounts', description: 'Checking, credit cards and savings', icon: 'bank' },
  { to: '/categories', label: 'Categories', description: 'Names, icons and colors', icon: 'tag' },
  { to: '/rules', label: 'Rules', description: 'Categorize transactions automatically', icon: 'rules' },
  { to: '/import', label: 'Bulk import', description: 'From AI screenshots or a bank CSV', icon: 'upload' },
  { to: '/settings', label: 'Settings', description: 'Backup and delete data', icon: 'settings' },
];

/** Mobile-only menu for pages that don't fit in the tab bar. */
export function MorePage() {
  return (
    <div className="page">
      <PageHeader title="More" />
      <ul className="card more-list">
        {LINKS.map((l) => (
          <li key={l.to}>
            <Link to={l.to} className="more-link">
              <span className="icon-badge more-link__icon">
                <Icon name={l.icon} size={18} />
              </span>
              <span className="more-link__text">
                <span className="more-link__label">{l.label}</span>
                <span className="muted">{l.description}</span>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
