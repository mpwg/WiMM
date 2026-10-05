// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { UUID } from '@wimm/contracts';
import { parseFinanceDate, parseMoney, type TransactionAggregate, type TransferAggregate } from '@wimm/domain';
import { TransferForm } from './account-actions.js';
import { useDraftGuard, useFormDraft } from './drafts.js';
import { FinanceModel, formatMoney } from './workspace.js';

// Nur Textformatierung; Betragsprüfung und Splitsummen bleiben im Fachkern.
function moneyText(cents: number): string {
  const value = BigInt(cents); const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : ''}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')}`;
}
function errorText(reason: unknown): string {
  if (reason instanceof Error && /revision|stale/i.test(reason.message)) return 'Die Buchung wurde inzwischen geändert. Bitte öffnen Sie den aktuellen Stand erneut; Ihre Eingaben bleiben erhalten.';
  if (reason instanceof Error && /quota|disk|full|space/i.test(reason.message)) return 'Der lokale Speicher ist voll. Ihre Eingaben bleiben erhalten. Schaffen Sie Platz und versuchen Sie es erneut.';
  return reason instanceof Error ? reason.message : 'Die Buchung wurde nicht gespeichert. Ihre Eingaben bleiben erhalten.';
}
interface SplitDraft { id: string; categoryId: string; amount: string }

export function Transactions({ model }: { readonly model: FinanceModel }) {
  if (model.accounts.length === 0) return <section className="empty"><h2>Noch kein Konto</h2><p>Legen Sie zuerst ein Konto an. Dann können Sie auch dessen Anfangsbestand erfassen.</p></section>;
  return <section><TransactionForm model={model} /><TransactionList model={model} /></section>;
}

function TransactionForm({ model, previous, onSaved, onBusy }: { readonly model: FinanceModel; readonly previous?: TransactionAggregate; readonly onSaved?: () => void; readonly onBusy?: (value: boolean) => void }) {
  const form = useRef<HTMLFormElement>(null); const saved = useFormDraft(form);
  const [accountId, setAccountId] = useState(previous?.accountId ?? '');
  const [categoryId, setCategoryId] = useState(previous?.splits[0]?.categoryId ?? '');
  const [secondCategoryId, setSecondCategoryId] = useState(previous?.splits[1]?.categoryId ?? '');
  const [firstAmount, setFirstAmount] = useState(previous?.splits[0] === undefined ? '' : moneyText(previous.splits[0].amount));
  const [secondAmount, setSecondAmount] = useState(previous?.splits[1] === undefined ? '' : moneyText(previous.splits[1].amount));
  const [extra, setExtra] = useState<SplitDraft[]>(previous?.splits.slice(2).map((split) => ({ id: split.id, categoryId: split.categoryId, amount: moneyText(split.amount) })) ?? []);
  const [payeeId, setPayeeId] = useState(previous?.payeeId ?? '');
  const [amount, setAmount] = useState(previous === undefined ? '' : moneyText(previous.amount));
  const [date, setDate] = useState<string>(previous?.date ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(new Date()));
  const [note, setNote] = useState(previous?.note ?? ''); const [opening, setOpening] = useState(previous?.kind === 'opening');
  const [error, setError] = useState<string>(); const [amountError, setAmountError] = useState<string>(); const [dateError, setDateError] = useState<string>();
  const [saving, setSaving] = useState(false); const submitting = useRef(false);
  const amountField = useRef<HTMLInputElement>(null); const dateField = useRef<HTMLInputElement>(null);
  const prefix = previous?.id ?? 'transaction';
  const categories = model.allCategories.filter((entry) => !entry.archived || previous?.splits.some((split) => split.categoryId === entry.id));
  const options = categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    setError(undefined); setAmountError(undefined); setDateError(undefined);
    let invalid = false;
    try { parseMoney(amount, 'Der Betrag'); } catch (reason) { setAmountError(errorText(reason)); amountField.current?.focus(); invalid = true; }
    try { parseFinanceDate(date, 'Das Datum'); } catch (reason) { setDateError(errorText(reason)); if (!invalid) dateField.current?.focus(); invalid = true; }
    if (invalid) return;
    submitting.current = true; setSaving(true); onBusy?.(true);
    try {
      const splits = opening ? [] : secondCategoryId === '' ? [{ ...(previous?.splits[0] === undefined ? {} : { id: previous.splits[0].id }), categoryId: categoryId as UUID, amount }] : [
        { ...(previous?.splits[0] === undefined ? {} : { id: previous.splits[0].id }), categoryId: categoryId as UUID, amount: firstAmount },
        { ...(previous?.splits[1] === undefined ? {} : { id: previous.splits[1].id }), categoryId: secondCategoryId as UUID, amount: secondAmount },
        ...extra.map((split) => ({ id: split.id as UUID, categoryId: split.categoryId as UUID, amount: split.amount }))
      ];
      await model.storeTransaction({ accountId: accountId as UUID, ...(payeeId === '' ? {} : { payeeId: payeeId as UUID }), amount, date, note, opening, splits }, previous);
      setAmount(''); setNote(''); setFirstAmount(''); setSecondAmount(''); setExtra([]); setSecondCategoryId(''); setOpening(false); saved(); onSaved?.();
    } catch (reason) { setError(errorText(reason)); }
    finally { submitting.current = false; setSaving(false); onBusy?.(false); }
  }
  return <><form ref={form} className="transaction-form" onSubmit={(event) => void submit(event)} aria-label={previous === undefined ? 'Buchung erfassen' : 'Buchung bearbeiten'}>
    <fieldset disabled={saving} className="transaction-fields">
      <label className="amount-field"><span>Betrag</span><input aria-label="Betrag" aria-describedby={`${prefix}-amount-help${amountError === undefined ? '' : ` ${prefix}-amount-error`}`} aria-invalid={amountError !== undefined} ref={amountField} inputMode="decimal" onInvalid={(event) => { event.preventDefault(); setAmountError('Bitte geben Sie einen gültigen Betrag ein.'); amountField.current?.focus(); }} onChange={(e) => { setAmount(e.target.value); setAmountError(undefined); }} placeholder="z. B. -12,50" required value={amount} /><small id={`${prefix}-amount-help`}>Ausgabe mit Minus, Einnahme mit Plus oder ohne Vorzeichen.</small>{amountError === undefined ? null : <span className="field-error" id={previous === undefined ? 'transaction-amount-error' : `${prefix}-amount-error`} role="alert">{amountError}</span>}</label>
      <label>Datum<input aria-label="Datum" aria-describedby={dateError === undefined ? undefined : previous === undefined ? 'transaction-date-error' : `${prefix}-date-error`} aria-invalid={dateError !== undefined} ref={dateField} onInvalid={(event) => { event.preventDefault(); setDateError('Bitte wählen Sie einen gültigen Kalendertag.'); dateField.current?.focus(); }} onChange={(e) => { setDate(e.target.value); setDateError(undefined); }} required type="date" value={date} />{dateError === undefined ? null : <span className="field-error" id={previous === undefined ? 'transaction-date-error' : `${prefix}-date-error`} role="alert">{dateError}</span>}</label>
      <label>Konto<select onChange={(e) => setAccountId(e.target.value)} required value={accountId}><option value="">Auswählen</option>{model.allAccounts.filter((entry) => !entry.archived || entry.id === previous?.accountId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label><input checked={opening} disabled={previous !== undefined} onChange={(e) => setOpening(e.target.checked)} type="checkbox" /> Anfangsbestand</label>
      {opening ? null : <><label>Kategorie<select onChange={(e) => setCategoryId(e.target.value)} required value={categoryId}><option value="">Auswählen</option>{options}</select></label>
        <label>Split-Kategorie (optional)<select onChange={(e) => { setSecondCategoryId(e.target.value); if (e.target.value === '') setExtra([]); }} value={secondCategoryId}><option value="">Kein Split</option>{options}</select></label>
        {secondCategoryId === '' ? null : <><label>Erster Splitbetrag<input inputMode="decimal" onChange={(e) => setFirstAmount(e.target.value)} required value={firstAmount} /></label><label>Zweiter Splitbetrag<input inputMode="decimal" onChange={(e) => setSecondAmount(e.target.value)} required value={secondAmount} /></label>
          {extra.map((split, index) => <div className="split-row" key={split.id}><label>Split-Kategorie {index + 3}<select required value={split.categoryId} onChange={(e) => setExtra((current) => current.map((entry) => entry.id === split.id ? { ...entry, categoryId: e.target.value } : entry))}><option value="">Auswählen</option>{options}</select></label><label>Splitbetrag {index + 3}<input inputMode="decimal" required value={split.amount} onChange={(e) => setExtra((current) => current.map((entry) => entry.id === split.id ? { ...entry, amount: e.target.value } : entry))} /></label><button type="button" onClick={() => setExtra((current) => current.filter((entry) => entry.id !== split.id))}>Split {index + 3} entfernen</button></div>)}
          <button type="button" onClick={() => setExtra((current) => [...current, { id: crypto.randomUUID(), categoryId: '', amount: '' }])}>Split hinzufügen</button></>}
      </>}
      <label>Empfänger<select onChange={(e) => setPayeeId(e.target.value)} value={payeeId}><option value="">Ohne Empfänger</option>{model.allPayees.filter((entry) => !entry.archived || entry.id === previous?.payeeId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label>Notiz<input onChange={(e) => setNote(e.target.value)} value={note} /></label><button type="submit">{saving ? 'Wird gespeichert …' : previous === undefined ? 'Lokal speichern' : 'Änderung speichern'}</button>
    </fieldset>
  </form>{saving ? <p role="status">Wird lokal gespeichert … Bitte warten.</p> : null}{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}</>;
}

export function TransactionList({ model }: { readonly model: FinanceModel }) {
  const guard = useDraftGuard();
  const [filter, setFilter] = useState(''); const [account, setAccount] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [scrollTop, setScrollTop] = useState(0); const [mobile, setMobile] = useState(() => matchMedia('(max-width: 767px)').matches);
  const scroller = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement | null>(null);
  const [selectedModel, setSelectedModel] = useState(model);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferAggregate>();
  const [selected, setSelected] = useState<TransactionAggregate>();
  const [action, setAction] = useState<'details' | 'edit' | 'delete' | 'unlock'>('details');
  const [editingBusy, setEditingBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const [error, setError] = useState<string>(); const [deleting, setDeleting] = useState(false); const deleteBusy = useRef(false);
  const accountNames = useMemo(() => new Map(model.allAccounts.map((entry) => [entry.id, entry.name])), [model]);
  const payeeNames = useMemo(() => new Map(model.allPayees.map((entry) => [entry.id, entry.name])), [model]);
  const categoryNames = useMemo(() => new Map(model.allCategories.map((entry) => [entry.id, entry.name])), [model]);
  const visible = useMemo(() => model.transactions.filter((transaction) =>
    `${transaction.note ?? ''} ${payeeNames.get(transaction.payeeId!) ?? ''}`.toLocaleLowerCase('de').includes(filter.toLocaleLowerCase('de')) &&
    (account === '' || transaction.accountId === account) && (from === '' || transaction.date >= from) && (to === '' || transaction.date <= to)
  ).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id)), [model, filter, account, from, to, payeeNames]);
  useEffect(() => { const query = matchMedia('(max-width: 767px)'); const update = () => setMobile(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  useEffect(() => {
    if (selected !== undefined) dialog.current?.showModal();
    else if (trigger.current !== null) {
      // Erst nach dem Render sind die Bedienelemente nach dem Commit wieder aktiv.
      if (trigger.current.isConnected) trigger.current.focus();
      else scroller.current?.focus();
    }
  }, [selected]);
  const height = mobile ? 176 : 80; const windowSize = 16;
  const start = Math.min(Math.max(0, Math.floor(scrollTop / height) - 4), Math.max(0, visible.length - windowSize));
  const end = Math.min(start + windowSize, visible.length);
  function resetScroll() { setScrollTop(0); if (scroller.current !== null) scroller.current.scrollTop = 0; }
  function close() { if (deleteBusy.current) return; setSelected(undefined); setError(undefined); }
  function requestClose() { guard.request(() => { dialog.current?.close(); close(); }, dialog.current?.querySelector('form') ?? undefined); }
  function open(transaction: TransactionAggregate, element: HTMLButtonElement) { trigger.current = element; setAction('details'); setError(undefined); setSelectedModel(model); setSelectedTransfer(model.transferFor(transaction)); setSelected(transaction); }
  async function remove() {
    if (selected === undefined || deleteBusy.current) return;
    deleteBusy.current = true; setDeleting(true); setError(undefined);
    try { if (action === 'unlock') await selectedModel.unlock(selected); else if (selected.kind === 'transfer') await selectedModel.removeTransfer(selectedTransfer!); else await model.removeTransaction(selected); deleteBusy.current = false; close(); }
    catch (reason) { setError(errorText(reason)); }
    finally { deleteBusy.current = false; setDeleting(false); }
  }
  return <section>
    <div className="transaction-filters"><label>Durchsuchen<input data-transaction-search onChange={(e) => { setFilter(e.target.value); resetScroll(); }} placeholder="Empfänger oder Notiz" value={filter} /></label><label>Kontofilter<select value={account} onChange={(e) => { setAccount(e.target.value); resetScroll(); }}><option value="">Alle Konten</option>{model.allAccounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Von Datum<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetScroll(); }} /></label><label>Bis Datum<input type="date" value={to} onChange={(e) => { setTo(e.target.value); resetScroll(); }} /></label><button type="button" onClick={() => { setFilter(''); setAccount(''); setFrom(''); setTo(''); resetScroll(); }}>Filter zurücksetzen</button></div>
    <p aria-live="polite">{visible.length} Buchungen</p>
    {visible.length === 0 ? <section className="empty"><h2>{model.transactions.length === 0 ? 'Noch keine Buchungen' : 'Keine passenden Buchungen'}</h2><p>{model.transactions.length === 0 ? 'Ihre Buchungen werden lokal gespeichert und bleiben offline verfügbar.' : 'Ändern Sie die Suche oder setzen Sie die Filter zurück.'}</p></section> :
      <div className="table-wrap transaction-scroll" role="region" aria-label="Buchungsliste" tabIndex={0} ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
        <table className="transaction-table" aria-rowcount={visible.length + 1}><thead><tr><th>Datum</th><th>Empfänger</th><th>Konto</th><th>Kategorie</th><th className="money">Betrag</th><th>Aktion</th></tr></thead><tbody>
          {start === 0 ? null : <tr aria-hidden="true" className="virtual-spacer"><td colSpan={6} style={{ height: start * height }} /></tr>}
          {visible.slice(start, end).map((transaction, index) => <tr key={transaction.id} data-transaction-id={transaction.id} aria-rowindex={start + index + 2} style={{ height }}>
            <td>{transaction.date}</td><td>{payeeNames.get(transaction.payeeId!) ?? transaction.note ?? '—'}</td><td>{accountNames.get(transaction.accountId)}</td><td>{transaction.splits.map((split) => categoryNames.get(split.categoryId) ?? 'Unbekannte Kategorie').join(', ') || '—'}</td><td className="money">{formatMoney(transaction.amount)}</td><td><button type="button" onClick={(e) => open(transaction, e.currentTarget)}>Details</button></td>
          </tr>)}
          {end === visible.length ? null : <tr aria-hidden="true" className="virtual-spacer"><td colSpan={6} style={{ height: (visible.length - end) * height }} /></tr>}
        </tbody></table>
      </div>}
    {selected === undefined ? null : <dialog className="confirmation-dialog transaction-dialog" aria-labelledby="transaction-details-title" ref={dialog} onCancel={(event) => { event.preventDefault(); if (!deleting && !editingBusy) requestClose(); }} onClose={close}>
      <h2 id="transaction-details-title">{action === 'edit' ? 'Buchung bearbeiten' : action === 'unlock' ? 'Abgleich entsperren?' : action === 'delete' ? 'Buchung löschen?' : 'Buchungsdetails'}</h2>
      {action === 'edit' && selected.kind === 'transfer' ? <TransferForm model={selectedModel} previous={selectedTransfer!} onBusy={setEditingBusy} onSaved={() => { dialog.current?.close(); close(); }} /> : action === 'edit' ? <TransactionForm key={selected.id} model={model} previous={selected} onBusy={setEditingBusy} onSaved={() => { dialog.current?.close(); close(); }} /> : <>
        <dl><dt>Betrag</dt><dd className="money">{formatMoney(selected.amount)}</dd><dt>Datum</dt><dd>{selected.date}</dd><dt>Konto</dt><dd>{accountNames.get(selected.accountId)}</dd><dt>Empfänger</dt><dd>{payeeNames.get(selected.payeeId!) ?? 'Ohne Empfänger'}</dd><dt>Notiz</dt><dd>{selected.note ?? 'Ohne Notiz'}</dd><dt>Status</dt><dd>{selected.clearance === 'reconciled' ? 'Abgeglichen – gesperrt' : selected.clearance === 'cleared' ? 'Bestätigt' : 'Nicht abgeglichen'}</dd>{selected.splits.map((split) => <div key={split.id}><dt>{categoryNames.get(split.categoryId)}</dt><dd>{formatMoney(split.amount)}</dd></div>)}</dl>
        {action === 'delete' ? <p>Erst die Bestätigung entfernt diese Buchung aus Liste und Saldo. Die Löschmarkierung bleibt dauerhaft erhalten.</p> : null}
        {action === 'unlock' ? <><p>Der gesamte zugehörige Abgleich wird aufgehoben. Bei Umbuchungen werden beide Seiten und alle verbundenen Abgleiche atomar entsperrt. Beträge und Kontostände bleiben erhalten.</p><button disabled={deleting} type="button" onClick={() => void remove()}>Entsperren bestätigen</button></> : selected.clearance === 'reconciled' || (selected.kind === 'transfer' && model.transactions.some((entry) => entry.transferId === selected.transferId && entry.clearance === 'reconciled')) ? <><p>Vor dem Ändern oder Löschen muss diese Buchung ausdrücklich entsperrt werden.</p><button type="button" onClick={() => setAction('unlock')}>Abgleich entsperren</button></> : action === 'details' ? <div className="dialog-actions"><button type="button" onClick={() => setAction('edit')}>Bearbeiten</button><button type="button" onClick={() => setAction('delete')}>Löschen</button></div> : <button disabled={deleting} type="button" onClick={() => void remove()}>{deleting ? 'Wird gelöscht …' : 'Löschen bestätigen'}</button>}

      </>}
      {error === undefined ? null : <p role="alert">{error}</p>}
      <div className="dialog-actions"><button disabled={deleting || editingBusy} type="button" onClick={requestClose}>{action === 'details' ? 'Schließen' : 'Abbrechen'}</button></div>
    </dialog>}
  </section>;
}
