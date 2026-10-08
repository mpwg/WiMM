// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IdSourcePort } from '@wimm/contracts';
import { addIndependentSpaceKey, createUserVault, initializeCrypto, lockUserVault, reencryptUserVault, unlockUserVaultWithPassphrase, unlockUserVaultWithRecoveryCode, type UnlockedUserVault } from '@wimm/crypto';
import { assertVaultAreas, changeLocalProfile, initialAreaLabel, upgradeLocalProfileKdf, type LocalProfile } from './profile.js';
import { ProfileConflictError, ProfileCoordinationError, ProfileLoadError, type ProfileStore, type ProfileLoadResult } from './profile-store.js';
import { ApplicationActivity } from './activity.js';
export type ProfileScreen = { readonly kind: 'loading' } | { readonly kind: 'profile-error'; readonly error: ProfileLoadError } | { readonly kind: 'create'; readonly recoveryCode?: string; readonly vault?: UnlockedUserVault } | { readonly kind: 'unlock'; readonly profile: LocalProfile } | { readonly kind: 'unlocked'; readonly profile: LocalProfile; readonly vault: UnlockedUserVault };
export interface ProfileApplicationState { readonly screen: ProfileScreen; readonly notice: string | undefined; readonly busy: boolean; readonly changing: boolean }
function loadedScreen(result: ProfileLoadResult): ProfileScreen {
  return result.kind === 'missing' ? { kind: 'create' } : result.kind === 'loaded' ? { kind: 'unlock', profile: result.profile } : { kind: 'profile-error', error: new ProfileLoadError(result.kind) };
}
export class ProfileApplication {
  private value: ProfileApplicationState = { screen: { kind: 'loading' }, notice: undefined, busy: false, changing: false };
  private generation = 0;
  private active = true;
  private initialization: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();
  constructor(readonly store: ProfileStore, private readonly ids: IdSourcePort, readonly activity: ApplicationActivity) {}
  getSnapshot = (): ProfileApplicationState => this.value;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  isChanging = () => this.activity.profileBusy;
  private publish(update: Partial<ProfileApplicationState>) { this.value = { ...this.value, ...update }; for (const listener of this.listeners) listener(); }
  clearNotice() { this.publish({ notice: undefined }); }
  notice(message: string) { this.publish({ notice: message }); }
  start(): Promise<void> {
    this.active = true;
    if (this.initialization !== undefined) return this.initialization;
    const generation = this.generation;
    this.initialization = initializeCrypto().then(() => this.store.load()).then((result) => { if (this.active && generation === this.generation) this.publish({ screen: loadedScreen(result) }); }).catch(() => { if (this.active && generation === this.generation) this.publish({ notice: 'Die Client-Kryptografie oder das lokale Profil konnten nicht vorbereitet werden.' }); });
    return this.initialization;
  }
  async prepare(passphrase: string): Promise<void> {
    if (this.value.busy || this.value.screen.kind !== 'create') return;
    const generation = this.generation;
    this.publish({ busy: true, notice: undefined });
    let session: UnlockedUserVault | undefined;
    try {
      const created = await createUserVault(passphrase);
      session = await addIndependentSpaceKey(await unlockUserVaultWithPassphrase(created.record, passphrase), this.ids.next());
      if (!this.active || generation !== this.generation) { await lockUserVault(session); return; }
      this.publish({ screen: { kind: 'create', recoveryCode: created.recoveryCode, vault: session } });
    } catch { if (this.active && generation === this.generation) this.publish({ notice: 'Der Tresor konnte nicht angelegt werden. Die Eingaben wurden nicht gespeichert.' }); }
    finally { if (this.active && generation === this.generation) this.publish({ busy: false }); }
  }
  async confirmRecovery(passphrase: string, confirmed: boolean): Promise<void> {
    const screen = this.value.screen;
    if (!confirmed || screen.kind !== 'create' || screen.vault === undefined || screen.recoveryCode === undefined || this.value.busy) return;
    const generation = this.generation;
    this.publish({ busy: true, notice: undefined });
    try {
      const area = screen.vault.spaces[0];
      if (area === undefined) throw new Error('Bereich fehlt');
      const vault = await reencryptUserVault(screen.vault, passphrase, screen.recoveryCode);
      const profile: LocalProfile = { revision: 0, profileId: this.ids.next(), areas: [{ id: area.spaceId, kind: 'private', label: initialAreaLabel }], selectedAreaId: area.spaceId, vault };
      const saved = await this.store.change(async (current) => {
        if (current !== undefined || !this.active || generation !== this.generation) throw new ProfileConflictError();
        return profile;
      });
      await lockUserVault(screen.vault);
      if (this.active && generation === this.generation) this.publish({ screen: { kind: 'unlock', profile: saved } });
    } catch (error) { if (this.active && generation === this.generation) this.publish({ notice: error instanceof ProfileCoordinationError || error instanceof ProfileConflictError ? error.message : 'Der Tresor konnte nicht dauerhaft vorbereitet werden.' }); }
    finally { if (this.active && generation === this.generation) this.publish({ busy: false }); }
  }
  async unlock(secret: string, recovery: boolean): Promise<void> {
    const screen = this.value.screen;
    if (screen.kind !== 'unlock' || this.value.busy) return;
    const generation = this.generation;
    const isCurrent = () => this.active && generation === this.generation;
    this.publish({ busy: true, notice: undefined });
    let session: UnlockedUserVault | undefined; let migrating = false;
    try {
      session = recovery ? await unlockUserVaultWithRecoveryCode(screen.profile.vault, secret) : await unlockUserVaultWithPassphrase(screen.profile.vault, secret);
      await assertVaultAreas(screen.profile, session);
      if (!isCurrent()) throw new ProfileConflictError();
      let profile = screen.profile;
      if (!recovery && profile.vault.passphraseWrap.version === undefined) {
        migrating = true; profile = await upgradeLocalProfileKdf(this.store, profile, session, secret, isCurrent);
      }
      if (!isCurrent()) throw new ProfileConflictError();
      this.publish({ screen: { kind: 'unlocked', profile, vault: session } });
    } catch (error) {
      if (session !== undefined) await lockUserVault(session);
      if (this.active && generation === this.generation) this.publish({ notice: error instanceof ProfileLoadError || error instanceof ProfileConflictError ? error.message : migrating ? 'Die Tresorhärtung konnte nicht gespeichert werden. Das Originalprofil bleibt erhalten. Bitte prüfen Sie den Speicherzugriff und versuchen Sie es erneut.' : 'Der Tresor konnte nicht entsperrt werden. Passphrase oder Rettungscode prüfen.' });
    } finally { if (this.active && generation === this.generation) this.publish({ busy: false }); }
  }
  async changeArea(areaId?: string): Promise<void> {
    const screen = this.value.screen;
    if (screen.kind !== 'unlocked' || this.value.changing) return;
    let release: (() => void) | undefined;
    const generation = this.generation;
    try {
      release = this.activity.beginProfile();
      this.publish({ changing: true, notice: undefined });
      const created = await changeLocalProfile(this.store, screen.profile, screen.vault, areaId, () => this.active && this.generation === generation, this.ids);
      await lockUserVault(screen.vault);
      if (!this.active || this.generation !== generation) { await lockUserVault(created.vault); return; }
      this.publish({ screen: { kind: 'unlocked', ...created } });
    } catch (error) { if (this.active && this.generation === generation) this.publish({ notice: error instanceof ProfileConflictError || error instanceof ProfileCoordinationError ? error.message : 'Die Profiländerung konnte nicht dauerhaft gespeichert werden. Der bestehende Bereich bleibt unverändert.' }); }
    finally { release?.(); if (this.active) this.publish({ changing: this.activity.profileBusy }); }
  }
  async lock(): Promise<void> {
    const screen = this.value.screen;
    if (screen.kind !== 'unlocked') return;
    let release: (() => void) | undefined;
    try { if (this.activity.financeBusy) throw new Error('Finanzwrite läuft'); if (!this.activity.profileBusy) release = this.activity.beginProfile(); }
    catch { this.notice('Bitte warten Sie auf die laufende Speicherung oder den Bereichswechsel.'); return; }
    this.generation += 1; const generation = this.generation;
    this.publish({ screen: { kind: 'loading' }, changing: true, notice: undefined });
    try {
      await lockUserVault(screen.vault);
      const result = await this.store.load();
      if (this.active && generation === this.generation) this.publish({ screen: loadedScreen(result) });
    } catch { if (this.active && generation === this.generation) this.publish({ screen: { kind: 'profile-error', error: new ProfileLoadError('unreadable') } }); }
    finally { release?.(); if (this.active) this.publish({ changing: this.activity.profileBusy }); }
  }
  dispose(): void {
    this.active = false; this.generation += 1; this.initialization = undefined;
    const screen = this.value.screen;
    this.value = { screen: { kind: 'loading' }, notice: undefined, busy: false, changing: false };
    this.listeners.clear();
    if (screen.kind === 'unlocked' || (screen.kind === 'create' && screen.vault !== undefined)) void lockUserVault(screen.vault!);
  }
}
