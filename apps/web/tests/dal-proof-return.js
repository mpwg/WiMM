// SPDX-License-Identifier: AGPL-3.0-or-later
const query = new URL(location.href).searchParams;
const scope = query.get('scope');
const wasm = query.get('wasmUrl');
if (!scope || !/^[A-Za-z0-9-]{1,64}$/.test(scope) || !wasm?.startsWith('/@fs/')) throw new Error('Ungültiger Origin-Testbereich');
location.replace(`http://127.0.0.1:4176/tests/dal-proof.html?scope=${scope}&wasmUrl=${encodeURIComponent(wasm)}`);
