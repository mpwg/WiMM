// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

import type { AtomicBatch, UUID } from '@wimm/contracts';
import {
  createAggregateMetadata,
  projectAccountBalances,
  projectConsumption,
  sumMoney,
  parseFinanceDate,
  parseMoney,
  reviseAggregate,
  subtractMoney,
  archiveAccount,
  archiveCategory,
  mergePayees,
  saveTransfer,
  confirmReconciliation,
  reconciliationDifference,
  unlockFinanceSelection,
  deleteTransfer,
  saveTransaction,
  deleteTransaction,
  saveAccount,
  saveCategory,
  saveCategoryGroup,
  savePayee,
  type AccountAggregate,
  type CategoryAggregate,
  type CategoryGroupAggregate,
  type DomainChangeSet,
  type DomainDependencies,
  type PayeeAggregate,
  type P2Aggregate,
  type TransactionAggregate
  , type TransferAggregate
  , type ReconciliationAggregate
} from '@wimm/domain';
import { toStoredAggregate, type PendingOperation, type StoredAggregate, type StoredProjection } from '@wimm/storage';

import type { UnlockedAppContext } from './app.js';
import { DraftProtection, useDraftGuard } from './drafts.js';
import { isTextEditing } from './platform.js';
import { FinanceHistory } from './history.js';
import { TransferForm, ReconciliationForm } from './account-actions.js';
import { Transactions } from './transactions.js';

type ColorScheme = 'system' | 'light' | 'dark';

function storedColorScheme(): ColorScheme {
  try {
    const value = localStorage.getItem('wimm:color-scheme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
}

export interface TransactionInput {
  readonly accountId: UUID; readonly payeeId?: UUID; readonly amount: string; readonly date: string; readonly note: string; readonly opening: boolean;
  readonly splits: readonly { readonly id?: UUID; readonly categoryId: UUID; readonly amount: string }[];
}

type View = 'overview' | 'accounts' | 'categories' | 'payees' | 'transactions';

/**
 * Der Composition Root wählt den dauerhaften Speicher. Die Fachansicht kennt
 * weder IndexedDB noch Tauri und hält lediglich ihren Navigationszustand selbst.
 */
export interface WorkspaceStorage {
  query(query: { readonly spaceId: UUID }): Promise<readonly StoredAggregate[]>;
  applyAtomicBatch(batch: AtomicBatch<StoredAggregate, PendingOperation, StoredProjection>): Promise<void>;
  close?(): Promise<void>;
}

export type WorkspaceStorageFactory = (profileId: UUID) => WorkspaceStorage;

export function FinanceWorkspace(props: { readonly context: UnlockedAppContext; readonly storageForProfile: WorkspaceStorageFactory; readonly desktop?: boolean }) {
  const [view, setView] = useState<View>('overview');
  return <DraftProtection><WorkspaceContent view={view} setView={setView} key={`${props.context.profile.profileId}:${props.context.activeArea.id}`} {...props} /></DraftProtection>;
}
function WorkspaceContent({ context, storageForProfile, desktop = false, view, setView }: { readonly context: UnlockedAppContext; readonly storageForProfile: WorkspaceStorageFactory; readonly desktop?: boolean; readonly view: View; readonly setView: (view: View) => void }) {
  const guard = useDraftGuard();
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
  const [newVersion, setNewVersion] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ target: 'amount' | 'search'; version: number }>();
  const [history] = useState(() => new FinanceHistory());
  const aggregatesRef = useRef<readonly StoredAggregate[]>([]);
  const busy = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(storedColorScheme);
  const changeColorScheme = (value: ColorScheme) => {
    setColorScheme(value);
    try { localStorage.setItem('wimm:color-scheme', value); } catch { /* Die Auswahl bleibt für diese Sitzung nutzbar. */ }
  };
  const [aggregates, setAggregates] = useState<readonly StoredAggregate[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const storage = useMemo(() => storageForProfile(context.profile.profileId as UUID), [storageForProfile, context.profile.profileId]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reload = useCallback(async () => {
    try { setState('loading'); const loaded = await storage.query({ spaceId: context.activeArea.id as UUID }); aggregatesRef.current = loaded; setAggregates(loaded); setState('ready'); }
    catch { setMessage('Die lokalen Daten konnten nicht gelesen werden.'); setState('error'); }
  }, [storage, context.activeArea.id]);
  useEffect(() => {
    if (closeTimer.current !== undefined) clearTimeout(closeTimer.current);
    // Der Effekt synchronisiert den ausgewählten Bereich mit dem externen Speicher.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload();
    return () => {
      // React Strict Mode startet Effekte im Entwicklungslauf absichtlich erneut.
      // Der folgende Durchlauf hebt den aufgeschobenen Schluss wieder auf.
      closeTimer.current = setTimeout(() => { void storage.close?.(); }, 0);
    };
  }, [storage, reload]);

  const execute = useCallback(async (changeSet: DomainChangeSet, record = true) => {
    if (busy.current) throw new Error('Bitte warten Sie auf die laufende Speicherung.');
    busy.current = true;
    const before = aggregatesRef.current;
    setSaving(true); setMessage(undefined);
    try {
      await storage.applyAtomicBatch({
        expectedRevisions: changeSet.expectedRevisions.map((entry) => ({ handle: entry.id, expectedRevision: entry.expectedRevision })),
        aggregates: changeSet.aggregates.map((aggregate) => toStoredAggregate(aggregate)),
        outbox: [],
        projections: []
      });
      // Den bestätigten Batch direkt übernehmen: ein nachgelagerter Lesefehler
      // darf keinen erneuten Schreibversuch derselben Neuanlage auslösen.
      const changed = new Map(changeSet.aggregates.map((entry) => [entry.id, toStoredAggregate(entry)]));
      aggregatesRef.current = [...before.filter((entry) => !changed.has(entry.id)), ...changed.values()];
      setAggregates(aggregatesRef.current);
      if (record) history.record(changeSet, before);
      setHistoryVersion((version) => version + 1);
      setMessage('Lokal gespeichert.');
    } catch (error) {
      setMessage('Die Eingaben wurden nicht gespeichert.');
      if (error instanceof Error && /revision|stale/i.test(error.message)) {
        try { const loaded = await storage.query({ spaceId: context.activeArea.id as UUID }); aggregatesRef.current = loaded; setAggregates(loaded); }
        catch { /* Der ursprüngliche Schreibfehler und der Entwurf bleiben erhalten. */ }
      }
      throw error;
    }
    finally { busy.current = false; setSaving(false); }
  }, [storage, context.activeArea.id, history]);
  // Der Konstruktor speichert den Callback; Refzugriffe erfolgen erst bei Benutzeraktionen.
  // oxlint-disable-next-line react/refs
  const model = useMemo(() => new FinanceModel(context.activeArea.id as UUID, aggregates, execute), [aggregates, context.activeArea.id, execute]);

  async function moveHistory(direction: 'undo' | 'redo') {
    if (busy.current) return;
    try {
      await history.move(direction, aggregatesRef.current, model.domainDependencies, (change) => execute(change, false));
      setHistoryVersion((version) => version + 1);
    } catch (error) { setMessage(messageFor(error, 'Die Aktion wurde nicht ausgeführt.')); }
  }
  useEffect(() => {
    if (focusRequest !== undefined && state === 'ready' && view === 'transactions') {
      document.querySelector<HTMLInputElement>(focusRequest.target === 'amount' ? '[aria-label="Buchung erfassen"] input[aria-label="Betrag"]' : '[data-transaction-search]')?.focus();
    }
  }, [focusRequest, state, view, newVersion]);
  useEffect(() => {
    function command(id: string, native = false) {
      const editing = isTextEditing(document.activeElement);
      if ((id === 'undo' || id === 'redo') && editing) {
        if (native) document.execCommand(id);
        return;
      }
      if (saving || state !== 'ready' || document.querySelector('dialog[open]') !== null) return;
      if (id === 'undo' || id === 'redo') { guard.request(() => { void moveHistory(id); }); return; }
      if (id === 'new-transaction' || id === 'search') {
        const action = () => { setView('transactions'); if (id === 'new-transaction') setNewVersion((value) => value + 1); setFocusRequest((value) => ({ target: id === 'search' ? 'search' : 'amount', version: (value?.version ?? 0) + 1 })); };
        if (id === 'search' && view === 'transactions') action(); else guard.request(action);
      }
      if (id === 'overview') guard.request(() => setView('overview'));
      if (id === 'settings') guard.request(() => setView('categories'));
    }
    function keydown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const id = key === 'n' ? 'new-transaction' : key === 'f' ? 'search' : key === 'z' ? (event.shiftKey ? 'redo' : 'undo') : key === 'y' && event.ctrlKey ? 'redo' : undefined;
      if (id === undefined || ((id === 'undo' || id === 'redo') && isTextEditing(document.activeElement))) return;
      event.preventDefault(); command(id);
    }
    document.addEventListener('keydown', keydown);
    let disposed = false; let unlisten: (() => void) | undefined;
    void context.platform.onMenuCommand((id) => command(id, true)).then((stop) => { if (disposed) stop(); else unlisten = stop; }).catch(() => setMessage('Die Systemmenüs konnten nicht verbunden werden.'));
    void context.platform.setMenuCommands(['new-transaction', 'search', 'overview', 'settings'].map((id) => ({ id, title: id, enabled: state === 'ready' && !saving }))).catch(() => setMessage('Die Systemmenüs konnten nicht aktualisiert werden.'));
    return () => { disposed = true; unlisten?.(); document.removeEventListener('keydown', keydown); };
  });
  useEffect(() => () => {
    void context.platform.setMenuCommands(['new-transaction', 'search', 'overview', 'settings'].map((id) => ({ id, title: id, enabled: false })));
  }, [context.platform]);
  function navigate(next: View) {
    setView(next);
    if (matchMedia('(max-width: 767px)').matches) requestAnimationFrame(() => document.querySelector<HTMLElement>('.finance-main')?.scrollIntoView({ block: 'start' }));
  }
  useEffect(() => {
    if (state === 'ready' && matchMedia('(max-width: 767px)').matches) document.querySelector<HTMLElement>('.finance-main')?.scrollIntoView({ block: 'start' });
  }, [view, state]);
  return <div ref={shell} data-history-version={historyVersion} className={`app-shell${desktop ? ' desktop-shell' : ''}`} data-color-scheme={colorScheme}>
    <aside className="sidebar"><p className="product">WhereIsMyMoney</p><AreaPicker context={context} disabled={saving} request={(action, trigger) => guard.request(action, undefined, trigger)} />
      <p className="mobile-only more-title">Mehr</p><nav id="more-navigation" aria-label="Hauptnavigation" tabIndex={-1}>{([['overview', 'Übersicht'], ['transactions', 'Buchungen'], ['accounts', 'Konten'], ['categories', 'Kategorien'], ['payees', 'Empfänger']] as const).map(([id, label]) =>
        <button data-primary={id === 'overview' || id === 'transactions' ? 'true' : undefined} disabled={saving} aria-current={view === id ? 'page' : undefined} key={id} onClick={() => guard.request(() => navigate(id))} type="button">{label}</button>
      )}</nav><button disabled={saving} className="quiet" onClick={() => guard.request(() => { void context.createHousehold(); })} type="button">+ Haushalt anlegen</button><button disabled={saving} className="quiet" onClick={() => guard.request(() => { void context.lock(); })} type="button">Tresor sperren</button>
      <details><summary>Hilfe</summary><p>WhereIsMyMoney · Version 0.0.0</p>{[['Hilfe und Quellcode', 'https://github.com/mpwg/WiMM'], ['Lizenz AGPL-3.0-or-later', 'https://www.gnu.org/licenses/agpl-3.0.html']].map(([label, url]) => <p key={url}><a href={url} onClick={(event) => { event.preventDefault(); void context.platform.openExternalUrl(url!).catch(() => setMessage('Der Link konnte nicht geöffnet werden.')); }}>{label}</a></p>)}</details>
      <label className="area-picker">Farbschema<select value={colorScheme} onChange={(event) => changeColorScheme(event.target.value as ColorScheme)}><option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label>
    </aside>
    <nav ref={mobileNavigation} className="mobile-navigation" aria-label="Mobile Hauptnavigation">
      {([['overview', 'Übersicht'], ['transactions', 'Buchungen']] as const).map(([id, label]) => <button disabled={saving} aria-current={view === id ? 'page' : undefined} key={id} onClick={() => guard.request(() => navigate(id))} type="button">{label}</button>)}
      <button type="button" onClick={() => { const navigation = document.getElementById('more-navigation'); navigation?.scrollIntoView({ block: 'center' }); navigation?.querySelector<HTMLButtonElement>('button:not([data-primary])')?.focus(); }}>Mehr</button>
    </nav>
    <main className="finance-main" key={context.activeArea.id}><header><div><p className="eyebrow">{context.activeArea.kind === 'private' ? 'Privatbereich' : 'Gemeinsamer Bereich'}</p><h1>{titleFor(view)}</h1></div><span aria-live="polite" className="local-status">{saving ? "Wird lokal gespeichert …" : "● Lokaler Stand"}</span></header>
      {message === undefined ? null : <p aria-live="polite" className="notice">{message}</p>}
      {state === 'loading' ? <p aria-live="polite">Lokale Daten werden geladen …</p> : null}
      {state === 'error' ? <p role="alert">Die Daten bleiben unverändert. Bitte entsperren Sie den Tresor erneut oder starten Sie die App neu.</p> : null}
      <div className="dialog-actions"><button disabled={saving || !history.canUndo} type="button" onClick={() => void moveHistory('undo')}>Rückgängig</button><button disabled={saving || !history.canRedo} type="button" onClick={() => void moveHistory('redo')}>Wiederholen</button></div>
      <fieldset className="workspace-content" disabled={saving}>
      {state === 'ready' && view === 'overview' ? <Overview model={model} onNew={() => guard.request(() => setView('transactions'))} /> : null}
      {state === 'ready' && view === 'accounts' ? <Accounts model={model} /> : null}
      {state === 'ready' && view === 'categories' ? <Categories model={model} /> : null}
      {state === 'ready' && view === 'payees' ? <Payees model={model} /> : null}
      {state === 'ready' && view === 'transactions' ? <Transactions key={newVersion} model={model} /> : null}
      </fieldset>
    </main>
  </div>;
}

export class FinanceModel {
  readonly allAccounts: readonly AccountAggregate[];
  readonly accounts: readonly AccountAggregate[];
  readonly allCategories: readonly CategoryAggregate[];
  readonly categories: readonly CategoryAggregate[];
  readonly groups: readonly CategoryGroupAggregate[];
  readonly allPayees: readonly PayeeAggregate[];
  readonly payees: readonly PayeeAggregate[];
  readonly transactions: readonly TransactionAggregate[];
  private readonly heads = new Map<UUID, P2Aggregate>();
  readonly domainDependencies: DomainDependencies = { ids: { next: () => crypto.randomUUID() as UUID }, clock: { now: () => new Date().toISOString() as never } };
  constructor(private readonly spaceId: UUID, aggregates: readonly StoredAggregate[], private readonly execute: (changeSet: DomainChangeSet) => Promise<void>) {
    aggregates.forEach((aggregate) => this.heads.set(aggregate.id, aggregate));
    this.allAccounts = aggregates.filter((aggregate): aggregate is StoredAggregate & AccountAggregate => aggregate.aggregateType === 'account' && aggregate.deletedAt === undefined);
    this.accounts = this.allAccounts.filter((account) => !account.archived);
    this.allCategories = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryAggregate => aggregate.aggregateType === 'category' && aggregate.deletedAt === undefined);
    this.categories = this.allCategories.filter((category) => !category.archived);
    this.groups = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryGroupAggregate => aggregate.aggregateType === 'categoryGroup' && aggregate.deletedAt === undefined);
    this.allPayees = aggregates.filter((aggregate): aggregate is StoredAggregate & PayeeAggregate => aggregate.aggregateType === 'payee' && aggregate.deletedAt === undefined);
    this.payees = this.allPayees.filter((payee) => !payee.archived);
    this.transactions = aggregates.filter((aggregate): aggregate is StoredAggregate & TransactionAggregate => aggregate.aggregateType === 'transaction' && aggregate.deletedAt === undefined);
  }
  async addAccount(name: string, type: AccountAggregate['type'], onBudget: boolean) {
    const aggregate: AccountAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'account', name, type, onBudget, archived: false };
    await this.execute(saveAccount({ commandType: 'account.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async addGroup(name: string, kind: CategoryGroupAggregate['kind']) {
    const aggregate: CategoryGroupAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'categoryGroup', name, kind, sortOrder: this.groups.length, archived: false };
    await this.execute(saveCategoryGroup({ commandType: 'categoryGroup.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async addCategory(name: string, groupId: UUID) {
    const group = this.groups.find((entry) => entry.id === groupId); if (group === undefined) throw new TypeError('Bitte zuerst eine Kategoriegruppe anlegen.');
    const aggregate: CategoryAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'category', groupId, name, sortOrder: this.categories.filter((entry) => entry.groupId === groupId).length, archived: false };
    await this.execute(saveCategory({ commandType: 'category.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }, { id: group.id, expectedRevision: group.revision }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async addPayee(name: string) {
    const aggregate: PayeeAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'payee', name, aliases: [], archived: false };
    await this.execute(savePayee({ commandType: 'payee.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async archiveAccount(id: UUID) {
    const account = this.accounts.find((entry) => entry.id === id);
    if (account === undefined) throw new TypeError('Dieses Konto ist nicht mehr aktiv.');
    const archived = reviseAggregate({ ...account, archived: true }, this.domainDependencies);
    await this.execute(archiveAccount({
      commandType: 'account.archive',
      spaceId: this.spaceId,
      expectedRevisions: [{ id: account.id, expectedRevision: account.revision }],
      mutations: [{ aggregate: archived }]
    }, this, this.domainDependencies));
  }
  async archiveCategory(id: UUID) {
    const category = this.categories.find((entry) => entry.id === id);
    if (category === undefined) throw new TypeError('Diese Kategorie ist nicht mehr aktiv.');
    const group = this.groups.find((entry) => entry.id === category.groupId);
    if (group === undefined) throw new TypeError('Die Kategoriegruppe ist nicht mehr verfügbar.');
    const archived = reviseAggregate({ ...category, archived: true }, this.domainDependencies);
    await this.execute(archiveCategory({
      commandType: 'category.archive',
      spaceId: this.spaceId,
      expectedRevisions: [
        { id: category.id, expectedRevision: category.revision },
        { id: group.id, expectedRevision: group.revision }
      ],
      mutations: [{ aggregate: archived }]
    }, this, this.domainDependencies));
  }
  async mergePayees(targetId: UUID, sourceId: UUID) {
    const target = this.payees.find((entry) => entry.id === targetId);
    const source = this.payees.find((entry) => entry.id === sourceId);
    if (target === undefined || source === undefined || target.id === source.id) {
      throw new TypeError('Bitte wählen Sie zwei verschiedene aktive Empfänger.');
    }
    await this.execute(mergePayees({
      spaceId: this.spaceId,
      target,
      sources: [source],
      transactions: this.transactions.filter((transaction) => transaction.payeeId === source.id)
    }, this, this.domainDependencies));
  }
  async storeTransaction(input: TransactionInput, previous?: TransactionAggregate) {
    const amount = parseMoney(input.amount, 'Der Betrag');
    const splits = input.opening ? [] : input.splits.map((split, index) => ({
      id: split.id ?? this.domainDependencies.ids.next(), categoryId: split.categoryId,
      amount: parseMoney(split.amount, `Der Splitbetrag ${index + 1}`)
    }));
    // Die geöffnete Revision bleibt erhalten, auch wenn sich der Listenstand ändert.
    const metadata = previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(previous, this.domainDependencies);
    const { payeeId: _oldPayee, note: _oldNote, ...base } = metadata as TransactionAggregate;
    const aggregate: TransactionAggregate = {
      ...base, aggregateType: 'transaction', accountId: input.accountId, date: parseFinanceDate(input.date), amount,
      kind: input.opening ? 'opening' : 'normal', clearance: previous?.clearance ?? 'uncleared',
      ...(input.payeeId === undefined ? {} : { payeeId: input.payeeId }),
      ...(input.note.trim() === '' ? {} : { note: input.note.trim() }), splits
    };
    await this.execute(saveTransaction({ commandType: 'transaction.save', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(aggregate, previous?.revision ?? 0), mutations: [{ aggregate }] }, this, this.domainDependencies));
  }
  async removeTransaction(transaction: TransactionAggregate) {
    await this.execute(deleteTransaction({ commandType: 'transaction.delete', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(transaction, transaction.revision), mutations: [{ aggregate: transaction }] }, this, this.domainDependencies));
  }
  private transactionRevisions(transaction: TransactionAggregate, revision: number) {
    return [{ id: transaction.id, expectedRevision: revision },
      ...[...new Set([transaction.accountId, ...transaction.splits.map((split) => split.categoryId), ...(transaction.payeeId === undefined ? [] : [transaction.payeeId])])]
        .map((id) => { const head = this.heads.get(id); if (head === undefined) throw new TypeError('Eine Buchungsreferenz ist nicht mehr verfügbar.'); return { id, expectedRevision: head.revision }; })];
  }
  async addTransfer(sourceAccountId: UUID, targetAccountId: UUID, value: string, date: string, budgetCategoryId?: UUID, budgetRelease = false, previous?: TransferAggregate) {
    const amount = parseMoney(value, 'Der Umbuchungsbetrag');
    const sourceAccount = this.accounts.find((account) => account.id === sourceAccountId); const targetAccount = this.accounts.find((account) => account.id === targetAccountId);
    if (sourceAccount === undefined || targetAccount === undefined) throw new TypeError('Quell- und Zielkonto müssen ausgewählt werden.');
    const { budgetCategoryId: _oldCategory, budgetRelease: _oldRelease, ...metadata } = previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) as TransferAggregate : reviseAggregate(previous, this.domainDependencies);
    const transfer: TransferAggregate = { ...metadata, aggregateType: 'transfer', date: parseFinanceDate(date), sourceAccountId, targetAccountId, sourceTransactionId: previous?.sourceTransactionId ?? this.domainDependencies.ids.next(), targetTransactionId: previous?.targetTransactionId ?? this.domainDependencies.ids.next(), amount, ...(budgetCategoryId === undefined ? {} : { budgetCategoryId }), ...(budgetRelease ? { budgetRelease: true } : {}) };
    const source: TransactionAggregate = { ...(previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(this.heads.get(previous.sourceTransactionId) as TransactionAggregate, this.domainDependencies)), id: transfer.sourceTransactionId, aggregateType: 'transaction', accountId: sourceAccountId, date: transfer.date, amount: subtractMoney(0 as never, amount), kind: 'transfer', clearance: previous === undefined ? 'uncleared' : (this.heads.get(transfer.sourceTransactionId) as TransactionAggregate).clearance, transferId: transfer.id, splits: [] };
    const target: TransactionAggregate = { ...(previous === undefined ? createAggregateMetadata(this.spaceId, this.domainDependencies) : reviseAggregate(this.heads.get(previous.targetTransactionId) as TransactionAggregate, this.domainDependencies)), id: transfer.targetTransactionId, aggregateType: 'transaction', accountId: targetAccountId, date: transfer.date, amount, kind: 'transfer', clearance: previous === undefined ? 'uncleared' : (this.heads.get(transfer.targetTransactionId) as TransactionAggregate).clearance, transferId: transfer.id, splits: [] };
    await this.execute(saveTransfer({ spaceId: this.spaceId, transfer, source, target, sourceAccount, targetAccount, ...this.budgetReferences(transfer) }, this, this.domainDependencies));
  }
  private budgetReferences(transfer: TransferAggregate) {
    const budgetCategory = this.allCategories.find((entry) => entry.id === transfer.budgetCategoryId);
    const budgetGroup = this.groups.find((entry) => entry.id === budgetCategory?.groupId);
    return { ...(budgetCategory === undefined ? {} : { budgetCategory }), ...(budgetGroup === undefined ? {} : { budgetGroup }) };
  }
  transferFor(transaction: TransactionAggregate) { return this.heads.get(transaction.transferId!) as TransferAggregate | undefined; }
  async removeTransfer(transfer: TransferAggregate) {
    await this.execute(deleteTransfer({ spaceId: this.spaceId, transfer, source: this.heads.get(transfer.sourceTransactionId) as TransactionAggregate, target: this.heads.get(transfer.targetTransactionId) as TransactionAggregate, sourceAccount: this.heads.get(transfer.sourceAccountId) as AccountAggregate, targetAccount: this.heads.get(transfer.targetAccountId) as AccountAggregate, ...this.budgetReferences(transfer) }, this, this.domainDependencies));
  }
  async unlock(transaction: TransactionAggregate) {
    if (this.heads.get(transaction.id)?.revision !== transaction.revision) throw new Error('REVISION_CONFLICT: Die Buchung wurde inzwischen geändert.');
    await this.execute(unlockFinanceSelection(this.spaceId, transaction.id, [...this.heads.values()], this.domainDependencies));
  }
  reconciliationInput(accountId: UUID, value: string, date: string, ids: readonly UUID[]) {
    const transactions = ids.map((id) => {
      const transaction = this.transactions.find((entry) => entry.id === id);
      if (transaction === undefined || transaction.clearance === 'reconciled') throw new TypeError('Eine ausgewählte Buchung ist nicht mehr für den Abgleich verfügbar.');
      return transaction;
    });
    const reconciliation: ReconciliationAggregate = { ...createAggregateMetadata(this.spaceId, this.domainDependencies), aggregateType: 'reconciliation', accountId, statementDate: parseFinanceDate(date), statementBalance: parseMoney(value, 'Der Auszugssaldo'), transactionIds: [...ids] };
    return { spaceId: this.spaceId, reconciliation, transactions, previousTransactions: this.transactions.filter((transaction) => transaction.accountId === accountId && transaction.clearance === 'reconciled' && transaction.date <= date) };
  }
  difference(accountId: UUID, value: string, date: string, ids: readonly UUID[]) { return reconciliationDifference(this.reconciliationInput(accountId, value, date, ids)); }
  async reconcile(accountId: UUID, value: string, date: string, ids: readonly UUID[]) {
    const result = confirmReconciliation(this.reconciliationInput(accountId, value, date, ids), this, this.domainDependencies);
    await this.execute(result.changeSet);
  }
  get(id: UUID) { const aggregate = this.heads.get(id); return aggregate === undefined ? undefined : { id: aggregate.id, spaceId: aggregate.spaceId, revision: aggregate.revision, aggregateType: aggregate.aggregateType }; }
}

function AreaPicker({ context, disabled = false, request }: { readonly context: UnlockedAppContext; readonly disabled?: boolean; readonly request: (action: () => void, trigger: HTMLElement) => void }) { return <label className="area-picker">Bereich<select aria-label="Bereich" disabled={disabled} onChange={(event) => { const id = event.target.value; request(() => context.selectArea(id), event.currentTarget); }} value={context.activeArea.id}>{context.profile.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>; }
function Overview({ model, onNew }: { readonly model: FinanceModel; readonly onNew: () => void }) {
  const balances = projectAccountBalances(model.transactions);
  const total = sumMoney(balances.map((item) => item.balance), 'Das Gesamtguthaben');
  const month = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit' }).format(new Date());
  const consumption = projectConsumption(model.transactions.filter((transaction) => transaction.date.startsWith(month)), model.allCategories, model.groups);
  return <section><div className="overview-grid"><article><p>Verfügbares Geld</p><strong>{formatMoney(total)}</strong></article><article><p>Monatsausgaben</p><strong>{formatMoney(consumption.expense)}</strong></article><article><p>Monatseinnahmen</p><strong>{formatMoney(consumption.income)}</strong></article><article><p>Ausstehende Änderungen</p><strong>Keine</strong></article></div>{model.accounts.length === 0 ? <Empty title="Noch keine Konten" text="Legen Sie zuerst ein Konto mit Anfangsbestand an. Erfundenes Guthaben zeigt die Übersicht nicht." /> : <AccountTable accounts={model.accounts} balances={balances} />}<button onClick={onNew} type="button">Neue Buchung</button></section>;
}
function Accounts({ model }: { readonly model: FinanceModel }) {
  const [name, setName] = useState(''); const [type, setType] = useState<AccountAggregate['type']>('checking'); const [budget, setBudget] = useState(true); const [error, setError] = useState<string>();
  async function submit(event: FormEvent) { event.preventDefault(); setError(undefined); try { await model.addAccount(name, type, budget); setName(''); } catch (reason) { setError(messageFor(reason, 'Das Konto wurde nicht gespeichert.')); } }
  async function archive(id: UUID) { setError(undefined); try { await model.archiveAccount(id); } catch (reason) { setError(messageFor(reason, 'Das Konto wurde nicht archiviert.')); } }
  const balances = projectAccountBalances(model.transactions);
  return <section><form className="inline-form" onSubmit={(event) => void submit(event)}><label>Kontoname<input onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Art<select onChange={(event) => setType(event.target.value as AccountAggregate['type'])} value={type}><option value="checking">Girokonto</option><option value="cash">Bargeld</option><option value="savings">Sparkonto</option><option value="credit">Kreditkarte</option><option value="other">Sonstiges</option></select></label><label><input checked={budget} onChange={(event) => setBudget(event.target.checked)} type="checkbox" /> Im Budget</label><button type="submit">Konto anlegen</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}{model.accounts.length === 0 ? <Empty title="Noch keine Konten" text="Der Anfangsbestand wird bei der ersten Buchung erfasst." /> : <><AccountTable accounts={model.accounts} balances={balances} onArchive={archive} /><p className="help-text">Archivierte Konten bleiben für ihre bestehenden Buchungen erhalten und erscheinen nicht mehr in neuen Auswahlen.</p><TransferForm model={model} /><ReconciliationForm model={model} /></>}{model.allAccounts.some((account) => account.archived) ? <section aria-labelledby="archivierte-konten"><h2 id="archivierte-konten">Archivierte Konten</h2><AccountTable accounts={model.allAccounts.filter((account) => account.archived)} balances={balances} archived /></section> : null}</section>;
}
function Categories({ model }: { readonly model: FinanceModel }) {
  const [groupName, setGroupName] = useState(''); const [kind, setKind] = useState<CategoryGroupAggregate['kind']>('expense'); const [name, setName] = useState(''); const [group, setGroup] = useState(''); const [error, setError] = useState<string>();
  async function groupSubmit(e: FormEvent) { e.preventDefault(); setError(undefined); try { await model.addGroup(groupName, kind); setGroupName(''); } catch (reason) { setError(messageFor(reason, 'Die Gruppe wurde nicht gespeichert.')); } }
  async function categorySubmit(e: FormEvent) { e.preventDefault(); setError(undefined); try { await model.addCategory(name, group as UUID); setName(''); } catch (reason) { setError(messageFor(reason, 'Die Kategorie wurde nicht gespeichert.')); } }
  async function archive(id: UUID) { setError(undefined); try { await model.archiveCategory(id); } catch (reason) { setError(messageFor(reason, 'Die Kategorie wurde nicht archiviert.')); } }
  return <section><form className="inline-form" onSubmit={(e) => void groupSubmit(e)}><label>Neue Kategoriegruppe<input onChange={(e) => setGroupName(e.target.value)} required value={groupName} /></label><label>Art<select onChange={(e) => setKind(e.target.value as CategoryGroupAggregate['kind'])} value={kind}><option value="expense">Ausgaben</option><option value="income">Einnahmen</option></select></label><button type="submit">Gruppe anlegen</button></form><form className="inline-form" onSubmit={(e) => void categorySubmit(e)}><label>Kategorie<input onChange={(e) => setName(e.target.value)} required value={name} /></label><label>Gruppe<select onChange={(e) => setGroup(e.target.value)} required value={group}><option value="">Auswählen</option>{model.groups.filter((entry) => !entry.archived).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button type="submit">Kategorie anlegen</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}{model.categories.length === 0 ? <Empty title="Noch keine Kategorien" text="Kategorien gehören immer zu einer Einnahmen- oder Ausgabengruppe." /> : <><ul className="plain-list">{model.categories.map((category) => <li key={category.id}><span>{category.name}<small>{model.groups.find((entry) => entry.id === category.groupId)?.name}</small></span><button className="quiet small-action" onClick={() => void archive(category.id)} type="button">Archivieren</button></li>)}</ul><p className="help-text">Archivierte Kategorien bleiben an historischen Buchungen sichtbar, sind aber für neue Buchungen nicht auswählbar.</p></>}</section>;
}
function Payees({ model }: { readonly model: FinanceModel }) {
  const [name, setName] = useState(''); const [source, setSource] = useState(''); const [target, setTarget] = useState(''); const [error, setError] = useState<string>(); const [dialogOpen, setDialogOpen] = useState(false);
  const mergeDialog = useRef<HTMLDialogElement>(null);
  const mergeTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (dialogOpen) mergeDialog.current?.showModal(); }, [dialogOpen]);
  async function submit(e: FormEvent) { e.preventDefault(); setError(undefined); try { await model.addPayee(name); setName(''); } catch (reason) { setError(messageFor(reason, 'Der Empfänger wurde nicht gespeichert.')); } }
  function restoreMergeFocus() { setDialogOpen(false); queueMicrotask(() => mergeTrigger.current?.focus()); }
  function openMergeDialog(e: FormEvent) { e.preventDefault(); setError(undefined); setDialogOpen(true); }
  async function merge() {
    mergeDialog.current?.close();
    setError(undefined);
    try { await model.mergePayees(target as UUID, source as UUID); setSource(''); setTarget(''); }
    catch (reason) { setError(messageFor(reason, 'Die Empfänger wurden nicht zusammengeführt.')); }
  }
  return <section><form className="inline-form" onSubmit={(e) => void submit(e)}><label>Empfänger<input onChange={(e) => setName(e.target.value)} required value={name} /></label><button type="submit">Empfänger anlegen</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}{model.payees.length === 0 ? <Empty title="Noch keine Empfänger" text="Empfänger sind optional und können später beim Erfassen ergänzt werden." /> : <><ul className="plain-list">{model.payees.map((payee) => <li key={payee.id}>{payee.name}</li>)}</ul>{model.payees.length < 2 ? null : <form className="inline-form merge-form" onSubmit={openMergeDialog}><h2>Empfänger zusammenführen</h2><p>Alle lokalen Buchungen des Quell-Empfängers werden atomar dem Ziel zugeordnet. Der Quell-Empfänger bleibt archiviert erhalten.</p><label>Quell-Empfänger<select onChange={(e) => setSource(e.target.value)} required value={source}><option value="">Auswählen</option>{model.payees.map((payee) => <option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label><label>Ziel-Empfänger<select onChange={(e) => setTarget(e.target.value)} required value={target}><option value="">Auswählen</option>{model.payees.filter((payee) => payee.id !== source).map((payee) => <option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label><button ref={mergeTrigger} type="submit">Zusammenführen und archivieren</button></form>}{dialogOpen ? <dialog aria-labelledby="merge-confirmation-title" className="confirmation-dialog" onClose={restoreMergeFocus} ref={mergeDialog}><h2 id="merge-confirmation-title">Empfänger zusammenführen?</h2><p>Die lokalen Buchungsreferenzen werden atomar auf den Ziel-Empfänger übertragen. Der Quell-Empfänger bleibt archiviert erhalten.</p><form className="dialog-actions" method="dialog"><button type="submit">Abbrechen</button><button onClick={() => void merge()} type="button">Zusammenführen</button></form></dialog> : null}</>}</section>;
}
function AccountTable({ accounts, balances, onArchive, archived = false }: { readonly accounts: readonly AccountAggregate[]; readonly balances: readonly { readonly accountId: UUID; readonly balance: number }[]; readonly onArchive?: (id: UUID) => Promise<void>; readonly archived?: boolean }) { return <div className="table-wrap" role="region" aria-label={archived ? 'Archivierte Konten' : 'Kontoliste'} tabIndex={0}><table className="account-table"><thead><tr><th>Konto</th><th>Art</th><th className="money">Guthaben</th>{archived ? <th>Status</th> : null}{onArchive === undefined ? null : <th><span className="visually-hidden">Aktion</span></th>}</tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.type}</td><td className="money">{formatMoney(balances.find((balance) => balance.accountId === account.id)?.balance ?? 0)}</td>{archived ? <td>Archiviert</td> : null}{onArchive === undefined ? null : <td><button className="quiet small-action" onClick={() => void onArchive(account.id)} type="button">Archivieren</button></td>}</tr>)}</tbody></table></div>; }
function Empty({ title, text }: { readonly title: string; readonly text: string }) { return <section className="empty"><h2>{title}</h2><p>{text}</p></section>; }
function titleFor(view: View) { return ({ overview: 'Übersicht', accounts: 'Konten', categories: 'Kategorien', payees: 'Empfänger', transactions: 'Buchungen' })[view]; }
export function formatMoney(cents: number) { return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
function messageFor(reason: unknown, fallback: string) { return reason instanceof Error ? reason.message : fallback; }
