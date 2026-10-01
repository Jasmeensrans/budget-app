import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  /** Destructive actions get the red button. */
  danger?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(async () => false);

/**
 * In-app "Are you sure?" dialog. Replaces window.confirm, which some browsers
 * (in-app browsers, some phone browsers) block or silently answer "no".
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog {...request} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Continue',
  danger = false,
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return createPortal(
    <div
      className="sheet-backdrop confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
    >
      <div
        className="sheet confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose(false);
        }}
      >
        <div className="confirm__body">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          {body && <div className="muted confirm__text">{body}</div>}
        </div>
        <div className="confirm__footer">
          <Button ref={cancelRef} onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useConfirm(): Confirm {
  return useContext(ConfirmContext);
}
