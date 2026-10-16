import type { AccountInput, BookingInput, Failure, Method, Operations, Request, Response } from "./protocol.js";
export type { Account, AccountInput, Booking, BookingInput, ErrorCode } from "./protocol.js";

export class WiMMError extends Error {
  readonly code: Failure["code"];
  constructor(error: Failure) {
    super(String(error.message));
    this.name = "WiMMError";
    this.code = error.code;
  }
}

/** One exclusive persistent database handle, backed by a dedicated Web Worker. */
export class WiMM {
  private readonly worker: Worker;
  private sequence = 0;
  private closed = false;
  private closeTask?: Promise<void>;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();

  private constructor() {
    this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      if (data.ok) pending.resolve(data.value);
      else pending.reject(new WiMMError(data.error));
    };
    this.worker.onerror = (event) => {
      this.fail(new WiMMError({ code: "storage", message: event.message || "Worker failed" }));
    };
    this.worker.onmessageerror = () => this.fail(new WiMMError({ code: "storage", message: "Worker message could not be decoded" }));
  }

  /** Name: 1–64 ASCII letters, digits, '-' or '_'. Requires HTTPS or localhost. */
  static async open(name = "default"): Promise<WiMM> {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) {
      throw new WiMMError({ code: "validation", message: "Invalid database name" });
    }
    if (!globalThis.isSecureContext || typeof Worker === "undefined" || !navigator.storage?.getDirectory || !navigator.locks) {
      throw new WiMMError({ code: "unsupported_browser", message: "Requires secure context, module workers, OPFS and Web Locks" });
    }
    const client = new WiMM();
    try { await client.call("open", { name }); return client; }
    catch (error) { client.fail(error instanceof Error ? error : new Error(String(error))); throw error; }
  }

  private fail(error: Error): void {
    this.closed = true;
    this.worker.terminate();
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private call<M extends Method>(method: M, params: Operations[M][0]): Promise<Operations[M][1]> {
    if (this.closed) return Promise.reject(new WiMMError({ code: "closed", message: "Database is closed" }));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve: value => resolve(value as Operations[M][1]), reject });
      try { this.worker.postMessage({ id, method, params } as Request); }
      catch (error) { this.pending.delete(id); reject(error); }
    });
  }

  close(): Promise<void> {
    if (this.closeTask) return this.closeTask;
    if (this.closed) return Promise.resolve();
    const reply = this.call("close", undefined);
    this.closed = true;
    this.closeTask = reply.then(() => undefined).finally(() => this.fail(new WiMMError({ code: "closed", message: "Database is closed" })));
    return this.closeTask;
  }

  createAccount(input: AccountInput) { return this.call("create_account", input); }
  getAccount(id: string) { return this.call("get_account", { id }); }
  listAccounts() { return this.call("list_accounts", undefined); }
  updateAccount(id: string, input: AccountInput) { return this.call("update_account", { id, input }); }
  deleteAccount(id: string) { return this.call("delete_account", { id }); }
  createBooking(account_id: string, input: BookingInput) { return this.call("create_booking", { account_id, input }); }
  getBooking(account_id: string, id: string) { return this.call("get_booking", { account_id, id }); }
  listBookings(account_id: string) { return this.call("list_bookings", { account_id }); }
  updateBooking(account_id: string, id: string, input: BookingInput) { return this.call("update_booking", { account_id, id, input }); }
  deleteBooking(account_id: string, id: string) { return this.call("delete_booking", { account_id, id }); }
  exportJson() { return this.call("export_json", undefined); }
  /** Replaces ALL accounts and bookings, including when the backup is empty. */
  replaceFromJson(json: string) { return this.call("replace_from_json", { json }); }
  currencyMinorUnits(code: string) { return this.call("currency_minor_units", { code }); }
}
