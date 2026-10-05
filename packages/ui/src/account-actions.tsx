// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Money, UUID } from '@wimm/contracts';
import type { TransferAggregate } from '@wimm/domain';
import { FinanceModel, formatMoney } from './workspace.js';
import { useFormDraft } from './drafts.js';

export function today(): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna' }).format(new Date()); }
function moneyText(value: number) { const money = BigInt(value); const absolute = money < 0 ? -money : money; return `${money < 0 ? '-' : ''}${absolute / 100n},${String(absolute % 100n).padStart(2, '0')}`; }
function message(reason: unknown) { return reason instanceof Error ? /revision|stale/i.test(reason.message) ? 'Der Stand wurde inzwischen geändert. Ihre Eingaben bleiben erhalten; bitte öffnen Sie den aktuellen Vorgang erneut.' : reason.message : 'Die Eingaben wurden nicht gespeichert.'; }

export function TransferForm({ model, previous, onSaved, onBusy }: { readonly model: FinanceModel; readonly previous?: TransferAggregate; readonly onSaved?: () => void; readonly onBusy?: (busy: boolean) => void }) {
  const [source, setSource] = useState<string>(previous?.sourceAccountId ?? ''); const [target, setTarget] = useState<string>(previous?.targetAccountId ?? '');
  const [amount, setAmount] = useState(previous === undefined ? '' : moneyText(previous.amount)); const [date, setDate] = useState<string>(previous?.date ?? today());
  const [category, setCategory] = useState<string>(previous?.budgetCategoryId ?? ''); const [release, setRelease] = useState(previous?.budgetRelease === true);
  const [error, setError] = useState<string>(); const [saving, setSaving] = useState(false); const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null); const saved = useFormDraft(form);
  const sourceAccount = model.allAccounts.find((account) => account.id === source); const targetAccount = model.allAccounts.find((account) => account.id === target);
  const leaves = sourceAccount?.onBudget === true && targetAccount?.onBudget === false;
  const enters = sourceAccount?.onBudget === false && targetAccount?.onBudget === true;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setSaving(true); onBusy?.(true); setError(undefined);
    try {
      await model.addTransfer(source as UUID, target as UUID, amount, date, leaves && category !== '' ? category as UUID : undefined, enters && release, previous);
      setAmount(''); setCategory(''); setRelease(false); saved(); onSaved?.();
    } catch (reason) { setError(message(reason)); } finally { busy.current = false; setSaving(false); onBusy?.(false); }
  }
  return <section className="transfer"><h2>{previous === undefined ? 'Umbuchung' : 'Umbuchung bearbeiten'}</h2><p>Quell- und Zielseite werden gemeinsam gespeichert oder gar nicht.</p>
    <form aria-label="Umbuchung" className="inline-form" ref={form} onSubmit={(event) => void submit(event)}><fieldset disabled={saving} className="transaction-fields">
      <label>Von<select aria-label="Von" required value={source} onChange={(event) => { setSource(event.target.value); setCategory(''); setRelease(false); }}><option value="">Auswählen</option>{model.allAccounts.filter((account) => !account.archived || account.id === previous?.sourceAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>Nach<select aria-label="Nach" required value={target} onChange={(event) => { setTarget(event.target.value); setCategory(''); setRelease(false); }}><option value="">Auswählen</option>{model.allAccounts.filter((account) => !account.archived || account.id === previous?.targetAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>Umbuchungsbetrag<input inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Umbuchungsdatum<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
      {leaves ? <label>Budgetkategorie<select aria-label="Budgetkategorie" required value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Auswählen</option>{model.categories.filter((entry) => model.groups.find((group) => group.id === entry.groupId)?.kind === 'expense').map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select><small>Der Betrag verlässt das Budget und verbraucht diese Ausgabenkategorie; er zählt nicht als Konsum.</small></label> : null}
      {enters ? <label><input type="checkbox" required checked={release} onChange={(event) => setRelease(event.target.checked)} /> Vorhandenes Geld für das Budget freigeben</label> : null}
      <button type="submit">{saving ? 'Wird gespeichert …' : previous === undefined ? 'Umbuchung speichern' : 'Umbuchung ändern'}</button>
    </fieldset></form>{error === undefined ? null : <p role="alert" className="field-error">{error}</p>}
  </section>;
}
export function ReconciliationForm({ model }: { readonly model: FinanceModel }) {
  const [account, setAccount] = useState(''); const [balance, setBalance] = useState(''); const [date, setDate] = useState(today()); const [ids, setIds] = useState<UUID[]>([]);
  const [result, setResult] = useState<string>(); const [saving, setSaving] = useState(false); const busy = useRef(false);
  const [correction, setCorrection] = useState<{ amount: Money; account: UUID; date: string }>(); const [category, setCategory] = useState(''); const [correctionDate, setCorrectionDate] = useState('');
  const form = useRef<HTMLFormElement>(null); const saved = useFormDraft(form); const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (correction !== undefined) dialog.current?.showModal(); }, [correction]);
  const candidates = model.transactions.filter((transaction) => transaction.accountId === account && transaction.clearance !== 'reconciled' && transaction.date <= date);
  let difference: Money | undefined; let invalid: string | undefined;
  if (account !== '' && balance !== '') try { difference = model.difference(account as UUID, balance, date, ids); } catch (reason) { invalid = message(reason); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setSaving(true); setResult(undefined);
    try { await model.reconcile(account as UUID, balance, date, ids); setIds([]); setBalance(''); saved(); setResult('Abgleich gespeichert. Die ausgewählten Buchungen sind gesperrt.'); }
    catch (reason) { setResult(message(reason)); } finally { busy.current = false; setSaving(false); }
  }
  function closeCorrection() { if (busy.current) return; dialog.current?.close(); setCorrection(undefined); requestAnimationFrame(() => trigger.current?.focus()); }
  async function correct(event: FormEvent) {
    event.preventDefault(); if (correction === undefined || busy.current) return; busy.current = true; setSaving(true);
    try {
      await model.storeTransaction({ accountId: correction.account, date: correctionDate, amount: moneyText(correction.amount), note: 'Korrektur zum Kontoauszug', opening: false, splits: [{ categoryId: category as UUID, amount: moneyText(correction.amount) }] });
      dialog.current?.close(); setCorrection(undefined); setResult('Korrekturbuchung gespeichert. Wählen Sie diese Buchung zusätzlich aus und prüfen Sie den Abgleich erneut.'); trigger.current?.focus();
    } catch (reason) { setResult(message(reason)); } finally { busy.current = false; setSaving(false); }
  }
  return <section className="transfer"><h2>Abgleich</h2><p>Wählen Sie die Bewegungen des Kontoauszugs. Bereits abgeglichene Buchungen bilden den Ausgangssaldo.</p>
    <form aria-label="Abgleich" className="inline-form" ref={form} onSubmit={(event) => void submit(event)}><fieldset className="transaction-fields" disabled={saving}>
      <label>Abgleichkonto<select required value={account} onChange={(event) => { setAccount(event.target.value); setIds([]); }}><option value="">Auswählen</option>{model.accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
      <label>Auszugssaldo<input required inputMode="decimal" value={balance} onChange={(event) => setBalance(event.target.value)} /></label><label>Auszugsdatum<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); setIds([]); }} /></label>
      <fieldset><legend>Buchungen auswählen</legend>{candidates.length === 0 ? <p>Keine offenen Bewegungen für dieses Konto und Datum.</p> : candidates.map((transaction) => <label key={transaction.id}><input type="checkbox" checked={ids.includes(transaction.id)} onChange={(event) => setIds((selected) => event.target.checked ? [...selected, transaction.id] : selected.filter((id) => id !== transaction.id))} /> {transaction.date} · {transaction.note ?? (transaction.kind === 'transfer' ? 'Umbuchung' : 'Anfangsbestand')} · {formatMoney(transaction.amount)}</label>)}</fieldset>
      <p aria-live="polite">{difference === undefined ? invalid ?? 'Geben Sie den Auszugssaldo ein.' : `Differenz: ${formatMoney(difference)}`}</p>
      <button type="submit" disabled={difference !== 0 || ids.length === 0}>Abgleich bestätigen</button>
      {difference === undefined || difference === 0 ? null : <button type="button" ref={trigger} onClick={() => { setCategory(''); setCorrectionDate(date); setCorrection({ amount: difference!, account: account as UUID, date }); }}>Korrektur vorschlagen</button>}
    </fieldset></form>{result === undefined ? null : <p role="status">{result}</p>}
    {correction === undefined ? null : <dialog className="confirmation-dialog" aria-labelledby="correction-title" ref={dialog} onCancel={(event) => { event.preventDefault(); closeCorrection(); }}>
      <h2 id="correction-title">Korrekturbuchung bestätigen?</h2><p>Eine eigene Buchung über {formatMoney(correction.amount)} auf {model.accounts.find((entry) => entry.id === correction.account)?.name} verändert den Kontostand. Sie wird erst mit Ihrer Bestätigung angelegt und noch nicht abgeglichen.</p>
      <form onSubmit={(event) => void correct(event)}><fieldset disabled={saving}><label>Korrekturdatum<input required type="date" max={correction.date} value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} /></label><label>Korrekturkategorie<select required value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Auswählen</option>{model.categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><div className="dialog-actions"><button type="button" onClick={closeCorrection}>Abbrechen</button><button type="submit">Korrekturbuchung anlegen</button></div></fieldset></form>
    </dialog>}
  </section>;
}
