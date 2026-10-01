import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface SheetProps {
  title: string;
  onClose: () => void;
  /** The body and footer; use `.sheet__body` and `.sheet__footer` inside. */
  children: ReactNode;
}

/** A centered dialog on desktop and a full-screen sheet on mobile. */
export function Sheet({ title, onClose, children }: SheetProps) {
  const titleId = useId();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div
      className="sheet-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        <div className="sheet__header">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <Button variant="text" icon="close" aria-label="Close" onClick={onClose} className="sheet__close" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
