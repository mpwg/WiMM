/* tslint:disable */
/* eslint-disable */

export class MoneyRequestV2 {
    free(): void;
    [Symbol.dispose](): void;
    constructor(contract_version: number, domain_schema_version: number, space_id: string, text: string);
    readonly contractVersion: number;
    readonly domainSchemaVersion: number;
    readonly spaceId: string;
    readonly text: string;
}

/**
 * Nur Ausgabevertrag: ein Erfolg hat Cent, eine Ablehnung Code/Meldung.
 */
export class MoneyResultV2 {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly contractVersion: number;
    readonly errorCode: string | undefined;
    readonly message: string | undefined;
    readonly status: MoneyStatusV2;
    readonly value: number | undefined;
}

export enum MoneyStatusV2 {
    Money = 0,
    Rejected = 1,
}

export function calculate_json(request: string): string;

export function calculate_money_v2(request: MoneyRequestV2): MoneyResultV2;

/**
 * K01-JSON-Vertrag; alle Facharbeit verbleibt in der unabhängigen Kernbibliothek.
 */
export function execute_json(request: string): string;

export function project_json(request: string): string;

export function reverse_json(request: string): string;

export function validate_json(request: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_moneyrequestv2_free: (a: number, b: number) => void;
    readonly __wbg_moneyresultv2_free: (a: number, b: number) => void;
    readonly calculate_json: (a: number, b: number) => [number, number];
    readonly calculate_money_v2: (a: number) => number;
    readonly execute_json: (a: number, b: number) => [number, number];
    readonly moneyrequestv2_contractVersion: (a: number) => number;
    readonly moneyrequestv2_domainSchemaVersion: (a: number) => number;
    readonly moneyrequestv2_new: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly moneyrequestv2_spaceId: (a: number) => [number, number];
    readonly moneyrequestv2_text: (a: number) => [number, number];
    readonly moneyresultv2_contractVersion: (a: number) => number;
    readonly moneyresultv2_errorCode: (a: number) => [number, number];
    readonly moneyresultv2_message: (a: number) => [number, number];
    readonly moneyresultv2_status: (a: number) => number;
    readonly moneyresultv2_value: (a: number) => [number, number];
    readonly project_json: (a: number, b: number) => [number, number];
    readonly reverse_json: (a: number, b: number) => [number, number];
    readonly validate_json: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
