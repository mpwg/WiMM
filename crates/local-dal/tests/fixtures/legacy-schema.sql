-- SPDX-License-Identifier: AGPL-3.0-or-later
-- Unverändertes Bestandsschema: apps/desktop/src-tauri/src/storage.rs initialize_storage.
CREATE TABLE IF NOT EXISTS storage_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS aggregates (
           profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL,
           revision INTEGER NOT NULL CHECK(revision >= 1), payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, handle)
         );
         CREATE INDEX IF NOT EXISTS aggregates_by_space ON aggregates(profile_id, space_id);
         CREATE TABLE IF NOT EXISTS confirmed (
           profile_id TEXT NOT NULL, handle TEXT NOT NULL, space_id TEXT NOT NULL,
           epoch TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision >= 1), payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, handle)
         );
         CREATE INDEX IF NOT EXISTS confirmed_by_space ON confirmed(profile_id, space_id);
         CREATE TABLE IF NOT EXISTS outbox (
           profile_id TEXT NOT NULL, operation_id TEXT NOT NULL, space_id TEXT NOT NULL,
           state TEXT NOT NULL, payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, operation_id)
         );
         CREATE INDEX IF NOT EXISTS outbox_by_space_state ON outbox(profile_id, space_id, state);
         CREATE TABLE IF NOT EXISTS projections (
           profile_id TEXT NOT NULL, space_id TEXT NOT NULL, projection_kind TEXT NOT NULL,
           projection_key TEXT NOT NULL, payload TEXT NOT NULL,
           PRIMARY KEY(profile_id, space_id, projection_kind, projection_key)
         );
         CREATE TABLE IF NOT EXISTS sync_state (
           profile_id TEXT NOT NULL, space_id TEXT NOT NULL, epoch TEXT NOT NULL, cursor TEXT NOT NULL,
           PRIMARY KEY(profile_id, space_id)
         );
