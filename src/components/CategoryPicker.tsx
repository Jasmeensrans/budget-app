import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCollection } from '../data/live';
import type { ID } from '../data/types';
import { cx } from '../lib/cx';
import { CategoryIcon } from './CategoryIcon';
import { Icon } from './Icon';
import { CategoryTag } from './Tag';

interface CategoryPickerProps {
  value: ID | null;
  onChange: (categoryId: ID | null) => void;
  /** Accessible name for the trigger, e.g. "Category for Trader Joe's". */
  label: string;
}

/** A category tag that opens a searchable list to change or remove the category. */
export function CategoryPicker({ value, onChange, label }: CategoryPickerProps) {
  const categories = useCollection('categories');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = categories.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = categories
    .filter((c) => !q || c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  function pick(id: ID | null) {
    setOpen(false);
    setQuery('');
    if (id !== value) onChange(id);
  }

  return (
    <div
      className="picker"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className={cx('picker__trigger', !selected && 'picker__trigger--empty', open && 'picker__trigger--open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${selected?.name ?? 'Uncategorized'}. Change`}
        onClick={() => setOpen((o) => !o)}
      >
        {selected ? (
          <CategoryTag color={selected.color} icon={selected.icon}>
            {selected.name}
          </CategoryTag>
        ) : (
          <span className="tag tag--empty">
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Add category
          </span>
        )}
      </button>

      {open && (
        <div className="picker__popover">
          <label className="picker__search">
            <Icon name="search" size={15} />
            <span className="sr-only">Search categories</span>
            <input autoFocus placeholder="Search categories" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <ul id={listId} role="listbox" aria-label="Categories" className="picker__list">
            {matches.map((c) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button type="button" className="picker__option" onClick={() => pick(c.id)}>
                  <CategoryIcon category={c} size={22} />
                  <span>{c.name}</span>
                  {c.id === value && <Icon name="check" size={15} strokeWidth={2.6} className="picker__check" />}
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="picker__none">No categories match.</li>}
          </ul>
          <div className="picker__footer">
            {value && (
              <button type="button" className="picker__option picker__option--muted" onClick={() => pick(null)}>
                <Icon name="close" size={15} />
                Remove category
              </button>
            )}
            <Link to="/categories?new=1" className="picker__option picker__option--link">
              <Icon name="plus" size={15} />
              New category
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
