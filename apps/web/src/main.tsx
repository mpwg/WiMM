// SPDX-License-Identifier: AGPL-3.0-or-later
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.js';
import './styles.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Das Wurzelelement der Anwendung fehlt.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
