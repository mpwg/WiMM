// SPDX-License-Identifier: AGPL-3.0-or-later
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

function values(form: HTMLFormElement): string {
  return JSON.stringify([...form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')].map((field) => [field.type, field.value, field instanceof HTMLInputElement ? field.checked : false]));
}
interface DraftGuard {
  register(form: HTMLFormElement): () => void;
  registerPending(id: string, dirty: boolean): () => void;
  saved(form: HTMLFormElement): void;
  request(action: () => void, form?: HTMLFormElement, trigger?: HTMLElement): void;
}
const DraftContext = createContext<DraftGuard>({ register: () => () => undefined, registerPending: () => () => undefined, saved: () => undefined, request: (action) => action() });
export const useDraftGuard = () => useContext(DraftContext);
export function useFormDraft(form: RefObject<HTMLFormElement | null>) {
  const guard = useDraftGuard();
  const [savedVersion, setSavedVersion] = useState(0);
  useLayoutEffect(() => form.current === null ? undefined : guard.register(form.current), [form, guard]);
  // Nach dem React-Commit sind die zurückgesetzten Felder schon sauber,
  // bevor die nächste Navigation oder ein nativer Menübefehl sie lesen kann.
  useLayoutEffect(() => { if (savedVersion > 0 && form.current !== null) guard.saved(form.current); }, [savedVersion, form, guard]);
  return () => setSavedVersion((version) => version + 1);
}
export function DraftProtection({ children }: { readonly children: ReactNode }) {
  const pendingDrafts = useRef(new Map<string, boolean>());
  const forms = useRef(new Map<HTMLFormElement, string>());
  const [pending, setPending] = useState<{ action: () => void; trigger: HTMLElement | null }>();
  const dialog = useRef<HTMLDialogElement>(null);
  const [guard] = useState<DraftGuard>(() => ({
    registerPending(id, dirty) { pendingDrafts.current.set(id, dirty); return () => { pendingDrafts.current.delete(id); }; },
    register(form) { forms.current.set(form, values(form)); return () => { forms.current.delete(form); }; },
    saved(form) { forms.current.set(form, values(form)); },
    request(action, form, trigger) {
      const dirty = [...pendingDrafts.current.values()].some(Boolean) || [...forms.current].some(([element, baseline]) => element.isConnected && (form === undefined || element === form) && values(element) !== baseline);
      if (dirty) setPending({ action, trigger: trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null) });
      else action();
    }
  }));
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if ([...pendingDrafts.current.values()].some(Boolean) || [...forms.current].some(([form, baseline]) => form.isConnected && values(form) !== baseline)) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', unload); return () => window.removeEventListener('beforeunload', unload);
  }, []);
  useEffect(() => {
    // Der oberste native HTML-Dialog behält den Tabfokus auch am Rand;
    // bei verschachtelten Verwerfungsfragen bleibt nur diese Frage aktiv.
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const modal = [...document.querySelectorAll<HTMLDialogElement>('dialog:modal')].at(-1);
      if (modal === undefined) return;
      const controls = [...modal.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')].filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (first === undefined || last === undefined) { event.preventDefault(); modal.focus(); return; }
      if (!modal.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, []);
  useEffect(() => { if (pending !== undefined) dialog.current?.showModal(); }, [pending]);
  function cancel() { const trigger = pending?.trigger; dialog.current?.close(); setPending(undefined); requestAnimationFrame(() => trigger?.focus()); }
  return <DraftContext.Provider value={guard}>{children}{pending === undefined ? null : <dialog ref={dialog} className="confirmation-dialog" aria-labelledby="draft-title" onCancel={(event) => { event.preventDefault(); cancel(); }}>
    <h2 id="draft-title">Ungespeicherte Eingaben verwerfen?</h2><p>Die geänderten Eingaben sind noch nicht gespeichert.</p><div className="dialog-actions"><button type="button" autoFocus onClick={cancel}>Weiter bearbeiten</button><button type="button" onClick={() => { const action = pending.action; dialog.current?.close(); setPending(undefined); action(); }}>Eingaben verwerfen</button></div>
  </dialog>}</DraftContext.Provider>;
}
