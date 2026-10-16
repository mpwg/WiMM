# WiMM / libWiMM

WiMM is a cross-platform personal finance manager. This repository currently
contains its portable Rust core and a browser package; it does not yet contain
an end-user application.

The MVP provides account CRUD, account-scoped income/expense CRUD, SQLite
persistence through Diesel, and lossless JSON backup export/replacement. Native
and browser builds execute the same Rust implementation.

## Rust

Requires Rust 1.89+ and a C compiler for bundled SQLite. Use the committed lockfile.

```toml
[dependencies]
libwimm = { path = "crates/libwimm" }
```

```rust
use libwimm::{AccountInput, BookingInput, WiMM};

fn main() -> libwimm::Result<()> {
    let mut db = WiMM::open("personal.sqlite3")?;
    let account = db.create_account(AccountInput {
        name: "Daily".into(), currency: "EUR".into(),
    })?;
    db.create_booking(account.id, BookingInput {
        booking_date: "2026-10-16".into(),
        description: "Lunch".into(),
        amount: -1250, // EUR -12.50
    })?;
    let backup = db.export_json()?;
    // DESTRUCTIVE: replaces ALL existing accounts and bookings atomically.
    db.replace_from_json(&backup)?;
    db.close();
    Ok(())
}
```

`WiMM::in_memory()` provides isolated ephemeral databases for tests. A native
handle owns one synchronous connection; dropping it also closes it. Writes are
committed before methods return. Embedded migrations run automatically on open.
The database parent directory must already exist. Future PostgreSQL/MySQL
adapters can be added internally without exposing ORM types to callers.

## Browser / TypeScript

Requires Node.js 24+, pnpm (version pinned in `package.json`), Rust and a C compiler
with a WebAssembly target (Clang). Install the matching wasm-bindgen CLI:

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.129 --locked
pnpm install --frozen-lockfile
pnpm build:browser
```

Build output is in `packages/browser/dist`. Serve **all files** in that directory,
including `worker.js` and `wimm_wasm_bg.wasm`, from the same origin. Configure
`application/wasm` for `.wasm` files. The generated ES module and declarations can
also be consumed as the local `@wimm/browser` workspace package. A consuming
bundler must preserve the worker URL and copy the WASM asset; directly serving
the built directory requires no additional bundler integration.

```ts
import { WiMM, WiMMError } from './dist/index.js';

const db = await WiMM.open('personal');
try {
  const account = await db.createAccount({ name: 'Daily', currency: 'EUR' });
  await db.createBooking(account.id, {
    booking_date: '2026-10-16', description: 'Lunch', amount: '-1250',
  });
  console.log(await db.listBookings(account.id));
  const backup = await db.exportJson();
  // DESTRUCTIVE: restore only after the application obtains user confirmation.
  await db.replaceFromJson(backup);
} catch (error) {
  if (error instanceof WiMMError) console.error(error.code, error.message);
  else throw error;
} finally {
  await db.close();
}
```

The browser module uses a dedicated module worker, SQLite's OPFS SAH-pool VFS,
and Web Locks for exclusive access. HTTPS (or localhost), OPFS sync access
handles and Web Locks are required. Unsupported environments reject opening;
there is no silent in-memory fallback. An open database name allows one client
per origin, including across tabs. Different names are independent. Names contain
1–64 ASCII letters, digits, `-` or `_` and identify `.libwimm-<name>` OPFS pools.

Every call is asynchronous and serialized within the worker. `close()` is
idempotent, rejects new operations, closes SQLite and releases storage handles
and the lock before resolving. Always await it before reopening. Page teardown
also releases the worker's locks. Browser storage remains subject to browser
quota, eviction and user clearing; JSON exports are the portable backups.
The library does not provide synchronization between devices or origins.

## Model and behavior

- Account: generated UUID, trimmed nonempty name and uppercase ISO-4217 currency.
  Duplicate names are allowed. Currency changes are rejected while bookings exist.
- Booking: generated UUID, immutable account ID, strict calendar date
  `YYYY-MM-DD`, description (may be empty) and nonzero signed `i64` minor units.
  Positive amounts are income; negative amounts are expenses. No floats or
  implicit rounding. EUR has 2 minor digits, JPY 0, KWD 3 and CLF 4.
- Currency definitions are bundled from SIX ISO-4217 List One, published
  2026-09-17. Codes with no numeric minor unit, including precious metals, are
  unsupported. See the source URL in `crates/libwimm/src/currencies.rs`.
- Account-scoped booking reads, updates and deletes verify ownership. Updates
  replace all editable fields. Unknown IDs return `not_found`.
- Deleting an account also deletes all its bookings atomically.
- Accounts are ordered by ID; bookings by ascending date, then ID. Lists are
  complete, without pagination. Balances are not separately stored.

Rust methods are `create_account`, `get_account`, `list_accounts`,
`update_account`, `delete_account` and corresponding `*_booking` methods;
`list_bookings(account_id)` lists bookings for one account. Browser methods use
camelCase and string UUIDs. `currency_minor_units` / `currencyMinorUnits` exposes
the bundled currency precision.

## JSON format v1

```json
{
  "format_version": 1,
  "accounts": [
    {"id": "550e8400-e29b-41d4-a716-446655440000", "name": "Daily", "currency": "EUR"}
  ],
  "bookings": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "account_id": "550e8400-e29b-41d4-a716-446655440000",
      "booking_date": "2026-10-16",
      "description": "Lunch",
      "amount": "-1250"
    }
  ]
}
```

Amounts are **strings**, both in backups and at the JavaScript interface, with
range `-9223372036854775808` through `9223372036854775807`, excluding zero. Leading
zeros, plus signs, decimal points and whitespace are rejected. Rust callers use
`i64` directly. IDs survive export/import.

Export reads one consistent database snapshot. `replace_from_json` /
`replaceFromJson` validates the full document, then deletes and reinserts the
entire data set in one transaction. A valid empty backup **clears everything**.
Invalid JSON, invalid fields/dates/amounts, duplicate IDs, duplicate object keys,
unknown fields and missing account references are rejected. Failed writes roll
back all changes. Unknown format versions are rejected; no future-version
migration is attempted. Account names are normalized the same way as during CRUD.

The core accepts/returns JSON text. File pickers, downloads and confirmation
flows belong to the consuming application.

## Errors

Native `libwimm::Error` variants correspond to stable browser error codes:

| Code | Meaning |
| --- | --- |
| `validation` | Invalid CRUD input or currency change with existing bookings |
| `not_found` | Account/booking missing or booking belongs to another account |
| `invalid_import` | Invalid backup contents or relationships |
| `unsupported_format_version` | Backup version is unsupported |
| `storage` | Database, migration, OPFS, worker or serialization failure |
| `unsupported_browser` | Required browser features are unavailable |
| `busy` | Another browser client owns the database |
| `closed` | Browser handle has been closed |

The last three codes are browser-specific. Match error variants/codes rather
than human-readable messages. No Diesel error types appear in the interface.

## Verification

```sh
cargo fmt --all --check
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo test --workspace --locked
cargo clippy -p wimm-wasm --target wasm32-unknown-unknown --locked -- -D warnings
pnpm build:browser
python3 -m venv .venv
. .venv/bin/activate
pip install -r tests/browser/requirements.txt
python -m playwright install chromium firefox webkit
sh scripts/test-browser.sh
```

On Linux, Playwright may require `python -m playwright install --with-deps`.
For a single engine: `sh scripts/test-browser.sh --browser chromium`.

Native integration tests cover CRUD, ownership, currency rules, amount limits,
ordering, import validation, roundtrip, persistent reopening, cascade deletion
and rollback after an injected SQLite write failure. Browser tests execute the
real WASM worker in Chromium, Firefox and WebKit, including page reload
persistence, cross-tab exclusion, close/reopen and feature detection.

CI runs native tests on Windows/macOS/Linux, compile checks for iOS/Android,
and the WASM/browser suite on Linux. Mobile checks verify compilation; native
UI bindings and on-device runtime tests are future work. Additional databases,
categories, transfers, exchange rates, encryption and user management are
outside this MVP.

Licensed under AGPL-3.0-only; see [LICENSE](LICENSE).
