import { HashRouter, Route, Routes } from 'react-router-dom';
import { ConfirmProvider } from './components/Confirm';
import { ToastProvider } from './components/Toast';
import { AuthProvider, useAuth } from './data/auth';
import { LoadingScreen, SignInPage } from './features/auth/SignInPage';
import { AccountsPage } from './features/accounts/AccountsPage';
import { BudgetsPage } from './features/budgets/BudgetsPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ImportPage } from './features/import/ImportPage';
import { RulesPage } from './features/rules/RulesPage';
import { MorePage } from './features/settings/MorePage';
import { SettingsPage } from './features/settings/SettingsPage';
import { TransactionsPage } from './features/transactions/TransactionsPage';
import { AppShell } from './layout/AppShell';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** Signed in (or in local mode): the app. Otherwise: sign-in. */
function AuthGate() {
  const auth = useAuth();
  if (auth.status === 'loading') return <LoadingScreen label="Starting up…" />;
  if (auth.status === 'signedOut') return <SignInPage />;
  return <Routed key={auth.status === 'signedIn' ? auth.user.uid : 'local'} />;
}

function Routed() {
  return (
    <HashRouter>
      <ToastProvider>
        <ConfirmProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="budgets" element={<BudgetsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </HashRouter>
  );
}
