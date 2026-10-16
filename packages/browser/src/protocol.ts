export interface AccountInput { name: string; currency: string }
export interface Account extends AccountInput { id: string }
export interface BookingInput {
  booking_date: string;
  description: string;
  /** Exact signed i64 minor units as a canonical decimal integer string. */
  amount: string;
}
export interface Booking extends BookingInput { id: string; account_id: string }
export type ErrorCode = "validation" | "not_found" | "invalid_import" |
  "unsupported_format_version" | "storage" | "unsupported_browser" | "busy" | "closed";
export interface Failure { code: ErrorCode; message: string | number }

export interface Operations {
  open: [{ name: string }, null];
  close: [undefined, null];
  create_account: [AccountInput, Account];
  get_account: [{ id: string }, Account];
  list_accounts: [undefined, Account[]];
  update_account: [{ id: string; input: AccountInput }, Account];
  delete_account: [{ id: string }, null];
  create_booking: [{ account_id: string; input: BookingInput }, Booking];
  get_booking: [{ account_id: string; id: string }, Booking];
  list_bookings: [{ account_id: string }, Booking[]];
  update_booking: [{ account_id: string; id: string; input: BookingInput }, Booking];
  delete_booking: [{ account_id: string; id: string }, null];
  export_json: [undefined, string];
  replace_from_json: [{ json: string }, null];
  currency_minor_units: [{ code: string }, number];
}
export type Method = keyof Operations;
export type Request = { [M in Method]: { id: number; method: M; params: Operations[M][0] } }[Method];
export type Response = { id: number } & ({ ok: true; value: unknown } | { ok: false; error: Failure });
