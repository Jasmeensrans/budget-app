import { useId, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CategoryIcon } from '../../components/CategoryIcon';
import { Icon, type IconName } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { Sheet } from '../../components/Sheet';
import { CategoryTag } from '../../components/Tag';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { createCategory, deleteCategory, nextCategoryColor, updateCategory } from '../../data/actions';
import { useCollection } from '../../data/live';
import type { Budget, Category, CategoryKind } from '../../data/types';
import { CATEGORY_COLORS, type CategoryColorName } from '../../lib/categoryColors';
import { cx } from '../../lib/cx';
import { formatCents } from '../../lib/money';
import { currentMonthKey } from '../../lib/months';

const ICON_CHOICES: IconName[] = [
  'cart', 'utensils', 'coffee', 'car', 'bag', 'ticket', 'bolt', 'heart', 'home', 'globe',
  'dollar', 'gift', 'sparkle', 'briefcase', 'phone', 'dumbbell', 'gauge', 'refresh', 'receipt', 'tag',
];
const COLOR_CHOICES = Object.keys(CATEGORY_COLORS) as CategoryColorName[];

const KINDS: Array<{ kind: CategoryKind; label: string; help: string }> = [
  { kind: 'spending', label: 'Spending', help: 'Counts toward what you spend. Money in here (refunds, reimbursements) reduces it.' },
  { kind: 'income', label: 'Income', help: 'Counts as money in, like paychecks and interest.' },
  { kind: 'transfer', label: 'Transfer', help: 'Money moving between your own accounts, like paying a credit card. Not counted as spending or income.' },
];

function describeBudget(b: Budget | undefined, kind: CategoryKind): string {
  if (kind === 'transfer') return 'Transfer · not counted';
  if (kind === 'income') return 'Income';
  if (!b) return 'No budget';
  if (b.type === 'fixed') return `Fixed · ${formatCents(b.amountCents, { whole: true })} a ${b.period}`;
  if (b.type === 'flexible') return `Flexible · ${formatCents(b.amountCents, { whole: true })} a month`;
  return `Sinking fund · ${formatCents(b.targetCents, { whole: true })} goal`;
}

export function CategoriesPage() {
  const categories = useCollection('categories');
  const budgets = useCollection('budgets');
  const transactions = useCollection('transactions');
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const editId = params.get('edit');
  const editing = editId ? categories.find((c) => c.id === editId) : undefined;
  const close = () => setParams({}, { replace: true });

  const month = currentMonthKey();
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; monthSpent: number }>();
    for (const t of transactions) {
      if (!t.categoryId) continue;
      const s = map.get(t.categoryId) ?? { count: 0, monthSpent: 0 };
      s.count++;
      if (t.date.startsWith(month)) s.monthSpent -= t.amountCents;
      map.set(t.categoryId, s);
    }
    return map;
  }, [transactions, month]);
  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));
  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page">
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} categories · ${budgets.length} with a budget`}
        actions={
          <Button variant="primary" icon="plus" onClick={() => setParams({ new: '1' })}>
            New category
          </Button>
        }
      />

      <div className="category-grid">
        {sorted.map((c) => {
          const s = stats.get(c.id);
          return (
            <div key={c.id} className="card category-card">
              <button type="button" className="category-card__main" onClick={() => setParams({ edit: c.id })}>
                <CategoryIcon category={c} size={40} />
                <span className="category-card__text">
                  <span className="category-card__name">{c.name}</span>
                  <span className="muted">{describeBudget(budgetByCategory.get(c.id), c.kind)}</span>
                </span>
                <Icon name="pencil" size={16} className="category-card__edit" />
              </button>
              <button
                type="button"
                className="category-card__stats"
                onClick={() => navigate(`/transactions?category=${c.id}&month=${month}`)}
              >
                <span>
                  {s?.count ?? 0} transaction{s?.count === 1 ? '' : 's'}
                </span>
                {s && s.monthSpent > 0 && <span>{formatCents(s.monthSpent, { whole: true })} this month</span>}
              </button>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <Sheet title={editing ? 'Edit category' : 'New category'} onClose={close}>
          <CategoryForm
            key={editing?.id ?? 'new'}
            initial={editing}
            categories={categories}
            transactionCount={editing ? (stats.get(editing.id)?.count ?? 0) : 0}
            hasBudget={editing ? budgetByCategory.has(editing.id) : false}
            onDone={close}
          />
        </Sheet>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  categories,
  transactionCount,
  hasBudget,
  onDone,
}: {
  initial?: Category;
  categories: Category[];
  transactionCount: number;
  hasBudget: boolean;
  onDone: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState<IconName>(initial?.icon ?? 'tag');
  const [color, setColor] = useState<CategoryColorName>(initial?.color ?? nextCategoryColor(categories));
  const [kind, setKind] = useState<CategoryKind>(initial?.kind ?? 'spending');
  const [submitted, setSubmitted] = useState(false);

  const trimmed = name.trim();
  const duplicate = categories.some((c) => c.id !== initial?.id && c.name.toLowerCase() === trimmed.toLowerCase());
  const error = !trimmed ? 'Give it a name' : duplicate ? 'There’s already a category with that name' : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (error) return;
    if (initial) {
      await updateCategory(initial.id, { name: trimmed, icon, color, kind });
      toast(`Saved ${trimmed}`);
    } else {
      await createCategory({ name: trimmed, icon, color, kind });
      toast(`Created ${trimmed}`);
    }
    onDone();
  }

  async function handleDelete() {
    if (!initial) return;
    const effects = [
      transactionCount > 0 && `${transactionCount} transaction${transactionCount === 1 ? '' : 's'} will become uncategorized`,
      hasBudget && 'its budget will be deleted',
      'any rules that use it will be deleted',
    ].filter(Boolean);
    const body = effects.join(', ');
    const ok = await confirm({
      title: `Delete ${initial.name}?`,
      body: body.charAt(0).toUpperCase() + body.slice(1) + '.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    await deleteCategory(initial.id);
    toast(`Deleted ${initial.name}`);
    onDone();
  }

  return (
    <form className="sheet-form" onSubmit={handleSubmit} noValidate>
      <div className="sheet__body">
        <div className="category-preview">
          <CategoryIcon category={{ id: '', name, icon, color, kind, createdAt: '', updatedAt: '' }} size={48} />
          <CategoryTag color={color} icon={icon}>
            {trimmed || 'New category'}
          </CategoryTag>
        </div>

        <div className="field">
          <label htmlFor={`${id}-name`} className="field__label">
            Name
          </label>
          <input
            id={`${id}-name`}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Coffee"
            autoFocus
            aria-invalid={submitted && error ? true : undefined}
          />
          {submitted && error && <span className="field__error">{error}</span>}
        </div>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">Type</legend>
          <div className="segmented segmented--3" role="group" aria-label="Category type">
            {KINDS.map((k) => (
              <button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)}>
                {k.label}
              </button>
            ))}
          </div>
          <p className="muted type-hint">{KINDS.find((k) => k.kind === kind)?.help}</p>
        </fieldset>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">Icon</legend>
          <div className="swatch-grid">
            {ICON_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className="icon-choice"
                aria-label={choice}
                aria-pressed={icon === choice}
                onClick={() => setIcon(choice)}
                style={icon === choice ? { background: CATEGORY_COLORS[color].bg, color: CATEGORY_COLORS[color].fg, borderColor: CATEGORY_COLORS[color].fg } : undefined}
              >
                <Icon name={choice} size={20} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field tx-form__fieldset">
          <legend className="field__label tx-form__legend">Color</legend>
          <div className="swatch-grid">
            {COLOR_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                className={cx('color-choice', color === choice && 'color-choice--on')}
                aria-label={choice}
                aria-pressed={color === choice}
                onClick={() => setColor(choice)}
                style={{ borderColor: color === choice ? CATEGORY_COLORS[choice].fg : 'transparent' }}
              >
                <span style={{ background: CATEGORY_COLORS[choice].bar }} />
              </button>
            ))}
          </div>
        </fieldset>

        {initial && (
          <Button variant="text" icon="trash" className="tx-form__delete" onClick={handleDelete}>
            Delete category
          </Button>
        )}
      </div>
      <div className="sheet__footer">
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" className="sheet__submit">
          {initial ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  );
}
