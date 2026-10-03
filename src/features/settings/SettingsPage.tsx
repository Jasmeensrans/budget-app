import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { signOut, useAuth } from '../../data/auth';
import {
  copyLocalDataToCloud,
  mergeBackup,
  readLocalData,
  deleteAllData,
  exportAll,
  restoreBackup,
  saveSettings,
  useSettings,
} from '../../data/actions';
import { useCollection } from '../../data/live';
import { todayISO } from '../../lib/dates';


export function SettingsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const id = useId();
  const transactions = useCollection('transactions');
  const budgets = useCollection('budgets');
  const rules = useCollection('rules');
  const categories = useCollection('categories');
  const accounts = useCollection('accounts');
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const restoreRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);
  const auth = useAuth();

  // Data saved in this browser before signing in, offered for a one-time move.
  const [localCounts, setLocalCounts] = useState<{ transactions: number; rules: number; categories: number } | null>(null);
  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    void readLocalData().then((d) =>
      setLocalCounts({ transactions: d.transactions.length, rules: d.rules.length, categories: d.categories.length }),
    );
  }, [auth.status]);

  async function handleCopyLocal() {
    const ok = await confirm({
      title: 'Move this browser’s data to your account?',
      body: 'Your accounts, categories, rules and transactions are copied into your account. Its starter categories are replaced by yours.',
      confirmLabel: 'Move data',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const result = await copyLocalDataToCloud();
      toast(`Moved ${result.transactions} transactions, ${result.categories} categories and ${result.rules} rules to your account`);
      setLocalCounts(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Couldn’t copy the data.');
    } finally {
      setBusy(false);
    }
  }

  // Exchange rate
  const [rate, setRate] = useState(String(settings.cadToUsd));
  useEffect(() => setRate(String(settings.cadToUsd)), [settings.cadToUsd]);
  const rateValue = Number(rate);
  const rateValid = Number.isFinite(rateValue) && rateValue > 0 && rateValue < 10;


  function handleExport() {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-budget-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded');
  }

  async function handleRestore(file: File) {
    const ok = await confirm({
      title: `Restore ${file.name}?`,
      body: 'This replaces everything here. Export a backup first if you might want what’s here now.',
      confirmLabel: 'Restore',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await restoreBackup(JSON.parse(await file.text()));
      toast(`Restored ${file.name}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That file couldn’t be restored.');
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge(file: File) {
    const ok = await confirm({
      title: `Add ${file.name}?`,
      body: 'Adds its transactions, categories, rules and accounts to what you have. Nothing is deleted, and transactions you already have are skipped.',
      confirmLabel: 'Add data',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const r = await mergeBackup(JSON.parse(await file.text()));
      const parts = [
        `${r.transactions} transactions`,
        r.categories && `${r.categories} categories`,
        r.rules && `${r.rules} rules`,
        r.accounts && `${r.accounts} accounts`,
      ].filter(Boolean);
      toast(`Added ${parts.join(', ')}${r.skippedTransactions ? ` · skipped ${r.skippedTransactions} you already had` : ''}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That file couldn’t be added.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAll() {
    const ok = await confirm({
      title: 'Delete all data?',
      body: 'Every transaction, budget, rule, account and category is deleted. This can’t be undone. Export a backup first if you might want it.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    await deleteAllData();
    setBusy(false);
    toast('All data deleted. Starter categories are back.');
  }

  return (
    <div className="page">
      <PageHeader title="Settings" />

      {auth.status === 'signedIn' && (
        <section className="card settings-card">
          <div className="settings-row settings-row--first">
            <div>
              <p className="settings-row__title">Signed in</p>
              <p className="muted">
                {auth.user.email ?? auth.user.name ?? 'Google account'} · synced across your devices
              </p>
            </div>
            <Button onClick={() => void signOut()}>Sign out</Button>
          </div>
          {localCounts && localCounts.transactions + localCounts.rules > 0 && (
            <div className="settings-row">
              <div>
                <p className="settings-row__title">Move this browser’s data to your account</p>
                <p className="muted">
                  This browser has {localCounts.transactions} transactions, {localCounts.categories} categories and{' '}
                  {localCounts.rules} rules saved from before you signed in.
                </p>
              </div>
              <Button variant="primary" icon="upload" onClick={handleCopyLocal} loading={busy}>
                Move data
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="card settings-card">
        <div className="settings-row settings-row--first">
          <div>
            <p className="settings-row__title">Accounts</p>
            <p className="muted">
              {accounts.length} account{accounts.length === 1 ? '' : 's'}: {accounts.map((a) => a.name).join(', ') || 'none yet'}
            </p>
          </div>
          <Link to="/accounts" className="btn btn--secondary btn--md">
            Manage accounts
          </Link>
        </div>
      </section>

      <section className="card settings-card" aria-labelledby={`${id}-currency`}>
        <div className="card-heading">
          <h2 id={`${id}-currency`} className="card-title">
            Currency
          </h2>
          <p className="muted">
            Everything is shown in USD. Transactions from CAD accounts are converted with this rate when you import them,
            and keep their original CAD amount.
          </p>
        </div>
        <form
          className="rate-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!rateValid) return;
            await saveSettings({ cadToUsd: rateValue });
            toast(`Saved: 1 CAD = ${rateValue} USD`);
          }}
        >
          <label htmlFor={`${id}-rate`}>1 CAD =</label>
          <input
            id={`${id}-rate`}
            className="input"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            aria-invalid={rateValid ? undefined : true}
          />
          <span>USD</span>
          <Button type="submit" disabled={!rateValid || rateValue === settings.cadToUsd}>
            Save
          </Button>
        </form>
      </section>

      <section className="card settings-card" aria-labelledby={`${id}-data`}>
        <div className="card-heading">
          <h2 id={`${id}-data`} className="card-title">
            Your data
          </h2>
          <p className="muted">
            {auth.status === 'signedIn' ? 'Saved to your account.' : 'Saved in this browser only.'} Right now: {transactions.length} transactions,{' '}
            {categories.length} categories, {budgets.length} budgets, {rules.length} rules.
          </p>
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row__title">Export a backup</p>
            <p className="muted">Downloads everything as one JSON file.</p>
          </div>
          <Button icon="download" onClick={handleExport}>
            Export
          </Button>
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row__title">Add from a file</p>
            <p className="muted">Merges a data file into what you have. Nothing is deleted; duplicates are skipped.</p>
          </div>
          <Button icon="upload" onClick={() => mergeRef.current?.click()} loading={busy}>
            Add from file
          </Button>
          <input
            ref={mergeRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleMerge(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row__title">Restore a backup</p>
            <p className="muted">Replaces everything here with a backup file, including categories, rules and accounts.</p>
          </div>
          <Button icon="upload" onClick={() => restoreRef.current?.click()} loading={busy}>
            Restore
          </Button>
          <input
            ref={restoreRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleRestore(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-row__title">Delete all data</p>
            <p className="muted">Clears everything on this device.</p>
          </div>
          <Button variant="danger" onClick={handleDeleteAll} loading={busy}>
            Delete all
          </Button>
        </div>
      </section>
    </div>
  );
}
