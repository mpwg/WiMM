// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';

import type { UUID } from '@wimm/contracts';
import { type AccountAggregate } from '@wimm/domain';
import { FinanceModel, AutomationModel } from '@wimm/application';

import type { UnlockedAppContext } from './app.js';
import { DraftProtection, useDraftGuard, useFormDraft } from './drafts.js';
import { isTextEditing } from './platform.js';
import { TransferForm, ReconciliationForm } from './account-actions.js';
import { ImportView, AutomationView } from './automation-views.js';
import { Transactions, TransactionForm, TransactionList } from './transactions.js';
import { Button, Dialog, EmptyState } from './components.js';
import {StoragePersistenceNotice} from './storage-persistence-notice.js';
import { Receipt, LayoutDashboard, ArrowLeftRight, Landmark, Settings, LockKeyhole, CircleHelp, Ellipsis, ChevronRight, Plus, Upload, Undo2, Redo2, Check, Tags, Users, ListFilter, CalendarClock, Palette } from 'lucide-react';
import { today } from './account-actions.js';

type ColorScheme = 'system' | 'light' | 'dark';

function storedColorScheme(): ColorScheme {
  try {
    const value = localStorage.getItem('wimm:color-scheme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

export type { TransactionInput } from '@wimm/application';

type View = 'overview' | 'accounts' | 'categories' | 'payees' | 'transactions' | 'import' | 'automation' | 'schedules' | 'settings' | 'more' | 'help';

/**
 * Der Composition Root wählt den dauerhaften Speicher. Die Fachansicht kennt
 * weder IndexedDB noch Tauri und hält lediglich ihren Navigationszustand selbst.
 */
export type { WorkspaceStorage, WorkspaceStorageFactory } from '@wimm/application';

export function FinanceWorkspace(props: { readonly context: UnlockedAppContext;  readonly desktop?: boolean }) {
  const [view, setView] = useState<View>('overview');
  return <DraftProtection><WorkspaceContent view={view} setView={setView} key={`${props.context.profile.profileId}:${props.context.activeArea.id}`} {...props} /></DraftProtection>;
}
function WorkspaceContent({ context, desktop = false, view, setView }: { readonly context: UnlockedAppContext;  readonly desktop?: boolean; readonly view: View; readonly setView: (view: View) => void }) {
  const guard = useDraftGuard();
  const { isProfileChanging } = context;
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 767px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 767px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const shell = useRef<HTMLDivElement>(null);
  const mobileNavigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const navigation = mobileNavigation.current;
    const container = shell.current;
    if (navigation === null || container === null) return;
    // Schriftmetriken, Umbrüche und sichere Flächen können die Leiste vergrößern.
    const update = () => container.style.setProperty('--mobile-navigation-height', `${navigation.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update);
    observer.observe(navigation);
    update();
    return () => observer.disconnect();
  }, []);
  const [newBooking, setNewBooking] = useState<{ accountId?: UUID }>();
  const [selectedAccount, setSelectedAccount] = useState<UUID>();
  const [selectedTransaction, setSelectedTransaction] = useState<UUID>();
  const [focusRequest, setFocusRequest] = useState<{ target: 'amount' | 'search'; version: number }>();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(storedColorScheme);
  const changeColorScheme = (value: ColorScheme) => {
    setColorScheme(value);
    try { localStorage.setItem('wimm:color-scheme', value); } catch { /* Die Auswahl bleibt für diese Sitzung nutzbar. */ }
  };
  const application = useMemo(() => context.runtime.financeForScope(context.profile.profileId as UUID, context.activeArea.id as UUID), [context.runtime, context.profile.profileId, context.activeArea.id]);
  const snapshot = useSyncExternalStore(application.subscribe, application.getSnapshot);
  const state = snapshot.status;
  const saving = snapshot.saving || context.profileChanging;
  const [localMessage, setMessage] = useState<string>();
  const message = localMessage ?? snapshot.message;
  const history = application.history;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (closeTimer.current !== undefined) clearTimeout(closeTimer.current);
    void application.load();
    return () => { closeTimer.current = setTimeout(() => { application.dispose(); }, 0); };
  }, [application]);
  const model = application.model;
  const automation = useMemo(() => new AutomationModel(model, context.runtime.importPreparation, context.runtime.importPreview), [model, context.runtime.importPreparation, context.runtime.importPreview]);
  async function moveHistory(direction: 'undo' | 'redo') {
    try { setMessage(undefined); await application.moveHistory(direction); }
    catch (error) { setMessage(messageFor(error, 'Die Aktion wurde nicht ausgeführt.')); }
  }
  useEffect(() => {
    if (focusRequest !== undefined && state === 'ready' && view === 'transactions') {
      document.querySelector<HTMLInputElement>(focusRequest.target === 'amount' ? '[aria-label="Buchung erfassen"] input[aria-label="Betrag"]' : '[data-transaction-search]')?.focus();
    }
  }, [focusRequest, state, view]);
  useEffect(() => {
    function command(id: string, native = false) {
      if (isProfileChanging()) return;
      const editing = isTextEditing(document.activeElement);
      if ((id === 'undo' || id === 'redo') && editing) {
        if (native) document.execCommand(id);
        return;
      }
      if (snapshot.saving || state !== 'ready' || document.querySelector('dialog[open]') !== null) return;
      if (id === 'undo' || id === 'redo') { guard.request(() => { void moveHistory(id); }); return; }
      if (id === 'new-transaction' || id === 'search') {
        const action = () => { if (id === 'new-transaction') setNewBooking({}); else setView('transactions'); setFocusRequest((value) => ({ target: id === 'search' ? 'search' : 'amount', version: (value?.version ?? 0) + 1 })); };
        if (id === 'search' && view === 'transactions') action(); else guard.request(action);
      }
      if (id === 'import') guard.request(() => setView('import'));
      if (id === 'overview') guard.request(() => setView('overview'));
      if (id === 'settings') guard.request(() => setView('settings'));
    }
    function keydown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const id = key === 'i' ? 'import' : key === 'n' ? 'new-transaction' : key === 'f' ? 'search' : key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' && event.ctrlKey ? 'redo' : undefined;
      if (id === undefined || ((id === 'undo' || id === 'redo') && isTextEditing(document.activeElement))) return;
      event.preventDefault(); command(id);
    }
    document.addEventListener('keydown', keydown);
    let disposed = false; let unlisten: (() => void) | undefined;
    void context.platform.onMenuCommand((id) => command(id, true)).then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch(() => setMessage('Die Systemmenüs konnten nicht verbunden werden.'));
    void context.platform.setMenuCommands(['new-transaction', 'search', 'overview', 'settings', 'import'].map((id) => ({ id, title: id, enabled: state === 'ready' && !saving }))).catch(() => setMessage('Die Systemmenüs konnten nicht aktualisiert werden.'));
    return () => { disposed = true; unlisten?.(); document.removeEventListener('keydown', keydown); };
  });
  useEffect(() => () => {
    void context.platform.setMenuCommands(['new-transaction', 'search', 'overview', 'settings', 'import'].map((id) => ({ id, title: id, enabled: false })));
  }, [context.platform]);
  function navigate(next: View) {
    setView(next);
    if (matchMedia('(max-width: 767px)').matches) requestAnimationFrame(() => document.querySelector<HTMLElement>('.finance-main')?.scrollIntoView({ block: 'start' }));
  }
  useEffect(() => {
    if (state === 'ready' && matchMedia('(max-width: 767px)').matches) document.querySelector<HTMLElement>('.finance-main')?.scrollIntoView({ block: 'start' });
  }, [view, state]);
  const openNew = () => { if (!isProfileChanging()) guard.request(() => setNewBooking({})); };
  const go = (next: View) => { if (!isProfileChanging()) guard.request(() => navigate(next)); };
  const settingsView = ['settings', 'categories', 'payees', 'automation', 'schedules'].includes(view);
  const navItems = [['overview', 'Übersicht', LayoutDashboard], ['transactions', 'Buchungen', ArrowLeftRight], ['accounts', 'Konten', Landmark]] as const;
  const links = (items: typeof navItems) => items.map(([id, label, Icon]) => <Button variant="quiet" icon={Icon} disabled={saving} aria-current={view === id ? 'page' : undefined} key={id} onClick={() => go(id)}>{label}</Button>);
  return <div ref={shell} data-history-version={snapshot.historyVersion} className={`app-shell${desktop ? ' desktop-shell' : ''}`} data-color-scheme={colorScheme}>
    <aside className="sidebar"><p className="product" aria-label="WhereIsMyMoney">Wi<span>MM.</span></p>
      {mobile ? null : <div className="area-actions"><AreaPicker context={context} disabled={saving} request={(action, trigger) => guard.request(action, undefined, trigger)} />
        <Button variant="quiet" icon={Plus} disabled={saving} onClick={() => guard.request(() => { void context.createHousehold(); })}>Haushalt anlegen</Button>
      </div>}
      <nav aria-label="Hauptnavigation">{links(navItems)}</nav>
      <div className="sidebar-footer"><Button variant="quiet" icon={Settings} disabled={saving} aria-current={settingsView ? 'page' : undefined} onClick={() => go('settings')}>Einstellungen</Button>
        <Button variant="quiet" icon={CircleHelp} disabled={saving} onClick={() => go('help')}>Hilfe</Button>
        <Button variant="quiet" icon={LockKeyhole} disabled={snapshot.saving} onClick={() => guard.request(() => { void context.lock(); })}>Tresor sperren</Button><span className="local-status">Lokal auf diesem Gerät</span>
      </div>
    </aside>
    <nav ref={mobileNavigation} className="mobile-navigation" aria-label="Mobile Hauptnavigation">
      {([['overview', 'Übersicht', LayoutDashboard], ['transactions', 'Buchungen', ArrowLeftRight], ['more', 'Mehr', Ellipsis]] as const).map(([id, label, Icon]) =>
        <Button variant="quiet" icon={Icon} disabled={saving} aria-current={view === id || (id === 'more' && !['overview', 'transactions'].includes(view)) ? 'page' : undefined} key={id} onClick={() => go(id)}>{label}</Button>)}
    </nav>
    <div className="workspace-pane">
      <div className="area-header">
        <p className="desktop-only"><span>{context.activeArea.kind === 'private' ? 'Privatbereich' : 'Gemeinsamer Bereich'}</span> · {context.activeArea.label}</p>
        {mobile ? <div className="mobile-only area-actions"><AreaPicker context={context} disabled={saving} request={(action, trigger) => guard.request(action, undefined, trigger)} /><Button variant="quiet" icon={Plus} disabled={saving} onClick={() => guard.request(() => { void context.createHousehold(); })}>Haushalt anlegen</Button></div> : null}
        <span className="local-status"><Check size={14} aria-hidden="true" />Lokal auf diesem Gerät</span>
      </div>
    <main className="finance-main" key={context.activeArea.id}>
      <header><div><p className="eyebrow">{view === 'overview' ? 'Ihr Überblick' : titleFor(view)}</p><h1 tabIndex={-1}>{view === 'overview' ? 'Alles im Blick.' : titleFor(view)}</h1></div>
        <div className="header-actions">{state === 'ready' && (view === 'overview' || view === 'transactions') ? <>
          {view === 'transactions' ? <Button icon={Upload} disabled={saving} onClick={() => go('import')}>Importieren</Button> : null}
          {model.accounts.length > 0 ? <Button variant="primary" icon={Plus} disabled={saving} onClick={openNew}>Neue Buchung</Button> : null}
        </> : null}</div>
      </header>
      <div className="workspace-status"><span role="status" className="local-status"><Check size={14} aria-hidden="true" />{context.profileChanging ? 'Bereich wird vorbereitet …' : saving ? 'Wird lokal gespeichert …' : message === 'Lokal gespeichert.' ? message : 'Lokal gespeichert'}</span>
        <div className="toolbar history-actions"><Button variant="quiet" icon={Undo2} disabled={saving || !history.canUndo} onClick={() => void moveHistory('undo')}>Rückgängig</Button><Button variant="quiet" icon={Redo2} disabled={saving || !history.canRedo} onClick={() => void moveHistory('redo')}>Wiederholen</Button></div>
      </div>
      {message === undefined || message === 'Lokal gespeichert.' ? null : <p role="alert" className="notice error">{message}</p>}
      {context.runtime.persistence===undefined||view==='settings'?null:<StoragePersistenceNotice context={context}/>}
      {state === 'loading' ? <p role="status">Lokale Daten werden geladen …</p> : null}
      {state === 'error' ? <p role="alert">Die Daten bleiben unverändert. Bitte entsperren Sie den Tresor erneut oder starten Sie die App neu.</p> : null}
      <fieldset className="workspace-content" disabled={saving}>
        {state === 'ready' && view === 'overview' ? <Overview model={model} automation={automation} onAccounts={() => go('accounts')} onTransactions={(id) => { setSelectedTransaction(id); go('transactions'); }} onSchedules={() => go('schedules')} onAccount={(id) => { setSelectedAccount(id); go('accounts'); }} /> : null}
        {state === 'ready' && view === 'accounts' ? <Accounts model={model} saving={saving} selectedId={selectedAccount} onSelect={setSelectedAccount} onNew={(accountId) => setNewBooking({ accountId })} /> : null}
        {state === 'ready' && view === 'categories' ? <Categories model={model} /> : null}
        {state === 'ready' && view === 'payees' ? <Payees model={model} /> : null}
        {state === 'ready' && view === 'transactions' ? <Transactions model={model} initialSelection={selectedTransaction} onSelectionClosed={() => setSelectedTransaction(undefined)} onAccounts={() => go('accounts')} /> : null}
        {state === 'ready' && view === 'import' ? <ImportView model={automation} platform={context.platform} /> : null}
        {state === 'ready' && (view === 'automation' || view === 'schedules') ? <AutomationView key={view} model={automation} section={view === 'schedules' ? 'schedules' : 'rules'} /> : null}
        {state === 'ready' && (settingsView || view === 'more') ? <>
          {view === 'settings' || view === 'more' ? <div className="settings-list">
            {view === 'more' ? <Button icon={Landmark} onClick={() => go('accounts')}>Konten<ChevronRight size={18} aria-hidden="true" /></Button> : null}
            {(view === 'more' ? [['settings', 'Einstellungen', 'Kategorien, Empfänger und Automatisierung', Settings]] as const : [
              ['categories', 'Kategorien', 'Ausgaben und Einnahmen ordnen', Tags], ['payees', 'Empfänger', 'Empfänger verwalten und zusammenführen', Users], ['automation', 'Regeln', 'Importierte Buchungen automatisch zuordnen', ListFilter], ['schedules', 'Dauerzahlungen', 'Wiederkehrende Zahlungen und fällige Vorschläge', CalendarClock]
            ] as const).map(([id, label, description, Icon]) => <button type="button" key={id} onClick={() => go(id)}><span><Icon size={20} aria-hidden="true" /><span>{label}<small>{description}</small></span></span><ChevronRight size={18} aria-hidden="true" /></button>)}
            {view === 'more' ? <><Button icon={CircleHelp} disabled={saving} onClick={() => go('help')}>Hilfe<ChevronRight size={18} aria-hidden="true" /></Button><Button icon={LockKeyhole} onClick={() => guard.request(() => { void context.lock(); })}>Tresor sperren</Button></> : null}
          </div> : <Button variant="quiet" icon={Settings} onClick={() => go('settings')}>Alle Einstellungen</Button>}
          {view === 'settings' ? <section className="appearance"><h2><Palette size={18} aria-hidden="true" /> Erscheinungsbild</h2><label>Farbschema<select value={colorScheme} onChange={(event) => changeColorScheme(event.target.value as ColorScheme)}><option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></section> : null}
          {view==='settings'&&context.runtime.persistence!==undefined?<StoragePersistenceNotice context={context} details/>:null}
        </> : null}
        {view === 'help' ? <section><h2>WhereIsMyMoney</h2><p className="help-text">Version 0.0.0 · Lokal und verschlüsselt</p>{[['Hilfe und Quellcode', 'https://github.com/mpwg/WiMM'], ['Lizenz AGPL-3.0-or-later', 'https://www.gnu.org/licenses/agpl-3.0.html']].map(([label, url]) => <p key={url}><a href={url} onClick={(event) => { event.preventDefault(); void context.platform.openExternalUrl(url!).catch(() => setMessage('Der Link konnte nicht geöffnet werden.')); }}>{label}</a></p>)}</section> : null}
      </fieldset>
    </main>
    </div>
    {newBooking === undefined ? null : <Dialog title="Neue Buchung" busy={saving} onClose={() => setNewBooking(undefined)}><TransactionForm model={model} defaultAccountId={newBooking.accountId} onSaved={() => setNewBooking(undefined)} /></Dialog>}
  </div>;
}

export { FinanceModel } from './application-runtime.js';


function AreaPicker({ context, disabled = false, request }: { readonly context: UnlockedAppContext; readonly disabled?: boolean; readonly request: (action: () => void, trigger: HTMLElement) => void }) { return <label className="area-picker">Bereich<select aria-label="Bereich" disabled={disabled} onChange={(event) => { const id = event.target.value; request(() => context.selectArea(id), event.currentTarget); }} value={context.activeArea.id}>{context.profile.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>; }
function Overview({ model, automation, onAccounts, onTransactions, onSchedules, onAccount }: { readonly model: FinanceModel; readonly automation: AutomationModel; readonly onAccounts: () => void; readonly onTransactions: (id?: UUID) => void; readonly onSchedules: () => void; readonly onAccount: (id: UUID) => void }) {
  if (model.allAccounts.length === 0) return <section><ol className="stepper" aria-label="Lokaler Einstieg"><li>1. Tresor anlegen</li><li>2. Rettungscode sichern</li><li aria-current="step">3. Erstes Konto</li></ol><EmptyState title="Ihr erster Überblick" action={<Button variant="primary" icon={Plus} onClick={onAccounts}>Erstes Konto anlegen</Button>}>Legen Sie Ihr erstes Konto an. Danach sehen Sie hier Ihre Kontostände und die Buchungen dieses Monats.</EmptyState></section>;
  const balances = model.accountBalances;
  const total = model.totalBalance;
  const month = today().slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' }).format(new Date(`${month}-15T12:00:00Z`));
  const consumption = model.consumptionForMonth(month);
  const recent = model.orderedTransactions.slice(0, 5);
  const due = automation.nextOccurrences(today(), 5);
  return <section>
    <section className="overview-hero" aria-label="Kontostand gesamt"><p>Kontostand gesamt</p><strong className="money hero-amount">{formatMoney(total)}</strong><p>Ihre gespeicherten Kontostände · {monthLabel}</p><div className="hero-footer"><span className="help-text">Anfangsbestände sind keine Einnahmen.</span><Button onClick={onAccounts}>Konten öffnen<ChevronRight size={16} aria-hidden="true" /></Button></div></section>
    <div className="overview-columns">
      <section><div className="section-heading"><h2>Letzte Buchungen</h2><Button variant="quiet" icon={ChevronRight} onClick={() => onTransactions()}>Alle Buchungen</Button></div>{recent.length === 0 ? <p className="help-text">Noch keine Buchungen. Erfassen Sie Ihre erste Zahlung über „Neue Buchung“.</p> : <ul className="plain-list">{recent.map(transaction => <li key={transaction.id}><span className="row-symbol"><Receipt size={18} aria-hidden="true" /></span><span><button className="transaction-link" type="button" onClick={() => onTransactions(transaction.id)}>{model.allPayees.find(payee => payee.id === transaction.payeeId)?.name ?? transaction.note ?? (transaction.kind === 'opening' ? 'Anfangsbestand' : 'Buchung')}</button><small>{displayDate(transaction.date)} · {model.allAccounts.find(account => account.id === transaction.accountId)?.name}</small></span><span className="money">{formatMoney(transaction.amount)}</span></li>)}</ul>}</section>
      <section><div className="section-heading"><h2>Als Nächstes</h2><Button variant="quiet" icon={CalendarClock} onClick={onSchedules}>Dauerzahlungen</Button></div>{due.length === 0 ? <p className="help-text">Keine fälligen Zahlungsvorschläge.</p> : <><p className="help-text">Fällige Zahlungsvorschläge verändern Ihren Kontostand erst nach Bestätigung.</p><ul className="plain-list">{due.map(({ schedule, date }) => <li key={`${schedule.id}:${date}`}><span>{schedule.template.note || 'Dauerzahlung'}<small>{displayDate(date)}</small></span><span className="money">{formatMoney(schedule.template.amount)}</span><Button onClick={onSchedules}>Vorschlag prüfen</Button></li>)}</ul></>}
        <div className="overview-grid"><article><p>Monatsausgaben</p><strong>{formatMoney(consumption.expense)}</strong></article><article><p>Monatseinnahmen</p><strong>{formatMoney(consumption.income)}</strong></article></div>
      </section>
    </div>
    <section><div className="section-heading"><h2>Ihre Konten</h2></div><AccountTable accounts={model.allAccounts} balances={balances} onOpen={onAccount} /></section>
  </section>;
}

function Accounts({ model, saving, selectedId, onSelect, onNew }: { readonly model: FinanceModel; readonly saving: boolean; readonly selectedId?: UUID | undefined; readonly onSelect: (id?: UUID) => void; readonly onNew: (id: UUID) => void }) {
  const [action, setAction] = useState<'create' | 'transfer' | 'reconcile'>();
  const [error, setError] = useState<string>();
  const balances = model.accountBalances;
  const selected = model.allAccounts.find(account => account.id === selectedId);
  async function archive(id: UUID) { try { await model.archiveAccount(id); } catch (reason) { setError(messageFor(reason, 'Das Konto wurde nicht archiviert.')); } }
  return <section>
    {selected === undefined ? <>
      <div className="toolbar"><Button variant="primary" icon={Plus} onClick={() => setAction('create')}>Neues Konto</Button></div>
      {model.accounts.length === 0 ? <EmptyState title="Noch keine Konten" action={<Button onClick={() => setAction('create')}>Erstes Konto anlegen</Button>}>Erfassen Sie ein Konto und optional seinen aktuellen Anfangsbestand.</EmptyState> : <AccountTable accounts={model.accounts} balances={balances} onOpen={onSelect} onArchive={archive} />}
      {model.allAccounts.some(account => account.archived) ? <section><h2>Archivierte Konten</h2><AccountTable accounts={model.allAccounts.filter(account => account.archived)} balances={balances} archived onOpen={onSelect} /></section> : null}
    </> : <>
      <Button variant="quiet" onClick={() => onSelect(undefined)}>Zurück zu Konten</Button>
      <div className="section-heading"><h2>{selected.name}</h2><strong className="money account-balance">{formatMoney(balances.find(balance => balance.accountId === selected.id)?.balance ?? 0)}</strong></div>
      <p className="help-text">{accountTypeLabels[selected.type]} · {selected.onBudget ? 'Im Budget' : 'Außerhalb des Budgets'}{selected.archived ? ' · Archiviert' : ''}</p>
      {selected.archived ? null : <div className="toolbar"><Button variant="primary" icon={Plus} onClick={() => onNew(selected.id)}>Neue Buchung</Button><Button icon={ArrowLeftRight} onClick={() => setAction('transfer')}>Umbuchen</Button><Button icon={Check} onClick={() => setAction('reconcile')}>Abgleichen</Button></div>}
      <h2 className="section-title">Buchungen dieses Kontos</h2><TransactionList model={model} fixedAccountId={selected.id} />
    </>}
    {error === undefined ? null : <p role="alert" className="field-error">{error}</p>}
    {action === 'create' ? <Dialog title="Konto anlegen" busy={saving} onClose={() => setAction(undefined)}><AccountForm model={model} onSaved={() => setAction(undefined)} /></Dialog> : null}
    {action === 'transfer' ? <Dialog title="Umbuchung" busy={saving} onClose={() => setAction(undefined)}><TransferForm model={model} defaultAccountId={selected?.id} onSaved={() => setAction(undefined)} /></Dialog> : null}
    {action === 'reconcile' ? <Dialog title="Konto abgleichen" busy={saving} onClose={() => setAction(undefined)}><ReconciliationForm model={model} defaultAccountId={selected?.id} onSaved={() => setAction(undefined)} /></Dialog> : null}
  </section>;
}
function AccountForm({ model, onSaved }: { readonly model: FinanceModel; readonly onSaved: () => void }) {
  const form = useRef<HTMLFormElement>(null); const saved = useFormDraft(form);
  const [name, setName] = useState(''); const [type, setType] = useState<AccountAggregate['type']>('checking'); const [budget, setBudget] = useState(true);
  const [opening, setOpening] = useState(''); const [date, setDate] = useState(today()); const [error, setError] = useState<string>(); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(undefined); try { await model.addAccount(name, type, type === 'credit' ? false : budget, opening === '' ? undefined : { amount: opening, date }); saved(); onSaved(); } catch (reason) { setError(messageFor(reason, 'Das Konto wurde nicht gespeichert. Ihre Eingaben bleiben erhalten.')); } finally { setBusy(false); } }
  return <form ref={form} className="inline-form" onSubmit={(event) => void submit(event)}><label>Kontoname<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Art<select value={type} onChange={(event) => setType(event.target.value as AccountAggregate['type'])}>{Object.entries(accountTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><input type="checkbox" checked={type === 'credit' ? false : budget} disabled={type === 'credit'} onChange={(event) => setBudget(event.target.checked)} /> Im Budget</label><label>Anfangsbestand (optional)<input inputMode="decimal" value={opening} placeholder="z. B. 1000,00" onChange={(event) => setOpening(event.target.value)} /></label><label>Datum des Anfangsbestands<input type="date" required={opening !== ''} value={date} onChange={(event) => setDate(event.target.value)} /></label><p className="help-text">Der Anfangsbestand zählt zum Kontostand, nicht zu Ihren Einnahmen.</p><button type="submit" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Konto anlegen'}</button>{error === undefined ? null : <p role="alert" className="field-error">{error}</p>}</form>;
}

function Categories({ model }: { readonly model: FinanceModel }) {
  const [action, setAction] = useState<'group' | 'category'>(); const [archiving, setArchiving] = useState<UUID>(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  async function archive() { if (archiving === undefined || busy) return; setBusy(true); setError(undefined); try { await model.archiveCategory(archiving); setArchiving(undefined); } catch (reason) { setError(messageFor(reason, 'Die Kategorie wurde nicht archiviert.')); } finally { setBusy(false); } }
  return <section><div className="toolbar"><Button variant="primary" icon={Plus} onClick={() => setAction('category')}>Neue Kategorie</Button><Button onClick={() => setAction('group')}>Neue Gruppe</Button></div>
    {model.categories.length === 0 ? <EmptyState title="Noch keine Kategorien">Legen Sie eine Gruppe und Ihre erste Kategorie an, um Ausgaben und Einnahmen zu ordnen.</EmptyState> : <ul className="plain-list">{model.categories.map(category => <li key={category.id}><span>{category.name}<small>{model.groups.find(group => group.id === category.groupId)?.name}</small></span><Button variant="quiet" onClick={() => setArchiving(category.id)}>Archivieren</Button></li>)}</ul>}
    {model.groups.length > 0 ? <p className="help-text">Gruppen: {model.groups.filter(group => !group.archived).map(group => group.name).join(', ')}</p> : null}
    {action === undefined ? null : <Dialog title={action === 'group' ? 'Kategoriegruppe anlegen' : 'Kategorie anlegen'} busy={busy} onClose={() => setAction(undefined)}><MasterDataForm kind={action} model={model} onBusy={setBusy} onSaved={() => setAction(undefined)} /></Dialog>}
    {archiving === undefined ? null : <Dialog title="Kategorie archivieren?" busy={busy} onClose={() => setArchiving(undefined)}><p>{model.categories.find(category => category.id === archiving)?.name} bleibt an bestehenden Buchungen sichtbar und wird für neue Buchungen nicht mehr angeboten.</p><Button onClick={() => void archive()} disabled={busy}>Archivieren bestätigen</Button>{error === undefined ? null : <p role="alert">{error}</p>}</Dialog>}
  </section>;
}
function Payees({ model }: { readonly model: FinanceModel }) {
  const [action, setAction] = useState<'create' | 'merge'>(); const [busy, setBusy] = useState(false);
  return <section><div className="toolbar"><Button variant="primary" icon={Plus} onClick={() => setAction('create')}>Neuer Empfänger</Button>{model.payees.length < 2 ? null : <Button onClick={() => setAction('merge')}>Empfänger zusammenführen</Button>}</div>
    {model.payees.length === 0 ? <EmptyState title="Noch keine Empfänger">Empfänger sind optional. Legen Sie häufige Empfänger an, um sie beim Buchen auszuwählen.</EmptyState> : <ul className="plain-list">{model.payees.map(payee => <li key={payee.id}><span>{payee.name}<small>{payee.aliases.length > 0 ? `Auch bekannt als: ${payee.aliases.join(', ')}` : 'Zahlungsempfänger'}</small></span></li>)}</ul>}
    {action === undefined ? null : <Dialog title={action === 'create' ? 'Empfänger anlegen' : 'Empfänger zusammenführen'} busy={busy} onClose={() => setAction(undefined)}>{action === 'create' ? <MasterDataForm kind="payee" model={model} onBusy={setBusy} onSaved={() => setAction(undefined)} /> : <MergePayeesForm model={model} onBusy={setBusy} onSaved={() => setAction(undefined)} />}</Dialog>}
  </section>;
}
function MasterDataForm({ kind, model, onBusy, onSaved }: { readonly kind: 'group' | 'category' | 'payee'; readonly model: FinanceModel; readonly onBusy: (value: boolean) => void; readonly onSaved: () => void }) {
  const form = useRef<HTMLFormElement>(null); useFormDraft(form);
  const [name, setName] = useState(''); const [group, setGroup] = useState(''); const [groupKind, setGroupKind] = useState<'expense' | 'income'>('expense'); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  async function submit(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); onBusy(true); setError(undefined); try { if (kind === 'group') await model.addGroup(name, groupKind); else if (kind === 'category') await model.addCategory(name, group as UUID); else await model.addPayee(name); onSaved(); } catch (reason) { setError(messageFor(reason, 'Die Eingaben wurden nicht gespeichert.')); } finally { setBusy(false); onBusy(false); } }
  return <form ref={form} onSubmit={event => void submit(event)}><fieldset className="transaction-fields" disabled={busy}><label>{kind === 'group' ? 'Neue Kategoriegruppe' : kind === 'category' ? 'Kategorie' : 'Empfänger'}<input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label>
    {kind === 'group' ? <label>Art<select value={groupKind} onChange={event => setGroupKind(event.target.value as 'expense' | 'income')}><option value="expense">Ausgaben</option><option value="income">Einnahmen</option></select></label> : null}
    {kind === 'category' ? <label>Gruppe<select required value={group} onChange={event => setGroup(event.target.value)}><option value="">Auswählen</option>{model.groups.filter(entry => !entry.archived).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{model.groups.filter(entry => !entry.archived).length === 0 ? <small>Legen Sie zuerst eine Kategoriegruppe an.</small> : null}</label> : null}
    <button type="submit">{kind === 'group' ? 'Gruppe anlegen' : kind === 'category' ? 'Kategorie anlegen' : 'Empfänger anlegen'}</button>{error === undefined ? null : <p role="alert" className="field-error">{error}</p>}</fieldset></form>;
}
function MergePayeesForm({ model, onBusy, onSaved }: { readonly model: FinanceModel; readonly onBusy: (value: boolean) => void; readonly onSaved: () => void }) {
  const form = useRef<HTMLFormElement>(null); useFormDraft(form);
  const [source, setSource] = useState(''); const [target, setTarget] = useState(''); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  async function submit(event: FormEvent) { event.preventDefault(); if (!confirmed) { setConfirmed(true); return; } if (busy) return; setBusy(true); onBusy(true); setError(undefined); try { await model.mergePayees(target as UUID, source as UUID); onSaved(); } catch (reason) { setError(messageFor(reason, 'Die Empfänger wurden nicht zusammengeführt.')); } finally { setBusy(false); onBusy(false); } }
  return <form ref={form} onSubmit={event => void submit(event)}><fieldset className="transaction-fields" disabled={busy}><label>Quell-Empfänger<select required value={source} onChange={event => { setSource(event.target.value); setConfirmed(false); }}><option value="">Auswählen</option>{model.payees.map(payee => <option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label><label>Ziel-Empfänger<select required value={target} onChange={event => { setTarget(event.target.value); setConfirmed(false); }}><option value="">Auswählen</option>{model.payees.filter(payee => payee.id !== source).map(payee => <option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label>
    {confirmed ? <p>Alle Buchungen von {model.payees.find(payee => payee.id === source)?.name} werden {model.payees.find(payee => payee.id === target)?.name} zugeordnet. Die Quelle bleibt archiviert. Erst „Zusammenführen“ bestätigt diese Änderung.</p> : <p>Wählen Sie Quelle und Ziel. Im nächsten Schritt prüfen Sie die Zusammenführung.</p>}
    <button type="submit">{confirmed ? 'Zusammenführen' : 'Zusammenführen und archivieren'}</button>{error === undefined ? null : <p role="alert" className="field-error">{error}</p>}</fieldset></form>;
}

const accountTypeLabels = { checking: 'Girokonto', cash: 'Bargeld', savings: 'Sparkonto', credit: 'Kreditkarte', other: 'Sonstiges' } as const;
function AccountTable({ accounts, balances, onArchive, onOpen, archived = false }: { readonly accounts: readonly AccountAggregate[]; readonly balances: readonly { readonly accountId: UUID; readonly balance: number }[]; readonly onOpen?: (id: UUID) => void; readonly onArchive?: (id: UUID) => Promise<void>; readonly archived?: boolean }) { return <div className="table-wrap" role="region" aria-label={archived ? 'Archivierte Konten' : 'Kontoliste'} tabIndex={0}><table className="account-table"><thead><tr><th>Konto</th><th>Art</th><th className="money">Guthaben</th>{archived ? <th>Status</th> : null}{onArchive === undefined ? null : <th><span className="visually-hidden">Aktion</span></th>}</tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{onOpen === undefined ? account.name : <button className="transaction-link" type="button" onClick={() => onOpen(account.id)}>{account.name}</button>}<small>{account.onBudget ? 'Im Budget' : 'Außerhalb des Budgets'}</small></td><td>{accountTypeLabels[account.type]}</td><td className="money">{formatMoney(balances.find((balance) => balance.accountId === account.id)?.balance ?? 0)}</td>{archived ? <td>Archiviert</td> : null}{onArchive === undefined ? null : <td><button className="quiet small-action" onClick={() => void onArchive(account.id)} type="button">Archivieren</button></td>}</tr>)}</tbody></table></div>; }
function titleFor(view: View) { return ({ overview: 'Übersicht', accounts: 'Konten', categories: 'Kategorien', payees: 'Empfänger', transactions: 'Buchungen', import: 'Import', automation: 'Regeln', schedules: 'Dauerzahlungen', settings: 'Einstellungen', more: 'Mehr', help: 'Hilfe' })[view]; }
export function formatMoney(cents: number) { return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
function messageFor(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback; }

export function displayDate(date: string) { const [year, month, day] = date.split('-'); return `${day}.${month}.${year}`; }
