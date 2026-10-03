// SPDX-License-Identifier: AGPL-3.0-or-later
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import type { UUID } from '@wimm/contracts';
import {
  createAggregateMetadata,
  projectAccountBalances,
  parseMoney,
  subtractMoney,
  saveTransfer,
  saveTransaction,
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
} from '@wimm/domain';
import { IndexedDbStorageAdapter, LocalAreaService, type StoredAggregate } from '@wimm/storage';

import type { UnlockedAppContext } from './app.js';

type View = 'overview' | 'accounts' | 'categories' | 'payees' | 'transactions';

export function FinanceWorkspace({ context, desktop = false }: { readonly context: UnlockedAppContext; readonly desktop?: boolean }) {
  const [view, setView] = useState<View>('overview');
  const [aggregates, setAggregates] = useState<readonly StoredAggregate[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState<string>();
  const adapter = useMemo(() => new IndexedDbStorageAdapter(context.profile.profileId as UUID, `wimm-ui-${context.profile.profileId}`), [context.profile.profileId]);
  const reload = useCallback(async () => {
    try { setState('loading'); setAggregates(await adapter.query({ spaceId: context.activeArea.id as UUID })); setState('ready'); }
    catch { setMessage('Die lokalen Daten konnten nicht gelesen werden.'); setState('error'); }
  }, [adapter, context.activeArea.id]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => () => { void adapter.close(); }, [adapter]);

  const execute = useCallback(async (changeSet: DomainChangeSet) => {
    try {
      await new LocalAreaService(adapter, context.activeArea.id as UUID, { connected: false }).applyChangeSet(changeSet);
      await reload(); setMessage('Lokal gespeichert.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Die Eingaben wurden nicht gespeichert.'); throw error; }
  }, [adapter, context.activeArea.id, reload]);
  const model = useMemo(() => new FinanceModel(context.activeArea.id as UUID, aggregates, execute), [aggregates, context.activeArea.id, execute]);

  return <div className={`app-shell${desktop ? ' desktop-shell' : ''}`}>
    <aside className="sidebar"><p className="product">WhereIsMyMoney</p><AreaPicker context={context} />
      <nav aria-label="Hauptnavigation">{([['overview', 'Übersicht'], ['transactions', 'Buchungen'], ['accounts', 'Konten'], ['categories', 'Kategorien'], ['payees', 'Empfänger']] as const).map(([id, label]) =>
        <button aria-current={view === id ? 'page' : undefined} key={id} onClick={() => setView(id)} type="button">{label}</button>
      )}</nav><button className="quiet" onClick={() => void context.createHousehold()} type="button">+ Haushalt anlegen</button><button className="quiet" onClick={() => void context.lock()} type="button">Tresor sperren</button>
    </aside>
    <main className="finance-main"><header><div><p className="eyebrow">{context.activeArea.kind === 'private' ? 'Privatbereich' : 'Gemeinsamer Bereich'}</p><h1>{titleFor(view)}</h1></div><span className="local-status">● Lokal gespeichert</span></header>
      {message === undefined ? null : <p aria-live="polite" className="notice">{message}</p>}
      {state === 'loading' ? <p aria-live="polite">Lokale Daten werden geladen …</p> : null}
      {state === 'error' ? <p role="alert">Die Daten bleiben unverändert. Bitte entsperren Sie den Tresor erneut oder starten Sie die App neu.</p> : null}
      {state === 'ready' && view === 'overview' ? <Overview model={model} onNew={() => setView('transactions')} /> : null}
      {state === 'ready' && view === 'accounts' ? <Accounts model={model} /> : null}
      {state === 'ready' && view === 'categories' ? <Categories model={model} /> : null}
      {state === 'ready' && view === 'payees' ? <Payees model={model} /> : null}
      {state === 'ready' && view === 'transactions' ? <Transactions model={model} /> : null}
    </main>
  </div>;
}

class FinanceModel {
  readonly accounts: readonly AccountAggregate[];
  readonly categories: readonly CategoryAggregate[];
  readonly groups: readonly CategoryGroupAggregate[];
  readonly payees: readonly PayeeAggregate[];
  readonly transactions: readonly TransactionAggregate[];
  private readonly heads = new Map<UUID, P2Aggregate>();
  private readonly dependencies: DomainDependencies = { ids: { next: () => crypto.randomUUID() as UUID }, clock: { now: () => new Date().toISOString() as never } };
  constructor(private readonly spaceId: UUID, aggregates: readonly StoredAggregate[], private readonly execute: (changeSet: DomainChangeSet) => Promise<void>) {
    aggregates.forEach((aggregate) => this.heads.set(aggregate.id, aggregate));
    this.accounts = aggregates.filter((aggregate): aggregate is StoredAggregate & AccountAggregate => aggregate.aggregateType === 'account' && aggregate.deletedAt === undefined);
    this.categories = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryAggregate => aggregate.aggregateType === 'category' && aggregate.deletedAt === undefined);
    this.groups = aggregates.filter((aggregate): aggregate is StoredAggregate & CategoryGroupAggregate => aggregate.aggregateType === 'categoryGroup' && aggregate.deletedAt === undefined);
    this.payees = aggregates.filter((aggregate): aggregate is StoredAggregate & PayeeAggregate => aggregate.aggregateType === 'payee' && aggregate.deletedAt === undefined);
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
  async addTransaction(input: { readonly accountId: UUID; readonly categoryId?: UUID; readonly secondCategoryId?: UUID; readonly firstSplitAmount?: string; readonly payeeId?: UUID; readonly amount: string; readonly date: string; readonly note: string; readonly opening: boolean }) {
    const amount = parseMoney(input.amount, 'Der Betrag');
    const first = input.firstSplitAmount === undefined ? amount : parseMoney(input.firstSplitAmount, 'Der erste Splitbetrag');
    const splits = input.opening ? [] : input.secondCategoryId === undefined ? [{ id: this.dependencies.ids.next(), categoryId: input.categoryId!, amount }] : [{ id: this.dependencies.ids.next(), categoryId: input.categoryId!, amount: first }, { id: this.dependencies.ids.next(), categoryId: input.secondCategoryId, amount: subtractMoney(amount, first, 'Der zweite Splitbetrag') }];
    const aggregate: TransactionAggregate = {
      ...createAggregateMetadata(this.spaceId, this.dependencies), aggregateType: 'transaction', accountId: input.accountId, date: input.date as never, amount,
      kind: input.opening ? 'opening' : 'normal', clearance: 'uncleared',
      ...(input.payeeId === undefined ? {} : { payeeId: input.payeeId }), ...(input.note.trim() === '' ? {} : { note: input.note.trim() }),
      splits
    };
    const expected = [{ id: aggregate.id, expectedRevision: 0 }, { id: input.accountId, expectedRevision: this.heads.get(input.accountId)!.revision }, ...[...new Set(splits.map((split) => split.categoryId))].map((id) => ({ id, expectedRevision: this.heads.get(id)!.revision })), ...(input.payeeId === undefined ? [] : [{ id: input.payeeId, expectedRevision: this.heads.get(input.payeeId)!.revision }])];
    await this.execute(saveTransaction({ commandType: 'transaction.save', spaceId: this.spaceId, expectedRevisions: expected, mutations: [{ aggregate }] }, this, this.dependencies));
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
  get(id: UUID) { const aggregate = this.heads.get(id); return aggregate === undefined ? undefined : { id: aggregate.id, spaceId: aggregate.spaceId, revision: aggregate.revision, aggregateType: aggregate.aggregateType }; }
}

function AreaPicker({ context }: { readonly context: UnlockedAppContext }) { return <label className="area-picker">Bereich<select onChange={(event) => context.selectArea(event.target.value)} value={context.activeArea.id}>{context.profile.areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>; }
function Overview({ model, onNew }: { readonly model: FinanceModel; readonly onNew: () => void }) { const balances = projectAccountBalances(model.transactions); const total = balances.reduce((sum, item) => sum + item.balance, 0); return <section><div className="overview-grid"><article><p>Verfügbares Geld</p><strong>{formatMoney(total)}</strong></article><article><p>Monatsausgaben</p><strong>{formatMoney(0)}</strong></article><article><p>Ausstehende Änderungen</p><strong>Keine</strong></article></div>{model.accounts.length === 0 ? <Empty title="Noch keine Konten" text="Legen Sie zuerst ein Konto mit Anfangsbestand an. Erfundenes Guthaben zeigt die Übersicht nicht." /> : <AccountTable accounts={model.accounts} balances={balances} />}<button onClick={onNew} type="button">Neue Buchung</button></section>; }
function Accounts({ model }: { readonly model: FinanceModel }) { const [name, setName] = useState(''); const [type, setType] = useState<AccountAggregate['type']>('checking'); const [budget, setBudget] = useState(true); async function submit(event: FormEvent) { event.preventDefault(); await model.addAccount(name, type, budget); setName(''); } return <section><form className="inline-form" onSubmit={(event) => void submit(event)}><label>Kontoname<input onChange={(event) => setName(event.target.value)} required value={name} /></label><label>Art<select onChange={(event) => setType(event.target.value as AccountAggregate['type'])} value={type}><option value="checking">Girokonto</option><option value="cash">Bargeld</option><option value="savings">Sparkonto</option><option value="credit">Kreditkarte</option><option value="other">Sonstiges</option></select></label><label><input checked={budget} onChange={(event) => setBudget(event.target.checked)} type="checkbox" /> Im Budget</label><button type="submit">Konto anlegen</button></form>{model.accounts.length === 0 ? <Empty title="Noch keine Konten" text="Der Anfangsbestand wird bei der ersten Buchung erfasst." /> : <><AccountTable accounts={model.accounts} balances={projectAccountBalances(model.transactions)} /><TransferForm model={model} /></>}</section>; }
function TransferForm({ model }: { readonly model: FinanceModel }) { const [source, setSource] = useState(''); const [target, setTarget] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [error, setError] = useState<string>(); async function submit(event: FormEvent) { event.preventDefault(); setError(undefined); try { await model.addTransfer(source as UUID, target as UUID, amount, date); setAmount(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Umbuchung wurde nicht gespeichert.'); } } return <section className="transfer"><h2>Umbuchung</h2><p>Quell- und Zielseite werden gemeinsam gespeichert oder gar nicht.</p><form className="inline-form" onSubmit={(event) => void submit(event)}><label>Von<select onChange={(event) => setSource(event.target.value)} required value={source}><option value="">Auswählen</option>{model.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Nach<select onChange={(event) => setTarget(event.target.value)} required value={target}><option value="">Auswählen</option>{model.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Betrag<input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} required value={amount} /></label><label>Datum<input onChange={(event) => setDate(event.target.value)} required type="date" value={date} /></label><button type="submit">Umbuchung speichern</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}</section>; }
function Categories({ model }: { readonly model: FinanceModel }) { const [groupName, setGroupName] = useState(''); const [kind, setKind] = useState<CategoryGroupAggregate['kind']>('expense'); const [name, setName] = useState(''); const [group, setGroup] = useState(''); async function groupSubmit(e: FormEvent) { e.preventDefault(); await model.addGroup(groupName, kind); setGroupName(''); } async function categorySubmit(e: FormEvent) { e.preventDefault(); await model.addCategory(name, group as UUID); setName(''); } return <section><form className="inline-form" onSubmit={(e) => void groupSubmit(e)}><label>Neue Kategoriegruppe<input onChange={(e) => setGroupName(e.target.value)} required value={groupName} /></label><label>Art<select onChange={(e) => setKind(e.target.value as CategoryGroupAggregate['kind'])} value={kind}><option value="expense">Ausgaben</option><option value="income">Einnahmen</option></select></label><button type="submit">Gruppe anlegen</button></form><form className="inline-form" onSubmit={(e) => void categorySubmit(e)}><label>Kategorie<input onChange={(e) => setName(e.target.value)} required value={name} /></label><label>Gruppe<select onChange={(e) => setGroup(e.target.value)} required value={group}><option value="">Auswählen</option>{model.groups.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><button type="submit">Kategorie anlegen</button></form>{model.categories.length === 0 ? <Empty title="Noch keine Kategorien" text="Kategorien gehören immer zu einer Einnahmen- oder Ausgabengruppe." /> : <ul className="plain-list">{model.categories.map((category) => <li key={category.id}>{category.name}<span>{model.groups.find((group) => group.id === category.groupId)?.name}</span></li>)}</ul>}</section>; }
function Payees({ model }: { readonly model: FinanceModel }) { const [name, setName] = useState(''); async function submit(e: FormEvent) { e.preventDefault(); await model.addPayee(name); setName(''); } return <section><form className="inline-form" onSubmit={(e) => void submit(e)}><label>Empfänger<input onChange={(e) => setName(e.target.value)} required value={name} /></label><button type="submit">Empfänger anlegen</button></form>{model.payees.length === 0 ? <Empty title="Noch keine Empfänger" text="Empfänger sind optional und können später beim Erfassen ergänzt werden." /> : <ul className="plain-list">{model.payees.map((payee) => <li key={payee.id}>{payee.name}</li>)}</ul>}</section>; }
function Transactions({ model }: { readonly model: FinanceModel }) {
  const [accountId, setAccountId] = useState(''); const [categoryId, setCategoryId] = useState(''); const [secondCategoryId, setSecondCategoryId] = useState(''); const [splitAmount, setSplitAmount] = useState(''); const [payeeId, setPayeeId] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); const [note, setNote] = useState(''); const [opening, setOpening] = useState(false); const [error, setError] = useState<string>();
  async function submit(event: FormEvent) { event.preventDefault(); setError(undefined); try { await model.addTransaction({ accountId: accountId as UUID, ...(opening ? {} : { categoryId: categoryId as UUID }), ...(secondCategoryId === '' ? {} : { secondCategoryId: secondCategoryId as UUID, firstSplitAmount: splitAmount }), ...(payeeId === '' ? {} : { payeeId: payeeId as UUID }), amount, date, note, opening }); setAmount(''); setNote(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Die Buchung konnte nicht gespeichert werden.'); } }
  if (model.accounts.length === 0) return <Empty title="Noch kein Konto" text="Legen Sie zuerst ein Konto an. Dann können Sie auch dessen Anfangsbestand erfassen." />;
  if (model.categories.length === 0 && !opening) return <section><p>Für normale Buchungen wird eine Kategorie benötigt.</p><label><input checked={opening} onChange={(e) => setOpening(e.target.checked)} type="checkbox" /> Anfangsbestand erfassen</label></section>;
  return <section><form className="transaction-form" onSubmit={(event) => void submit(event)}><label className="amount-field">Betrag<input inputMode="decimal" onChange={(e) => setAmount(e.target.value)} placeholder="z. B. -12,50" required value={amount} /></label><label>Datum<input onChange={(e) => setDate(e.target.value)} required type="date" value={date} /></label><label>Konto<select onChange={(e) => setAccountId(e.target.value)} required value={accountId}><option value="">Auswählen</option>{model.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><input checked={opening} onChange={(e) => setOpening(e.target.checked)} type="checkbox" /> Anfangsbestand</label>{opening ? null : <><label>Kategorie<select onChange={(e) => setCategoryId(e.target.value)} required value={categoryId}><option value="">Auswählen</option>{model.categories.filter((category) => !category.archived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Split-Kategorie (optional)<select onChange={(e) => setSecondCategoryId(e.target.value)} value={secondCategoryId}><option value="">Kein Split</option>{model.categories.filter((category) => !category.archived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>{secondCategoryId === '' ? null : <label>Erster Splitbetrag<input inputMode="decimal" onChange={(e) => setSplitAmount(e.target.value)} required value={splitAmount} /></label>}</>}<label>Empfänger<select onChange={(e) => setPayeeId(e.target.value)} value={payeeId}><option value="">Ohne Empfänger</option>{model.payees.map((payee) => <option key={payee.id} value={payee.id}>{payee.name}</option>)}</select></label><label>Notiz<input onChange={(e) => setNote(e.target.value)} value={note} /></label><button type="submit">Lokal speichern</button></form>{error === undefined ? null : <p className="field-error" role="alert">{error}</p>}<TransactionList model={model} /></section>;
}
function TransactionList({ model }: { readonly model: FinanceModel }) { const [filter, setFilter] = useState(''); const visible = model.transactions.filter((transaction) => `${transaction.note ?? ''} ${model.payees.find((payee) => payee.id === transaction.payeeId)?.name ?? ''}`.toLocaleLowerCase('de').includes(filter.toLocaleLowerCase('de'))).sort((left, right) => right.date.localeCompare(left.date)); return <section><label>Durchsuchen<input onChange={(event) => setFilter(event.target.value)} placeholder="Empfänger oder Notiz" value={filter} /></label>{visible.length === 0 ? <Empty title="Noch keine Buchungen" text="Ihre Buchungen werden lokal gespeichert und bleiben offline verfügbar." /> : <div className="table-wrap"><table><thead><tr><th>Datum</th><th>Empfänger</th><th>Konto</th><th className="money">Betrag</th></tr></thead><tbody>{visible.slice(0, 200).map((transaction) => <tr key={transaction.id}><td>{transaction.date}</td><td>{model.payees.find((payee) => payee.id === transaction.payeeId)?.name ?? transaction.note ?? '—'}</td><td>{model.accounts.find((account) => account.id === transaction.accountId)?.name}</td><td className="money">{formatMoney(transaction.amount)}</td></tr>)}</tbody></table>{visible.length > 200 ? <p>Es werden die ersten 200 Treffer angezeigt. Bitte verfeinern Sie die Suche.</p> : null}</div>}</section>; }
function AccountTable({ accounts, balances }: { readonly accounts: readonly AccountAggregate[]; readonly balances: readonly { readonly accountId: UUID; readonly balance: number }[] }) { return <div className="table-wrap"><table><thead><tr><th>Konto</th><th>Art</th><th className="money">Guthaben</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.type}</td><td className="money">{formatMoney(balances.find((balance) => balance.accountId === account.id)?.balance ?? 0)}</td></tr>)}</tbody></table></div>; }
function Empty({ title, text }: { readonly title: string; readonly text: string }) { return <section className="empty"><h2>{title}</h2><p>{text}</p></section>; }
function titleFor(view: View) { return ({ overview: 'Übersicht', accounts: 'Konten', categories: 'Kategorien', payees: 'Empfänger', transactions: 'Buchungen' })[view]; }
export function formatMoney(cents: number) { return new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' }).format(cents / 100); }
