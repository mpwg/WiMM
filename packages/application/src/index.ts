// SPDX-License-Identifier: AGPL-3.0-or-later
export * from './finance-model.js';
export * from './history.js';
export * from './automation-model.js';
export * from './finance-application.js';
export * from './profile.js';
export * from './profile-store.js';
export * from './activity.js';
export * from './profile-application.js';

import type { DomainDependencies, DomainChangeSet } from '@wimm/domain';
import type { UUID, BackgroundExecutionPort } from '@wimm/contracts';
import type { ImportPreparationInput, ImportPreviewInput, ImportPreviewOutput } from './automation-model.js';
import type { FinanceApplication } from './finance-application.js';
export interface ApplicationRuntime { readonly dependencies: DomainDependencies; readonly importPreparation: BackgroundExecutionPort<ImportPreparationInput, DomainChangeSet | null>; readonly importPreview: BackgroundExecutionPort<ImportPreviewInput, ImportPreviewOutput>; readonly persistence?:import('./storage-persistence.js').StoragePersistenceApplication; financeForScope(profileId: UUID, spaceId: UUID): FinanceApplication }

export * from './migration-coordinator.js';
export * from './migration-backup-verifier.js';
export * from './storage-persistence.js';
export * from './local-snapshot-export.js';
