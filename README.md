# Studio B

Redesign der bestehenden Website **studiob.bar** auf Basis von `oxnr/studiob`.
Stand: 20. Oktober 2026. Eigener Branch `codex/studio-b-reservations`.

## Status

Produktive Version für GitHub Pages (`main`, Repository-Root, Domain `studiob.bar`).
Das Reservierungsformular ist direkt in die Website eingebaut. Der AJAX-Versand über FormSubmit an das Studio-B-Gmail-Postfach ist vorbereitet; Gäste bleiben auf studiob.bar. Keine Weiterleitung zum alten Buchungssystem. Bis zur E-Mail-Aktivierung und Verbindung des anonymen Formular-Endpunkts ist der Versand über `reservationEnabled: false` gesperrt, mit telefonischer Alternative. Die Empfängeradresse steht nicht im öffentlichen Code.

- Eigene Studio-B-Fotos, Studio-B-Schriftzug und warme dunkle Farbwelt. Die am 20.10.2026 gelieferten Fotos ergänzen Hero, Açaí-Bereich und eine aufklappbare Galerie.
- Ergänzt: Tag-/Abendbereiche, Kontakt, Telefon, Formular und mobile Reservierungsnavigation.
- Deutsch, Englisch und Türkisch; keine externen Fonts oder Analytics.
- Versandadapter und Prüfungen in `formsubmit-service.js` und `tests/formsubmit.test.mjs`.
- Neue QR-Dateien in `print/`; Ziel ist der Abschnitt `#reservieren` auf studiob.bar.
- `arch.html`, `split.html` und das dafür verwendete `styles.css` sind unverändert.

## Lokal

Node.js 20+ und Python 3:

```sh
npm test
npm run preview
```

Vorschau: http://127.0.0.1:8767

```sh
npm run build
```

Das erzeugt `dist/` mit ausschließlich auszuliefernden Dateien. Der private Sites-Auftritt verwendet diese Ausgabe; die Projektkennung in `.openai/hosting.json` bleibt erhalten.

## E-Mail-Ablauf

Gast sendet eine **unverbindliche Anfrage** mit Datum, Uhrzeit, Personen, Name, E-Mail und Telefonnummer; Nachricht optional. FormSubmit sendet an das fest konfigurierte Studio-B-Gmail-Postfach. Der Besitzer antwortet direkt an den Gast über Reply-To. Es gibt keine automatische verbindliche Buchung, keine behauptete Tischverfügbarkeit und kein Gästeportal.

Der einfache Dienst benötigt keinen eigenen Server und keine privaten API-Schlüssel. Erst nach Bestätigung der Aktivierungs-Mail wird zugestellt. FormSubmit speichert Anfragen für 30 Tage; dies steht direkt beim Formular inklusive Anbieter-Datenschutzlink. Ein Honeypot sowie der Spamfilter des Anbieters sind aktiv; CAPTCHA wird nicht ausdrücklich deaktiviert. Keine automatische Antwortmail an Gäste. Der UUID dient als Anfragekennung, nicht als garantierte Deduplizierung beim Dienst. Bei unklarer Netzwerkantwort erfolgt keine automatische Wiederholung.

Einrichtung abschließen:

1. Im Studio-B-Gmail-Postfach die FormSubmit-Mail öffnen und „Activate Form“ bestätigen. Der Anbieter hat den Versand dieser Mail am 20.10.2026 per API bestätigt. Der Einrichtungstext ist ausdrücklich keine Reservierung.
2. Die anonyme Formular-Kennung aus der Anbieter-Mail in `reservationEndpoint` einsetzen: `https://formsubmit.co/ajax/ANONYME_FORMULAR_KENNUNG`. Keine private API-Kennung zum Lesen des Nachrichtenarchivs veröffentlichen. Die verwendete Kennung muss ausdrücklich für das öffentliche Formular bestimmt sein.
3. Mit einem als Test markierten Versand die positive API-Antwort und den Postfacheingang prüfen. Aktivierungsantworten werden niemals als erfolgreiche Reservierungsanfrage angezeigt.
4. `reservationEnabled` in `site-config.js` auf `true` setzen, Tests/Build ausführen, veröffentlichen und Formular im Browser prüfen.

Außerhalb von `https://studiob.bar` läuft das Formular als klar gekennzeichnete Vorschau ohne Versand. Ohne JavaScript bleibt der Absende-Button deaktiviert und eine Telefonalternative sichtbar. Der zuvor vorbereitete Worker (`server/` und `reservation-service.js`) bleibt als ungenutzte Alternative erhalten; er ist nicht bereitgestellt und wird nicht von `app.js` geladen.

Die Gestaltung verwendet ausschließlich vorhandene und vom Nutzer gelieferte Studio-B-Aufnahmen. Die allgemeinen Betreiber-Rechtstexte bleiben verlinkt; die konkrete Verarbeitung der neuen Reservierungsanfrage ist zusätzlich direkt im Formular erläutert.

## Veröffentlichung und Rücknahme

GitHub Pages veröffentlicht `main` aus dem Repository-Root, nicht `dist/`. `CNAME` muss `studiob.bar` enthalten. Vor Push Tests und Build ausführen, danach Pages-Buildstatus sowie Live-Domain, Sprachwechsel und natives Formular prüfen. Kein Force-Push. Eine Rücknahme erfolgt durch einen neuen Revert-Commit auf `main`; die Version vor dem Redesign war `fdcfda08f17b22f87d5aaadea0fbd6962cab5717`.

Bei Änderungen an Scripts, Konfiguration oder CSS die Versionsparameter in `index.html` und den Modul-Imports in `app.js` gemeinsam erhöhen. Damit laden wiederkehrende Besucher keine Kombination aus neuem HTML und alten Formular-Scripts aus dem Browser-/CDN-Cache.

Die ursprüngliche Anweisung, studiob.bar nicht zu verwenden, wurde am 20. Oktober für diesen Websiteauftrag durch „Nutze unsere Seite studiob.bar als Basis“ ersetzt. Google Ads und Maps wurden dabei nicht geändert.

## Bilder und Inhalte

`assets/street.jpg`, `bar.jpg`, `wall.jpg`, `door.jpg` stammen unverändert aus dem bestehenden Repository. `assets/acai.jpeg` ist das zuvor vom Nutzer freigegebene Studio-B-Foto aus der lokalen September-Vorschau. Die Lieferung vom 20.10.2026 enthält 19 unterschiedliche Motive und fünf zusätzliche Kopien mit identischen Bildpixeln. `assets/food/` enthält responsive WebP-Versionen ohne Kamerametadaten, zusätzlich ein JPEG für Linkvorschauen. Originaldateien bleiben außerhalb des öffentlichen Repositorys erhalten. Quelle, Abmessungen und Dateigrößen stehen in `docs/photo-assets-2026-10-20.json`. Die Datei `THE SCHNITZEL` zeigt Pasta und ist deshalb neutral als „Pasta“ beschriftet; Zutaten und Preise werden daraus nicht abgeleitet. Sechs Galeriebilder erscheinen direkt, elf weitere in einem auch ohne JavaScript bedienbaren Aufklappbereich.

Frühstück 09–16 Uhr, Lunch 11–20 Uhr, 16 Außenplätze und Zahlarten stammen aus Betreiberangaben im Chat. Telefonnummer: 030 67392575. Es werden keine wechselnden Angebote, Preise, Gästezahlen oder Testimonials erfunden.

Schriften der bestehenden Seite sind nun lokal eingebunden. Lizenzen liegen unter `assets/fonts/`. Papillon dient als Gestaltungsreferenz für großflächige Bildführung und klare Reservierung; kein fremdes Bildmaterial und keine übernommenen Texte.
