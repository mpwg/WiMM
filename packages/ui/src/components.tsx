// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useDraftGuard } from './drafts.js';

export function Button({ variant = 'secondary', icon: Icon, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; readonly icon?: LucideIcon }) {
  return <button type="button" {...props} className={`button ${variant} ${className}`}>
    {Icon === undefined ? null : <Icon size={18} aria-hidden="true" />}{children}
  </button>;
}

/** Native HTML-Modalität, Entwurfsschutz und Rückkehrfokus für alle Arbeitsdialoge. */
export function Dialog({ title, children, onClose, busy = false, className = '' }: { readonly title: string; readonly children: ReactNode; readonly onClose: () => void; readonly busy?: boolean; readonly className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const guard = useDraftGuard();
  useEffect(() => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLElement>('input:not([type=checkbox]), select, textarea')?.focus();
    const element = dialog.current;
    return () => {
      element?.close();
      const previous = trigger.current;
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
        else document.querySelector<HTMLElement>('.finance-main h1')?.focus();
      });
    };
  }, []);
  function close() {
    if (busy) return;
    const form = dialog.current?.querySelector('form');
    guard.request(onClose, form ?? undefined);
  }
  return <dialog ref={dialog} className={`confirmation-dialog work-dialog ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="dialog-heading"><h2>{title}</h2><Button variant="quiet" icon={X} aria-label="Dialog schließen" disabled={busy} onClick={close} /></div>
    {children}
    <div className="dialog-actions"><Button onClick={close} disabled={busy}>Abbrechen</Button></div>
  </dialog>;
}

export function EmptyState({ title, children, action }: { readonly title: string; readonly children: ReactNode; readonly action?: ReactNode }) {
  return <section className="empty"><h2>{title}</h2><p>{children}</p>{action}</section>;
}

export function Status({ children, error = false }: { readonly children: ReactNode; readonly error?: boolean }) {
  return <p className={error ? 'notice error' : 'help-text'} role={error ? 'alert' : 'status'}>{children}</p>;
}
