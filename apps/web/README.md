# @wimm/web

## Lokaler Import P5

Die Importansicht verarbeitet CSV, CAMT.053, OFX und QFX lokal mit korrigierbarer Vorschau. Regeln und Dauerzahlungen verwenden denselben Fachkern wie Desktop. Der Produktionsbuild trägt sämtliche gebündelten Assets einschließlich beider Importworker in die Service-Worker-Liste ein und leitet den Cachenamen aus dieser Liste ab. Nach erfolgreichem Erstladen stehen damit auch noch nicht verwendete Importworker offline zur Verfügung. API-Antworten werden weiterhin nicht gecacht. Bestätigte Importgruppen und Fälligkeiten liegen dauerhaft in IndexedDB; gesperrte Tresore zeigen keine Import-/Finanzansicht.
