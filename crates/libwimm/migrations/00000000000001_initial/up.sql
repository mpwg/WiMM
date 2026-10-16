CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    currency TEXT NOT NULL
);
CREATE TABLE bookings (
    id TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    booking_date TEXT NOT NULL,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL CHECK (amount <> 0)
);
CREATE INDEX bookings_account_date ON bookings(account_id, booking_date, id);
