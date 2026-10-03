// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react';

import { initializeCrypto } from '@wimm/crypto';

const sourceUrl = 'https://github.com/mpwg/WiMM';

export function App() {
  const [cryptoReady, setCryptoReady] = useState<'bereit' | 'fehler' | 'wird geprüft'>('wird geprüft');

  useEffect(() => {
    void initializeCrypto().then(
      () => setCryptoReady('bereit'),
      () => setCryptoReady('fehler')
    );
  }, []);

  return (
    <main>
      <p className="eyebrow">WhereIsMyMoney für den Schreibtisch</p>
      <h1>Die Desktop-Anwendung wird vorbereitet.</h1>
      <p>
        Finanzfunktionen folgen in den nächsten Arbeitspaketen. Diese Hülle prüft bereits die sichere
        Client-Kryptografie.
      </p>
      <p aria-live="polite">Kryptografie: {cryptoReady}</p>
      <a href={sourceUrl} rel="noreferrer" target="_blank">
        Quellcode und Lizenz
      </a>
    </main>
  );
}
