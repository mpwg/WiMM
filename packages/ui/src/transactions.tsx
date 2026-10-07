// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { UUID } from '@wimm/contracts';
import { parseFinanceDate, parseMoney, type TransactionAggregate } from '@wimm/domain';
import { TransferForm } from './account-actions.js';
import { useDraftGuard, useFormDraft } from './drafts.js';
import { Button, EmptyState } from './components.js';
import { SlidersHorizontal, X } from 'lucide-react';
import { FinanceModel, formatMoney, displayDate } from './workspace.js';

// Nur Textformatierung; Betragsprüfung und Splitsummen bleiben im Fachkern.
function moneyText(cents: number): string {
  const value = BigInt(cents); const absolute = value < 0n ? -value : value;
  return `${value < 0n ? '-' : '+'}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')}`;
}
function errorText(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  if (/revision|stale/i.test(message)) return 'Die Buchung wurde inzwischen geändert. Bitte öffnen Sie den aktuellen Stand erneut; Ihre Eingaben bleiben erhalten.';
  if (/quota|disk|full|space/i.test(message)) return 'Der lokale Speicher ist voll. Ihre Eingaben bleiben erhalten. Schaffen Sie Platz und versuchen Sie es erneut.';
  return reason instanceof Error ? reason.message : 'Die Buchung wurde nicht gespeichert. Ihre Eingaben bleiben erhalten.';
}
interface SplitDraft { id: string; categoryId: string; amount: string }

export function Transactions({ model, onAccounts, initialSelection, onSelectionClosed }: { readonly model: FinanceModel; readonly onAccounts: () => void; readonly initialSelection?: UUID | undefined; readonly onSelectionClosed?: () => void }) {
  if (model.allAccounts.length === 0) return <EmptyState title="Noch kein Konto" action={<Button onClick={onAccounts}>Erstes Konto anlegen</Button>}>Legen Sie zuerst ein Konto an. Danach können Sie Ihre erste Zahlung erfassen.</EmptyState>;
  return <TransactionList model={model} initialSelection={initialSelection} onSelectionClosed={onSelectionClosed} />;
}

export function TransactionForm({ model, previous, onSaved, onBusy, defaultAccountId }: { readonly model: FinanceModel; readonly defaultAccountId?: UUID | undefined; readonly previous?: TransactionAggregate; readonly onSaved?: () => void; readonly onBusy?: (value: boolean) => void }) {
  const form = useRef<HTMLFormElement>(null); const saved = useFormDraft(form);
  const [accountId, setAccountId] = useState(previous?.accountId ?? defaultAccountId ?? '');
  const [categoryId, setCategoryId] = useState(previous?.splits[0]?.categoryId ?? '');
  const [secondCategoryId, setSecondCategoryId] = useState(previous?.splits[1]?.categoryId ?? '');
  const [firstAmount, setFirstAmount] = useState(previous?.splits[0] === undefined ? '' : moneyText(previous.splits[0].amount));
  const [secondAmount, setSecondAmount] = useState(previous?.splits[1] === undefined ? '' : moneyText(previous.splits[1].amount));
  const [extra, setExtra] = useState<SplitDraft[]>(previous?.splits.slice(2).map((split) => ({ id: split.id, categoryId: split.categoryId, amount: moneyText(split.amount) })) ?? []);
  const [payeeId, setPayeeId] = useState(previous?.payeeId ?? '');
  const [amount, setAmount] = useState(previous === undefined ? '' : moneyText(previous.amount).replace(/^[+-]/, ''));
  const [direction, setDirection] = useState<'expense' | 'income'>(previous === undefined || previous.amount < 0 ? 'expense' : 'income');
  const [date, setDate] = useState<string>(previous?.date ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(new Date()));
  const [note, setNote] = useState(previous?.note ?? ''); const opening = previous?.kind === 'opening';
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
      await model.storeTransaction({ accountId: accountId as UUID, ...(payeeId === '' ? {} : { payeeId: payeeId as UUID }), amount, direction, date, note, opening, splits }, previous);
      setAmount(''); setNote(''); setFirstAmount(''); setSecondAmount(''); setExtra([]); setSecondCategoryId(''); saved(); onSaved?.();
    } catch (reason) { setError(errorText(reason)); }
    finally { submitting.current = false; setSaving(false); onBusy?.(false); }
  }
  return <><form ref={form} className="transaction-form" onSubmit={(event) => void submit(event)} aria-label={previous === undefined ? 'Buchung erfassen' : 'Buchung bearbeiten'}>
    <fieldset disabled={saving} className="transaction-fields">
      <input type="hidden" name="direction" value={direction} />
      <div className="segment-control" role="group" aria-label="Buchungsrichtung"><button type="button" aria-pressed={direction === 'expense'} onClick={() => setDirection('expense')}>Ausgabe</button><button type="button" aria-pressed={direction === 'income'} onClick={() => setDirection('income')}>Einnahme</button></div>
      <label className="amount-field"><span>Betrag</span><input aria-label="Betrag" aria-describedby={`${prefix}-amount-help${amountError === undefined ? '' : ` ${prefix}-amount-error`}`} aria-invalid={amountError !== undefined} autoFocus ref={amountField} inputMode="decimal" onInvalid={(event) => { event.preventDefault(); setAmountError('Bitte geben Sie einen gültigen Betrag ein.'); amountField.current?.focus(); }} onChange={(e) => { setAmount(e.target.value); setAmountError(undefined); }} placeholder="0,00" required value={amount} /><small id={`${prefix}-amount-help`}>Betrag in EUR; die gewählte Richtung bestimmt das Vorzeichen.</small>{amountError === undefined ? null : <span className="field-error" id={previous === undefined ? 'transaction-amount-error' : `${prefix}-amount-error`} role="alert">{amountError}</span>}</label>
      <label>Datum<input aria-label="Datum" aria-describedby={dateError === undefined ? undefined : previous === undefined ? 'transaction-date-error' : `${prefix}-date-error`} aria-invalid={dateError !== undefined} ref={dateField} onInvalid={(event) => { event.preventDefault(); setDateError('Bitte wählen Sie einen gültigen Kalendertag.'); dateField.current?.focus(); }} onChange={(e) => { setDate(e.target.value); setDateError(undefined); }} required type="date" value={date} />{dateError === undefined ? null : <span className="field-error" id={previous === undefined ? 'transaction-date-error' : `${prefix}-date-error`} role="alert">{dateError}</span>}</label>
      <label>Konto<select onChange={(e) => setAccountId(e.target.value)} required value={accountId}><option value="">Auswählen</option>{model.allAccounts.filter((entry) => !entry.archived || entry.id === previous?.accountId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      {opening ? <p className="help-text">Anfangsbestand · zählt nicht zu Einnahmen oder Ausgaben.</p> : null}
      {opening ? null : <><label>Kategorie<select onChange={(e) => setCategoryId(e.target.value)} required value={categoryId}><option value="">Auswählen</option>{options}</select></label>
        <details open={previous !== undefined && previous.splits.length > 1 ? true : undefined}><summary>Aufteilen</summary><p className="help-text">Beträge ohne Vorzeichen folgen der Buchungsrichtung. Ein ausdrückliches Plus oder Minus erlaubt Gegenposten.</p><label>Split-Kategorie (optional)<select onChange={(e) => { setSecondCategoryId(e.target.value); if (e.target.value === '') setExtra([]); }} value={secondCategoryId}><option value="">Kein Split</option>{options}</select></label>
        {secondCategoryId === '' ? null : <><label>Erster Splitbetrag<input inputMode="decimal" onChange={(e) => setFirstAmount(e.target.value)} required value={firstAmount} /></label><label>Zweiter Splitbetrag<input inputMode="decimal" onChange={(e) => setSecondAmount(e.target.value)} required value={secondAmount} /></label>
          {extra.map((split, index) => <div className="split-row" key={split.id}><label>Split-Kategorie {index + 3}<select required value={split.categoryId} onChange={(e) => setExtra((current) => current.map((entry) => entry.id === split.id ? { ...entry, categoryId: e.target.value } : entry))}><option value="">Auswählen</option>{options}</select></label><label>Splitbetrag {index + 3}<input inputMode="decimal" required value={split.amount} onChange={(e) => setExtra((current) => current.map((entry) => entry.id === split.id ? { ...entry, amount: e.target.value } : entry))} /></label><button type="button" onClick={() => setExtra((current) => current.filter((entry) => entry.id !== split.id))}>Split {index + 3} entfernen</button></div>)}
          <button type="button" onClick={() => setExtra((current) => [...current, { id: crypto.randomUUID(), categoryId: '', amount: '' }])}>Split hinzufügen</button></>}</details>
      </>}
      <label>Empfänger<select onChange={(e) => setPayeeId(e.target.value)} value={payeeId}><option value="">Ohne Empfänger</option>{model.allPayees.filter((entry) => !entry.archived || entry.id === previous?.payeeId).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <details open={previous?.note ? true : undefined}><summary>Notiz</summary><label>Notiz<input onChange={(e) => setNote(e.target.value)} value={note} /></label></details><button type="submit">{saving ? 'Wird gespeichert …' : previous === undefined ? 'Lokal speichern' : 'Änderung speichern'}</button>
    </fieldset>
  </form>{saving ? <p role="status">Wird lokal gespeichert … Bitte warten.</p> : null}{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}</>;
}

function transactionSelection(model: FinanceModel, transaction?: TransactionAggregate) {
  try { return { model, transaction, transfer: transaction === undefined ? undefined : model.transferFor(transaction), error: undefined as string | undefined }; }
  catch (reason) { return { model, transaction, transfer: undefined, error: errorText(reason) }; }
}

export function TransactionList({ model, fixedAccountId, initialSelection, onSelectionClosed }: { readonly model: FinanceModel; readonly fixedAccountId?: UUID; readonly initialSelection?: UUID | undefined; readonly onSelectionClosed?: (() => void) | undefined }) {
  const guard = useDraftGuard();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState(''); const [account, setAccount] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [scrollTop, setScrollTop] = useState(0); const [mobile, setMobile] = useState(() => matchMedia('(max-width: 767px)').matches);
  const scroller = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement | null>(null);
  const [selection, setSelection] = useState(() => transactionSelection(model, model.transactions.find(transaction => transaction.id === initialSelection)));
  const { model: selectedModel, transfer: selectedTransfer, transaction: selected } = selection;
  const [action, setAction] = useState<'details' | 'edit' | 'delete' | 'unlock'>('details');
  const [editingBusy, setEditingBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null); const [error, setError] = useState<string | undefined>(selection.error); const [deleting, setDeleting] = useState(false); const deleteBusy = useRef(false);
  const accountNames = useMemo(() => new Map(model.allAccounts.map((entry) => [entry.id, entry.name])), [model]);
  const payeeNames = useMemo(() => new Map(model.allPayees.map((entry) => [entry.id, entry.name])), [model]);
  const categoryNames = useMemo(() => new Map(model.allCategories.map((entry) => [entry.id, entry.name])), [model]);
  const visible = useMemo(() => model.transactions.filter((transaction) =>
    `${transaction.note ?? ''} ${payeeNames.get(transaction.payeeId!) ?? ''}`.toLocaleLowerCase('de').includes(filter.toLocaleLowerCase('de')) &&
    (fixedAccountId === undefined || transaction.accountId === fixedAccountId) && (account === '' || transaction.accountId === account) && (from === '' || transaction.date >= from) && (to === '' || transaction.date <= to)
  ).sort((left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id)), [model, filter, account, from, to, payeeNames, fixedAccountId]);
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
  function close() { if (deleteBusy.current) return; setSelection(transactionSelection(model)); setError(undefined); onSelectionClosed?.(); }
  function requestClose() { if (editingBusy || deleting) return; guard.request(() => { dialog.current?.close(); close(); }, dialog.current?.querySelector('form') ?? undefined); }
  function open(transaction: TransactionAggregate, element: HTMLButtonElement) { trigger.current = element; setAction('details'); const next = transactionSelection(model, transaction); setSelection(next); setError(next.error); }
  async function remove() {
    if (selected === undefined || deleteBusy.current) return;
    deleteBusy.current = true; setDeleting(true); setError(undefined);
    try { if (action === 'unlock') await selectedModel.unlock(selected); else if (selected.kind === 'transfer') { if (selectedTransfer === undefined) throw new TypeError('Die vollständige vorhandene Umbuchung fehlt.'); await selectedModel.removeTransfer(selectedTransfer); } else await model.removeTransaction(selected); deleteBusy.current = false; close(); }
    catch (reason) { setError(errorText(reason)); }
    finally { deleteBusy.current = false; setDeleting(false); }
  }
  return <section>
    <div className="transaction-toolbar"><label>Durchsuchen<input data-transaction-search onChange={(e) => { setFilter(e.target.value); resetScroll(); }} placeholder="Empfänger oder Notiz suchen" value={filter} /></label><Button icon={SlidersHorizontal} aria-expanded={filtersOpen} aria-controls="booking-filters" onClick={() => setFiltersOpen(value => !value)}>Filter</Button></div>
    {filtersOpen ? <div id="booking-filters" className="transaction-filters">{fixedAccountId === undefined ? <label>Kontofilter<select value={account} onChange={(e) => { setAccount(e.target.value); resetScroll(); }}><option value="">Alle Konten</option>{model.allAccounts.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label> : null}<label>Von Datum<input type="date" value={from} onChange={e => { setFrom(e.target.value); resetScroll(); }} /></label><label>Bis Datum<input type="date" value={to} onChange={e => { setTo(e.target.value); resetScroll(); }} /></label></div> : null}
    <div className="filter-chips">{account === '' ? null : <Button icon={X} onClick={() => { setAccount(''); resetScroll(); }}>Konto: {accountNames.get(account)} entfernen</Button>}{from === '' ? null : <Button icon={X} onClick={() => { setFrom(''); resetScroll(); }}>Ab {displayDate(from)} entfernen</Button>}{to === '' ? null : <Button icon={X} onClick={() => { setTo(''); resetScroll(); }}>Bis {displayDate(to)} entfernen</Button>}{filter === '' && account === '' && from === '' && to === '' ? null : <Button variant="quiet" onClick={() => { setFilter(''); setAccount(''); setFrom(''); setTo(''); resetScroll(); }}>Filter zurücksetzen</Button>}</div>
    <p className="help-text" data-transaction-count aria-live="polite">{visible.length} {visible.length === 1 ? 'Buchung' : 'Buchungen'}</p>
    {visible.length === 0 ? <section className="empty"><h2>{model.transactions.length === 0 ? 'Noch keine Buchungen' : 'Keine passenden Buchungen'}</h2><p>{model.transactions.length === 0 ? 'Ihre Buchungen bleiben lokal und offline verfügbar. Starten Sie mit „Neue Buchung“.' : 'Ändern Sie die Suche oder setzen Sie die Filter zurück.'}</p></section> :
      <div className="table-wrap transaction-scroll" role="region" aria-label="Buchungsliste" tabIndex={0} ref={scroller} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        {mobile ? <ul className="mobile-transactions" aria-label="Buchungen">{start === 0 ? null : <li aria-hidden="true" style={{ height: start * height, border: 0, padding: 0 }} />}{visible.slice(start, end).map((transaction, index) => <li key={transaction.id} data-transaction-id={transaction.id} style={{ minHeight: height }}>
          {index > 0 && visible[start + index - 1]?.date === transaction.date ? null : <div className="mobile-date">{displayDate(transaction.date)}</div>}
          <button type="button" aria-label={`Details: ${payeeNames.get(transaction.payeeId!) ?? transaction.note ?? 'Buchung'}, ${formatMoney(transaction.amount)}`} onClick={e => open(transaction, e.currentTarget)}><span className="transaction-name">{payeeNames.get(transaction.payeeId!) ?? transaction.note ?? (transaction.kind === 'opening' ? 'Anfangsbestand' : 'Buchung')}</span><span className="money">{formatMoney(transaction.amount)}</span><small>{transaction.splits.map(split => categoryNames.get(split.categoryId)).join(', ') || (transaction.kind === 'opening' ? 'Anfangsbestand' : 'Umbuchung')} · {accountNames.get(transaction.accountId)}</small><small>{transaction.clearance === 'reconciled' ? 'Abgeglichen' : transaction.clearance === 'cleared' ? 'Bestätigt' : 'Offen'}</small></button>
        </li>)}{end === visible.length ? null : <li aria-hidden="true" style={{ height: (visible.length - end) * height, border: 0, padding: 0 }} />}</ul> :
        <table className="transaction-table desktop-transactions" aria-rowcount={visible.length + 1}><thead><tr><th>Datum</th><th>Empfänger</th><th>Konto</th><th>Kategorie</th><th className="money">Betrag</th><th>Status</th></tr></thead><tbody>
          {start === 0 ? null : <tr aria-hidden="true" className="virtual-spacer"><td colSpan={6} style={{ height: start * height }} /></tr>}
          {visible.slice(start, end).map((transaction, index) => <tr key={transaction.id} data-transaction-id={transaction.id} aria-rowindex={start + index + 2} style={{ height }} onClick={event => { if (!(event.target instanceof Element) || event.target.closest('button') === null) { const button = event.currentTarget.querySelector('button'); if (button) open(transaction, button); } }}>
            <td>{displayDate(transaction.date)}</td><td><button className="transaction-link" type="button" title={payeeNames.get(transaction.payeeId!) ?? transaction.note ?? 'Buchung'} aria-label={`Details: ${payeeNames.get(transaction.payeeId!) ?? transaction.note ?? 'Buchung'}`} onClick={e => open(transaction, e.currentTarget)}>{payeeNames.get(transaction.payeeId!) ?? transaction.note ?? (transaction.kind === 'opening' ? 'Anfangsbestand' : 'Buchung')}</button></td><td title={accountNames.get(transaction.accountId)}>{accountNames.get(transaction.accountId)}</td><td title={transaction.splits.map(split => categoryNames.get(split.categoryId)).join(', ')}>{transaction.splits.map(split => categoryNames.get(split.categoryId) ?? 'Unbekannte Kategorie').join(', ') || '—'}</td><td className="money">{formatMoney(transaction.amount)}</td><td>{transaction.clearance === 'reconciled' ? 'Abgeglichen' : transaction.clearance === 'cleared' ? 'Bestätigt' : 'Offen'}</td>
          </tr>)}
          {end === visible.length ? null : <tr aria-hidden="true" className="virtual-spacer"><td colSpan={6} style={{ height: (visible.length - end) * height }} /></tr>}
        </tbody></table>}
      </div>}
    {selected === undefined ? null : <dialog className="confirmation-dialog transaction-dialog" aria-labelledby="transaction-details-title" ref={dialog} onCancel={(event) => { event.preventDefault(); if (!deleting && !editingBusy) requestClose(); }} onClose={close}>
      <h2 id="transaction-details-title">{action === 'edit' ? 'Buchung bearbeiten' : action === 'unlock' ? 'Abgleich entsperren?' : action === 'delete' ? 'Buchung löschen?' : 'Buchungsdetails'}</h2>
      {action === 'edit' && selected.kind === 'transfer' ? <TransferForm model={selectedModel} previous={selectedTransfer!} onBusy={setEditingBusy} onSaved={() => { dialog.current?.close(); close(); }} /> : action === 'edit' ? <TransactionForm key={selected.id} model={model} previous={selected} onBusy={setEditingBusy} onSaved={() => { dialog.current?.close(); close(); }} /> : <>
        <dl><dt>Betrag</dt><dd className="money">{formatMoney(selected.amount)}</dd><dt>Datum</dt><dd>{displayDate(selected.date)}</dd><dt>Konto</dt><dd>{accountNames.get(selected.accountId)}</dd><dt>Empfänger</dt><dd>{payeeNames.get(selected.payeeId!) ?? 'Ohne Empfänger'}</dd><dt>Notiz</dt><dd>{selected.note ?? 'Ohne Notiz'}</dd><dt>Status</dt><dd>{selected.clearance === 'reconciled' ? 'Abgeglichen – gesperrt' : selected.clearance === 'cleared' ? 'Bestätigt' : 'Nicht abgeglichen'}</dd>{selected.splits.map((split) => <div key={split.id}><dt>{categoryNames.get(split.categoryId)}</dt><dd>{formatMoney(split.amount)}</dd></div>)}</dl>
        {action === 'delete' ? <p>Erst die Bestätigung entfernt diese Buchung aus Liste und Saldo. Die Löschmarkierung bleibt dauerhaft erhalten.</p> : null}
        {action === 'unlock' ? <><p>Der gesamte zugehörige Abgleich wird aufgehoben. Bei Umbuchungen werden beide Seiten und alle verbundenen Abgleiche atomar entsperrt. Beträge und Kontostände bleiben erhalten.</p><button disabled={deleting} type="button" onClick={() => void remove()}>Entsperren bestätigen</button></> : selected.clearance === 'reconciled' || (selected.kind === 'transfer' && model.transactions.some((entry) => entry.transferId === selected.transferId && entry.clearance === 'reconciled')) ? <><p>Vor dem Ändern oder Löschen muss diese Buchung ausdrücklich entsperrt werden.</p><button type="button" onClick={() => setAction('unlock')}>Abgleich entsperren</button></> : action === 'details' ? <div className="dialog-actions"><button type="button" onClick={() => { if (selected.kind === 'transfer' && selectedTransfer === undefined) setError(selection.error ?? 'Die vollständige vorhandene Umbuchung fehlt.'); else setAction('edit'); }}>Bearbeiten</button><button className="danger" type="button" onClick={() => setAction('delete')}>Löschen</button></div> : <button className="danger" disabled={deleting} type="button" onClick={() => void remove()}>{deleting ? 'Wird gelöscht …' : 'Löschen bestätigen'}</button>}

      </>}
      {error === undefined ? null : <p role="alert">{error}</p>}
      <div className="dialog-actions"><button disabled={deleting || editingBusy} type="button" onClick={requestClose}>{action === 'details' ? 'Schließen' : 'Abbrechen'}</button></div>
    </dialog>}
  </section>;
}
