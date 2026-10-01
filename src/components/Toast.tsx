import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

interface ToastState {
  id: number;
  text: string;
  action?: ToastAction;
}

type ShowToast = (text: string, action?: ToastAction) => void;

const ToastContext = createContext<ShowToast>(() => undefined);

/** Shows one message at a time at the bottom of the screen, optionally with an action like Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(1);

  const show = useCallback<ShowToast>((text, action) => {
    setToast({ id: nextId.current++, text, action });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <Icon name="check" size={16} strokeWidth={2.6} />
            <span className="toast__text">{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={async () => {
                  const action = toast.action!;
                  setToast(null);
                  await action.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button type="button" className="toast__close" aria-label="Dismiss" onClick={() => setToast(null)}>
              <Icon name="close" size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
