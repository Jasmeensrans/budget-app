import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { Pill } from '../../components/Tag';
import { useToast } from '../../components/Toast';
import { importTransactions, useSettings, type ImportRowInput } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Account, Category, Cents, CurrencyCode, Rule, Transaction } from '../../data/types';
import { buildAiPrompt, LINES_EXAMPLE, parseImport, type ParsedImportRow } from '../../domain/importFormat';
import { cleanDescription } from '../../domain/merchant';
import { findMatchingRule } from '../../domain/rules';
import { CATEGORY_COLORS } from '../../lib/categoryColors';
import { cx } from '../../lib/cx';
import { formatShortDate } from '../../lib/dates';
import { formatCents } from '../../lib/money';

/** Where a row's category came from. Rules win over the AI; your own changes win over both. */
type CategorySource = 'rule' | 'ai' | 'you' | null;

interface ReviewRow {
  key: number;
  include: boolean;
  date: string;
  description: string;
  rawDescription: string;
  /** Always USD. */
  amountCents: Cents;
  original: { amountCents: Cents; currency: CurrencyCode } | null;
  categoryId: string | null;
  source: CategorySource;
  /** The AI named a category that doesn't exist. */
  unknownSuggestion: string | null;
  duplicate: boolean;
  importId: string | null;
}

type View = 'all' | 'needs' | 'duplicates';

const LAST_ACCOUNT_KEY = 'budget-app:last-import-account';

function planRows(
  parsed: ParsedImportRow[],
  { categories, rules, existing, account, cadToUsd }: {
    categories: Category[];
    rules: Rule[];
    existing: Transaction[];
    account: Account | undefined;
    cadToUsd: number;
  },
): ReviewRow[] {
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const importIds = new Set(existing.map((t) => t.importId).filter(Boolean));
  const fingerprints = new Set(
    existing.map((t) => `${t.date}|${t.amountCents}|${(t.rawDescription ?? t.description).toLowerCase()}`),
  );
  const currency: CurrencyCode = account?.currency ?? 'USD';

  return parsed.map((row) => {
    const amountCents = currency === 'CAD' ? Math.round(row.amountCents * cadToUsd) : row.amountCents;
    const description = cleanDescription(row.rawDescription);
    const rule = findMatchingRule(rules, { description, rawDescription: row.rawDescription, amountCents });

    let categoryId: string | null = null;
    let source: CategorySource = null;
    let unknownSuggestion: string | null = null;
    if (rule) {
      categoryId = rule.categoryId;
      source = 'rule';
    } else if (row.categoryName) {
      const id = byName.get(row.categoryName.toLowerCase());
      if (id) {
        categoryId = id;
        source = 'ai';
      } else {
        unknownSuggestion = row.categoryName;
      }
    }

    const duplicate =
      (!!row.importId && importIds.has(row.importId)) ||
      fingerprints.has(`${row.date}|${amountCents}|${row.rawDescription.toLowerCase()}`);

    return {
      key: row.position,
      include: !duplicate,
      date: row.date,
      description,
      rawDescription: row.rawDescription,
      amountCents,
      original: currency === 'USD' ? null : { amountCents: row.amountCents, currency },
      categoryId,
      source,
      unknownSuggestion,
      duplicate,
      importId: row.importId,
    };
  });
}

export function ImportPage() {
  const categories = useCollection('categories');
  const rules = useCollection('rules');
  const transactions = useCollection('transactions');
  const accounts = useCollection('accounts');
  const settings = useSettings();
  const navigate = useNavigate();
  const toast = useToast();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [accountId, setAccountId] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_ACCOUNT_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [view, setView] = useState<View>('all');
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  // Fall back to the first account if the remembered one is gone.
  const account = accounts.find((a) => a.id === accountId);
  useEffect(() => {
    if (!account && accounts.length > 0 && accountId !== 'none') setAccountId(accounts[0].id);
  }, [account, accounts, accountId]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const promptNames = useMemo(() => sortedCategories.map((c) => c.name), [sortedCategories]);

  function chooseAccount(value: string) {
    setAccountId(value);
    try {
      localStorage.setItem(LAST_ACCOUNT_KEY, value);
    } catch {
      // Remembering the account is only a convenience.
    }
  }

  function review() {
    const result = parseImport(text, { positiveIsSpending: account?.kind === 'credit' });
    setErrors(result.errors);
    setSkipped(result.skipped);
    setView('all');
    setRows(
      result.rows.length
        ? planRows(result.rows, { categories, rules, existing: transactions, account, cadToUsd: settings.cadToUsd })
        : null,
    );
  }

  async function loadFile(file: File) {
    setText(await file.text());
    toast(`Loaded ${file.name}`);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(buildAiPrompt(promptNames));
      toast('Prompt copied. Paste it into ChatGPT, Gemini or Claude with your screenshots.');
    } catch {
      toast('Couldn’t copy automatically. Open “See the prompt” and copy it from there.');
    }
  }

  const update = (key: number, patch: Partial<ReviewRow>) =>
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const included = rows?.filter((r) => r.include) ?? [];
  const counts = {
    rule: included.filter((r) => r.source === 'rule').length,
    ai: included.filter((r) => r.source === 'ai').length,
    needs: included.filter((r) => !r.categoryId).length,
    duplicates: rows?.filter((r) => r.duplicate).length ?? 0,
  };
  const net = included.reduce((s, r) => s + r.amountCents, 0);
  const visible =
    rows?.filter((r) => (view === 'needs' ? r.include && !r.categoryId : view === 'duplicates' ? r.duplicate : true)) ?? [];
  const allVisibleOn = visible.length > 0 && visible.every((r) => r.include);

  async function runImport() {
    if (included.length === 0) return;
    setImporting(true);
    const payload: ImportRowInput[] = included.map((r) => ({
      date: r.date,
      amountCents: r.amountCents,
      description: r.description,
      rawDescription: r.rawDescription,
      categoryId: r.categoryId,
      accountId: account?.id ?? null,
      original: r.original,
      note: '',
      source: 'import',
      importId: r.importId,
      newCategoryName: null,
    }));
    const result = await importTransactions(payload);
    setImporting(false);
    setDone(result.transactions);
    setRows(null);
    setText('');
  }

  if (done !== null) {
    return (
      <div className="page">
        <PageHeader title="Import transactions" />
        <div className="card empty-card">
          <span className="coming-soon__icon">
            <Icon name="check" size={24} strokeWidth={2.6} />
          </span>
          <p className="coming-soon__title">
            Imported {done} transaction{done === 1 ? '' : 's'}
            {account ? ` into ${account.name}` : ''}
          </p>
          <div className="empty-actions">
            <Button variant="primary" onClick={() => navigate('/transactions')}>
              View transactions
            </Button>
            <Button onClick={() => setDone(null)}>Import more</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="Import transactions"
        subtitle="Paste what your AI assistant sends back, or a CSV from your bank. You review everything before it’s saved."
      />

      <ol className="steps" aria-label="Import steps">
        <li className={cx('step', rows ? 'step--done' : 'step--current')}>
          <span className="step__dot">{rows ? <Icon name="check" size={12} strokeWidth={3} /> : 1}</span>
          Paste
        </li>
        <li className="step__line" aria-hidden="true" />
        <li className={cx('step', rows && 'step--current')}>
          <span className="step__dot">2</span>
          Review categories
        </li>
        <li className="step__line" aria-hidden="true" />
        <li className="step">
          <span className="step__dot">3</span>
          Import
        </li>
      </ol>

      {!rows ? (
        <div className="import-grid">
          <div className="card import-paste">
            <div className="field">
              <label htmlFor={`${id}-account`} className="field__label">
                Account
              </label>
              <select
                id={`${id}-account`}
                className="input"
                value={account ? account.id : 'none'}
                onChange={(e) => chooseAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency}
                    {a.kind === 'credit' ? ', credit card' : ''})
                  </option>
                ))}
                <option value="none">No account</option>
              </select>
              {account?.currency === 'CAD' && (
                <span className="muted">
                  Amounts are in CAD and will be converted at 1 CAD = {settings.cadToUsd} USD.{' '}
                  <Link to="/settings">Change the rate</Link>
                </span>
              )}
              {accounts.length === 0 && (
                <span className="muted">
                  <Link to="/accounts?new=1">Add your accounts</Link> to keep track of where transactions came from.
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor={`${id}-text`} className="field__label">
                Transactions
              </label>
              <textarea
                id={`${id}-text`}
                className="input textarea code-input"
                rows={12}
                spellCheck={false}
                placeholder={LINES_EXAMPLE}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {errors.length > 0 && (
              <ul className="import-errors" role="alert">
                {errors.map((e) => (
                  <li key={e}>
                    <Icon name="alert" size={14} />
                    {e}
                  </li>
                ))}
              </ul>
            )}

            <div className="import-paste__actions">
              <Button variant="primary" onClick={review} disabled={!text.trim()}>
                Review transactions
              </Button>
              <Button icon="upload" onClick={() => fileRef.current?.click()}>
                Upload CSV
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          <div className="card import-help">
            <h2 className="card-title">From screenshots</h2>
            <ol className="import-help__steps">
              <li>Screenshot your account activity in your bank’s app.</li>
              <li>Copy the prompt and send it to ChatGPT, Gemini or Claude with the screenshots.</li>
              <li>Tap the copy button on its answer and paste it here.</li>
            </ol>
            <Button variant="soft" icon="sparkle" onClick={copyPrompt}>
              Copy AI prompt
            </Button>
            <details className="import-help__format">
              <summary>See the prompt</summary>
              <pre className="prompt-preview">{buildAiPrompt(promptNames)}</pre>
            </details>
            <h2 className="card-title import-help__second">From a bank export</h2>
            <p className="muted">
              Upload a CSV with Date, Description and Amount columns. For credit cards, purchases listed as positive
              numbers are read as money out.
            </p>
          </div>
        </div>
      ) : (
        <div className="card import-review">
          <div className="card__header">
            <div className="card-heading">
              <h2 className="card-title">
                Review {rows.length} transactions{account ? ` for ${account.name}` : ''}
              </h2>
              <span className="muted">
                Rules picked a category first, then the AI’s suggestion. Change anything that’s wrong, then import.
              </span>
            </div>
          </div>

          <div className="pill-row pill-row--wrap">
            {counts.rule > 0 && <Pill tone="good">{counts.rule} from rules</Pill>}
            {counts.ai > 0 && <Pill tone="info">{counts.ai} from AI</Pill>}
            {counts.needs > 0 && <Pill tone="warn">{counts.needs} need a category</Pill>}
            {counts.duplicates > 0 && <Pill tone="over">{counts.duplicates} possible duplicates</Pill>}
            {skipped > 0 && <Pill>{skipped} $0.00 skipped</Pill>}
            {errors.length > 0 && <Pill tone="over">{errors.length} couldn’t be read</Pill>}
          </div>

          {errors.length > 0 && (
            <ul className="import-errors">
              {errors.map((e) => (
                <li key={e}>
                  <Icon name="alert" size={14} />
                  {e}
                </li>
              ))}
            </ul>
          )}

          <div className="toolbar">
            <div className="filter-chips" role="group" aria-label="Show">
              {(
                [
                  ['all', `All ${rows.length}`],
                  ['needs', `Needs a category ${counts.needs}`],
                  ['duplicates', `Duplicates ${counts.duplicates}`],
                ] as Array<[View, string]>
              ).map(([value, label]) => (
                <button key={value} type="button" className="filter-chip" aria-pressed={view === value} onClick={() => setView(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="review-head">
            <label>
              <input
                type="checkbox"
                checked={allVisibleOn}
                onChange={(e) => {
                  const on = e.target.checked;
                  const keys = new Set(visible.map((r) => r.key));
                  setRows((rs) => rs && rs.map((r) => (keys.has(r.key) ? { ...r, include: on } : r)));
                }}
              />
              <span>Include all shown</span>
            </label>
          </div>

          <ul className="review-list">
            {visible.map((r) => {
              const category = r.categoryId ? categoryById.get(r.categoryId) : undefined;
              const colors = category ? CATEGORY_COLORS[category.color] : null;
              return (
                <li key={r.key} className={cx('review-row', r.duplicate && 'review-row--duplicate', !r.include && 'review-row--off')}>
                  <input
                    type="checkbox"
                    checked={r.include}
                    aria-label={`Import ${r.description}`}
                    onChange={(e) => update(r.key, { include: e.target.checked })}
                  />
                  <span className="review-row__date">{formatShortDate(r.date)}</span>
                  <div className="review-row__main">
                    <span className="review-row__desc">{r.description}</span>
                    {r.rawDescription !== r.description && <span className="review-row__raw">{r.rawDescription}</span>}
                    {r.duplicate && (
                      <span className="review-row__flag review-row__flag--warn">
                        <Icon name="alert" size={12} />
                        Looks like one you already have
                      </span>
                    )}
                    {r.unknownSuggestion && !r.categoryId && (
                      <span className="review-row__flag review-row__flag--info">
                        AI suggested “{r.unknownSuggestion}”, which isn’t one of your categories
                      </span>
                    )}
                  </div>
                  <div className="review-row__cat">
                    <span className={cx('source-badge', r.source && `source-badge--${r.source}`)}>
                      {r.source === 'rule' ? 'Rule' : r.source === 'ai' ? 'AI' : r.source === 'you' ? 'You' : 'None'}
                    </span>
                    <label className="review-row__select">
                      <span className="sr-only">Category for {r.description}</span>
                      <select
                        className={cx('input', !r.categoryId && 'input--needs')}
                        value={r.categoryId ?? ''}
                        style={colors ? { background: colors.bg, color: colors.fg, borderColor: 'transparent' } : undefined}
                        onChange={(e) => update(r.key, { categoryId: e.target.value || null, source: 'you' })}
                      >
                        <option value="">Uncategorized</option>
                        {sortedCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <span className="review-row__amount">
                    <span className={cx('amount', r.amountCents > 0 && 'amount--in')}>
                      {formatCents(r.amountCents, { showPlus: true })}
                    </span>
                    {r.original && (
                      <span className="review-row__original">
                        {formatCents(r.original.amountCents, { showPlus: true })} {r.original.currency}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
            {visible.length === 0 && <li className="muted card-empty">Nothing here.</li>}
          </ul>

          <div className="import-summary">
            <div className="import-summary__text">
              <strong>
                {included.length} selected · net {formatCents(net, { showPlus: true })} USD
              </strong>
              <span className="muted">
                {counts.needs > 0
                  ? `${counts.needs} will be imported as uncategorized. You can categorize them later.`
                  : 'Every selected transaction has a category.'}
              </span>
            </div>
            <div className="import-summary__actions">
              <Button onClick={() => setRows(null)}>Back</Button>
              <Button variant="primary" onClick={runImport} loading={importing} disabled={included.length === 0}>
                Approve and import {included.length}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
