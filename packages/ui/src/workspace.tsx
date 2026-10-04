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

export function FinanceWorkspace({ context, storageForProfile, desktop = false }: { readonly context: UnlockedAppContext; readonly storageForProfile: WorkspaceStorageFactory; readonly desktop?: boolean }) {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(storedColorScheme);
  const changeColorScheme = (value: ColorScheme) => {
    setColorScheme(value);
    try { localStorage.setItem('wimm:color-scheme', value); } catch { /* Die Auswahl bleibt für diese Sitzung nutzbar. */ }
  };
  const [view, setView] = useState<View>('overview');
  const [aggregates, setAggregates] = useState<readonly StoredAggregate[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const storage = useMemo(() => storageForProfile(context.profile.profileId as UUID), [storageForProfile, context.profile.profileId]);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reload = useCallback(async () => {
    try { setState('loading'); setAggregates(await storage.query({ spaceId: context.activeArea.id as UUID })); setState('ready'); }
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

  const execute = useCallback(async (changeSet: DomainChangeSet) => {
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
      setAggregates((current) => {
        const changed = new Map(changeSet.aggregates.map((entry) => [entry.id, toStoredAggregate(entry)]));
        return [...current.filter((entry) => !changed.has(entry.id)), ...changed.values()];
      });
      setMessage('Lokal gespeichert.');
    } catch (error) {
      setMessage('Die Eingaben wurden nicht gespeichert.');
      if (error instanceof Error && /revision|stale/i.test(error.message)) {
        try { setAggregates(await storage.query({ spaceId: context.activeArea.id as UUID })); }
        catch { /* Der ursprüngliche Schreibfehler und der Entwurf bleiben erhalten. */ }
      }
      throw error;
    }
    finally { setSaving(false); }
  }, [storage, context.activeArea.id]);
  const model = useMemo(() => new FinanceModel(context.activeArea.id as UUID, aggregates, execute), [aggregates, context.activeArea.id, execute]);

  return <div className={`app-shell${desktop ? ' desktop-shell' : ''}`} data-color-scheme={colorScheme}>
    <aside className="sidebar"><p className="product">WhereIsMyMoney</p><AreaPicker context={context} disabled={saving} />
      <nav aria-label="Hauptnavigation">{([['overview', 'Übersicht'], ['transactions', 'Buchungen'], ['accounts', 'Konten'], ['categories', 'Kategorien'], ['payees', 'Empfänger']] as const).map(([id, label]) =>
        <button disabled={saving} aria-current={view === id ? 'page' : undefined} key={id} onClick={() => setView(id)} type="button">{label}</button>
      )}</nav><button disabled={saving} className="quiet" onClick={() => void context.createHousehold()} type="button">+ Haushalt anlegen</button><button className="quiet" onClick={() => void context.lock()} type="button">Tresor sperren</button>
      <label className="area-picker">Farbschema<select value={colorScheme} onChange={(event) => changeColorScheme(event.target.value as ColorScheme)}><option value="system">System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label>
    </aside>
    <main className="finance-main" key={context.activeArea.id}><header><div><p className="eyebrow">{context.activeArea.kind === 'private' ? 'Privatbereich' : 'Gemeinsamer Bereich'}</p><h1>{titleFor(view)}</h1></div><span aria-live="polite" className="local-status">{saving ? "Wird lokal gespeichert …" : "● Lokaler Stand"}</span></header>
      {message === undefined ? null : <p aria-live="polite" className="notice">{message}</p>}
      {state === 'loading' ? <p aria-live="polite">Lokale Daten werden geladen …</p> : null}
      {state === 'error' ? <p role="alert">Die Daten bleiben unverändert. Bitte entsperren Sie den Tresor erneut oder starten Sie die App neu.</p> : null}
      <fieldset className="workspace-content" disabled={saving}>
      {state === 'ready' && view === 'overview' ? <Overview model={model} onNew={() => setView('transactions')} /> : null}
      {state === 'ready' && view === 'accounts' ? <Accounts model={model} /> : null}
      {state === 'ready' && view === 'categories' ? <Categories model={model} /> : null}
      {state === 'ready' && view === 'payees' ? <Payees model={model} /> : null}
      {state === 'ready' && view === 'transactions' ? <Transactions model={model} /> : null}
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
  private readonly dependencies: DomainDependencies = { ids: { next: () => crypto.randomUUID() as UUID }, clock: { now: () => new Date().toISOString() as never } };
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
    const aggregate: AccountAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'account', name, type, onBudget, archived: false };
    await this.execute(saveAccount({ commandType: 'account.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.dependencies));
  }
  async addGroup(name: string, kind: CategoryGroupAggregate['kind']) {
    const aggregate: CategoryGroupAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'categoryGroup', name, kind, sortOrder: this.groups.length, archived: false };
    await this.execute(saveCategoryGroup({ commandType: 'categoryGroup.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.dependencies));
  }
  async addCategory(name: string, groupId: UUID) {
    const group = this.groups.find((entry) => entry.id === groupId); if (group === undefined) throw new TypeError('Bitte zuerst eine Kategoriegruppe anlegen.');
    const aggregate: CategoryAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'category', groupId, name, sortOrder: this.categories.filter((entry) => entry.groupId === groupId).length, archived: false };
    await this.execute(saveCategory({ commandType: 'category.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }, { id: group.id, expectedRevision: group.revision }], mutations: [{ aggregate }] }, this, this.dependencies));
  }
  async addPayee(name: string) {
    const aggregate: PayeeAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'payee', name, aliases: [], archived: false };
    await this.execute(savePayee({ commandType: 'payee.save', spaceId: this.spaceId, expectedRevisions: [{ id: aggregate.id, expectedRevision: 0 }], mutations: [{ aggregate }] }, this, this.dependencies));
  }
  async archiveAccount(id: UUID) {
    const account = this.accounts.find((entry) => entry.id === id);
    if (account === undefined) throw new TypeError('Dieses Konto ist nicht mehr aktiv.');
    const archived = reviseAggregate({ ...account, archived: true }, this.dependencies);
    await this.execute(archiveAccount({
      commandType: 'account.archive',
      spaceId: this.spaceId,
      expectedRevisions: [{ id: account.id, expectedRevision: account.revision }],
      mutations: [{ aggregate: archived }]
    }, this, this.dependencies));
  }
  async archiveCategory(id: UUID) {
    const category = this.categories.find((entry) => entry.id === id);
    if (category === undefined) throw new TypeError('Diese Kategorie ist nicht mehr aktiv.');
    const group = this.groups.find((entry) => entry.id === category.groupId);
    if (group === undefined) throw new TypeError('Die Kategoriegruppe ist nicht mehr verfügbar.');
    const archived = reviseAggregate({ ...category, archived: true }, this.dependencies);
    await this.execute(archiveCategory({
      commandType: 'category.archive',
      spaceId: this.spaceId,
      expectedRevisions: [
        { id: category.id, expectedRevision: category.revision },
        { id: group.id, expectedRevision: group.revision }
      ],
      mutations: [{ aggregate: archived }]
    }, this, this.dependencies));
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
    }, this, this.dependencies));
  }
  async storeTransaction(input: TransactionInput, previous?: TransactionAggregate) {
    const amount = parseMoney(input.amount, 'Der Betrag');
    const splits = input.opening ? [] : input.splits.map((split, index) => ({
      id: split.id ?? this.dependencies.ids.next(), categoryId: split.categoryId,
      amount: parseMoney(split.amount, `Der Splitbetrag ${index + 1}`)
    }));
    // Die geöffnete Revision bleibt erhalten, auch wenn sich der Listenstand ändert.
    const metadata = previous === undefined ? createAggregateMetadata(this.spaceId, this.dependencies) : reviseAggregate(previous, this.dependencies);
    const { payeeId: _oldPayee, note: _oldNote, ...base } = metadata as TransactionAggregate;
    const aggregate: TransactionAggregate = {
      ...base, aggregateType: 'transaction', accountId: input.accountId, date: parseFinanceDate(input.date), amount,
      kind: input.opening ? 'opening' : 'normal', clearance: previous?.clearance ?? 'uncleared',
      ...(input.payeeId === undefined ? {} : { payeeId: input.payeeId }),
      ...(input.note.trim() === '' ? {} : { note: input.note.trim() }), splits
    };
    await this.execute(saveTransaction({ commandType: 'transaction.save', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(aggregate, previous?.revision ?? 0), mutations: [{ aggregate }] }, this, this.dependencies));
  }
  async removeTransaction(transaction: TransactionAggregate) {
    await this.execute(deleteTransaction({ commandType: 'transaction.delete', spaceId: this.spaceId,
      expectedRevisions: this.transactionRevisions(transaction, transaction.revision), mutations: [{ aggregate: transaction }] }, this, this.dependencies));
  }
  private transactionRevisions(transaction: TransactionAggregate, revision: number) {
    return [{ id: transaction.id, expectedRevision: revision },
      ...[...new Set([transaction.accountId, ...transaction.splits.map((split) => split.categoryId), ...(transaction.payeeId === undefined ? [] : [transaction.payeeId])])]
        .map((id) => { const head = this.heads.get(id); if (head === undefined) throw new TypeError('Eine Buchungsreferenz ist nicht mehr verfügbar.'); return { id, expectedRevision: head.revision }; })];
  }
  async addTransfer(sourceAccountId: UUID, targetAccountId: UUID, value: string, date: string) {
    const amount = parseMoney(value, 'Der Umbuchungsbetrag');
    const sourceAccount = this.accounts.find((account) => account.id === sourceAccountId); const targetAccount = this.accounts.find((account) => account.id === targetAccountId);
    if (sourceAccount === undefined || targetAccount === undefined) throw new TypeError('Quell- und Zielkonto müssen ausgewählt werden.');
    const transfer: TransferAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'transfer', date: date as never, sourceAccountId, targetAccountId, sourceTransactionId: this.dependencies.ids.next(), targetTransactionId: this.dependencies.ids.next(), amount };
    const source: TransactionAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), id: transfer.sourceTransactionId, aggregateType: 'transaction', accountId: sourceAccountId, date: transfer.date, amount: subtractMoney(0 as never, amount), kind: 'transfer', clearance: 'uncleared', transferId: transfer.id, splits: [] };
    const target: TransactionAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), id: transfer.targetTransactionId, aggregateType: 'transaction', accountId: targetAccountId, date: transfer.date, amount, kind: 'transfer', clearance: 'uncleared', transferId: transfer.id, splits: [] };
    await this.execute(saveTransfer({ spaceId: this.spaceId, transfer, source, target, sourceAccount, targetAccount }, this, this.dependencies));
  }
  async reconcile(accountId: UUID, value: string, date: string) {
    const transactions = this.transactions.filter((transaction) => transaction.accountId === accountId && transaction.clearance !== 'reconciled');
    const reconciliation: ReconciliationAggregate = { ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'reconciliation', accountId, statementDate: date as never, statementBalance: parseMoney(value, 'Der Auszugssaldo'), transactionIds: transactions.map((transaction) => transaction.id) };
    const result = confirmReconciliation({ spaceId: this.spaceId, reconciliation, transactions }, this, this.dependencies);
    await this.execute(result.changeSet);
    return result.difference;
  }
  get(id: UUID) { const aggregate = this.heads.get(id); return aggregate === undefined ? undefined : { id: aggregate.id, spaceId: aggregate.spaceId, revision: aggregate.revision, aggregateType: aggregate.aggregateType }; }
}

function AreaPicker({ context, disabled = false }: { readonly context: UnlockedAppContext; readonly disabled?: boolean }) { return <label className="area-picker">Bereich<select disabled={disabled} onChange={(event) => context.selectArea(event.target.value)} value={context.activeArea.id}>{context.profile.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>; }
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
function TransferForm({ model }: { readonly model: FinanceModel }) { const [source, setSource] = useState(''); const [target, setTarget] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [error, setError] = useState<string>(); async function submit(event: FormEvent) { event.preventDefault(); setError(undefined); try { await model.addTransfer(source as UUID, target as UUID, amount, date); setAmount(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Umbuchung wurde nicht gespeichert.'); } } return <section className="transfer"><h2>Umbuchung</h2><p>Quell- und Zielseite werden gemeinsam gespeichert oder gar nicht.</p><form className="inline-form" onSubmit={(event) => void submit(event)}><label>Von<select onChange={(event) => setSource(event.target.value)} required value={source}><option value="">Auswählen</option>{model.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Nach<select onChange={(event) => setTarget(event.target.value)} required value={target}><option value="">Auswählen</option>{model.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Betrag<input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} required value={amount} /></label><label>Datum<input onChange={(event) => setDate(event.target.value)} required type="date" value={date} /></label><button type="submit">Umbuchung speichern</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}</section>; }
function ReconciliationForm({ model }: { readonly model: FinanceModel }) { const [account, setAccount] = useState(''); const [balance, setBalance] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [result, setResult] = useState<string>(); async function submit(event: FormEvent) { event.preventDefault(); try { const difference = await model.reconcile(account as UUID, balance, date); setResult(`Abgleich gespeichert. Differenz: ${formatMoney(difference)}`); } catch (reason) { setResult(reason instanceof Error ? reason.message : 'Der Abgleich wurde nicht gespeichert.'); } } return <section className="transfer"><h2>Abgleich</h2><p>Die Differenz wird vor einer Korrekturbuchung ausdrücklich angezeigt; diese Oberfläche erzeugt keine Korrekturbuchung.</p><form className="inline-form" onSubmit={(event) => void submit(event)}><label>Konto<select onChange={(event) => setAccount(event.target.value)} required value={account}><option value="">Auswählen</option>{model.accounts.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>Auszugssaldo<input inputMode="decimal" onChange={(event) => setBalance(event.target.value)} required value={balance} /></label><label>Auszugsdatum<input onChange={(event) => setDate(event.target.value)} required type="date" value={date} /></label><button type="submit">Abgleich bestätigen</button></form>{result === undefined ? null : <p aria-live="polite">{result}</p>}</section>; }
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
