// SPDX-License-Identifier: AGPL-3.0-or-later
/** Dieselbe flüchtige Anwendungssperre gilt für Profilwechsel und Finanzwrites. */
export class ApplicationActivity {
  private finance = false;
  private profile = false;
  get financeBusy() { return this.finance; }
  get profileBusy() { return this.profile; }
  beginFinance(): () => void {
    if (this.finance || this.profile) throw new Error('Bitte warten Sie auf die laufende Speicherung oder den Bereichswechsel.');
    this.finance = true; let released = false; return () => { if (!released) { released = true; this.finance = false; } };
  }
  beginProfile(): () => void {
    if (this.finance || this.profile) throw new Error('Bitte warten Sie auf die laufende Speicherung oder den Bereichswechsel.');
    this.profile = true; let released = false; return () => { if (!released) { released = true; this.profile = false; } };
  }
}
