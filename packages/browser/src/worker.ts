/// <reference lib="webworker" />
import init, { BrowserCore } from "../wasm/wimm_wasm.js";
import type { Failure, Request, Response } from "./protocol.js";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let core: BrowserCore | undefined;
let release: (() => void) | undefined;
let lockTask: Promise<void> | undefined;
let queue = Promise.resolve();

function failure(error: unknown): Failure {
  if (typeof error === "string") {
    try { return JSON.parse(error) as Failure; } catch { /* regular error string */ }
  }
  if (typeof error === "object" && error !== null && "code" in error && "message" in error) return error as Failure;
  return { code: "storage", message: error instanceof Error ? error.message : String(error) };
}

async function open(name: string): Promise<null> {
  if (core) throw { code: "busy", message: "Database is already open" };
  if (!scope.isSecureContext || !navigator.storage?.getDirectory || !navigator.locks || typeof FileSystemFileHandle === "undefined" || !("createSyncAccessHandle" in FileSystemFileHandle.prototype)) {
    throw { code: "unsupported_browser", message: "OPFS sync access handles require a supported dedicated worker in a secure context" };
  }
  await init();
  await new Promise<void>((resolve, reject) => {
    lockTask = navigator.locks.request(`libwimm:${name}`, { mode: "exclusive", ifAvailable: true }, async lock => {
      if (!lock) { reject({ code: "busy", message: "Database is already open in another client" }); return; }
      const held = new Promise<void>(done => { release = done; });
      try { core = await BrowserCore.open(name); resolve(); await held; }
      catch (error) { reject(error); }
      finally { release = undefined; }
    });
    lockTask.catch(reject);
  });
  return null;
}

async function dispatch(request: Request): Promise<unknown> {
  if (request.method === "open") return open(request.params.name);
  if (!core) throw { code: "closed", message: "Database is closed" };
  if (request.method === "close") {
    try { core.close(); }
    finally { core.free(); core = undefined; release?.(); await lockTask; }
    return null;
  }
  return JSON.parse(core.invoke(JSON.stringify({ method: request.method, params: request.params })));
}

scope.onmessage = ({ data }: MessageEvent<Request>) => {
  queue = queue.then(async () => {
    let response: Response;
    try { response = { id: data.id, ok: true, value: await dispatch(data) }; }
    catch (error) { response = { id: data.id, ok: false, error: failure(error) }; }
    scope.postMessage(response);
  });
};
