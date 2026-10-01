import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { ensureDefaultCategories, useContributionSync } from '../data/actions';
import { useAuth } from '../data/auth';
import { useCollectionsLoaded } from '../data/live';
import { LoadingScreen } from '../features/auth/SignInPage';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/transactions', label: 'Transactions', icon: 'list' },
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/accounts', label: 'Accounts', icon: 'bank' },
  { to: '/categories', label: 'Categories', icon: 'tag' },
  { to: '/rules', label: 'Rules', icon: 'rules' },
  { to: '/import', label: 'Import', icon: 'upload' },
];

// Mobile tab bar: two tabs, the + button, two tabs. "More" holds the rest.
const TABS_LEFT: NavItem[] = [
  { to: '/', label: 'Home', icon: 'dashboard' },
  { to: '/transactions', label: 'Activity', icon: 'list' },
];
const TABS_RIGHT: NavItem[] = [
  { to: '/budgets', label: 'Budgets', icon: 'budget' },
  { to: '/more', label: 'More', icon: 'grid' },
];
const MORE_PATHS = ['/more', '/accounts', '/categories', '/rules', '/import', '/settings'];

export function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuth();
  const ready = useCollectionsLoaded(['accounts', 'settings', 'categories', 'transactions', 'budgets', 'contributions', 'rules']);

  useEffect(() => {
    void ensureDefaultCategories();
  }, []);
  useContributionSync();

  // Start each page at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="brand-mark">
            <Icon name="leaf" size={16} strokeWidth={2.2} />
          </span>
          My Budget
        </div>

        <nav aria-label="Main">
          <div className="sidebar__section-label">Pages</div>
          <div className="nav">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav__link">
                <Icon name={item.icon} size={16} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar__footer">
          <Button variant="primary" icon="plus" onClick={() => navigate('/transactions?new=1')}>
            New transaction
          </Button>
          <div className="nav">
            <NavLink to="/settings" className="nav__link">
              <Icon name="settings" size={16} />
              Settings
            </NavLink>
          </div>
          <div className="save-status">
            <span className="save-status__dot" aria-hidden="true" />
            {auth.status === 'signedIn' ? 'Synced to your account' : 'Saved on this device'}
          </div>
        </div>
      </aside>

      <main className="main">{ready ? <Outlet /> : <LoadingScreen />}</main>

      <nav className="tabbar" aria-label="Main">
        {TABS_LEFT.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
        <NavLink to="/transactions?new=1" className="tabbar__add" aria-label="New transaction">
          <Icon name="plus" size={24} strokeWidth={2.4} />
        </NavLink>
        {TABS_RIGHT.map((item) => (
          <TabLink key={item.to} item={item} forceActive={item.to === '/more' && MORE_PATHS.includes(pathname)} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ item, forceActive = false }: { item: NavItem; forceActive?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => `tabbar__link${isActive || forceActive ? ' active' : ''}`}
    >
      <Icon name={item.icon} size={22} strokeWidth={1.9} />
      <span>{item.label}</span>
    </NavLink>
  );
}
