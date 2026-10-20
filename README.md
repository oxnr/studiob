# Studio B

Redesign der bestehenden Website **studiob.bar** auf Basis von `oxnr/studiob`.
Stand: 20. Oktober 2026. Eigener Branch `codex/studio-b-reservations`.

## Status

Design und Reservierungsformular als private Vorschau. Die produktive GitHub-Pages-Seite wurde noch nicht ersetzt.
Das Formular sendet ohne aktivierte Konfiguration ausdrücklich **keine** E-Mail. Es zeigt nach Prüfung der Pflichtfelder einen Vorschauhinweis.

- Bestehende Fotos, Studio-B-Schriftzug und warme dunkle Farbwelt erhalten.
- Ergänzt: Tag-/Abendbereiche, Kontakt, Telefon, Formular und mobile Reservierungsnavigation.
- Deutsch, Englisch und Türkisch; keine externen Fonts oder Analytics.
- Server-Endpunkt und Mailvorlage in `server/`, mit separater Konfiguration.
- Neue QR-Dateien in `print/`; Anker `#reservieren` erst nach Veröffentlichung verfügbar.
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

Gast sendet eine **unverbindliche Anfrage** mit Datum, Uhrzeit, Personen, Name, E-Mail und Telefonnummer; Nachricht optional. Der Server sendet eine E-Mail an die fest konfigurierte Betreiberadresse. Der Besitzer antwortet direkt an den Gast über Reply-To. Es gibt keine automatische verbindliche Buchung, keine behauptete Tischverfügbarkeit und kein Gästeportal.

Cloudflare Worker + Resend; Turnstile schützt den öffentlichen Mail-Endpunkt. Einrichtung und Tests: `server/README.md`. Secrets gehören ausschließlich in die serverseitige Umgebung, nie in `site-config.js` oder Git.

Vor der Live-Schaltung fehlen:

1. Betreiber bestätigt Empfängeradresse. Öffentlich bei der anderen Website: info@studiob030.de; als Ziel noch **nicht** festgelegt.
2. Versanddienst/Absenderdomain und Turnstile verbinden, Worker veröffentlichen, öffentliche Endpoint-URL und Sitekey in `site-config.js` setzen.
3. Einen abgestimmten echten Test vom Formular bis zum Betreiber-Postfach durchführen. Bisher nur Mock-Tests, keine Testreservierung an den Betrieb.
4. Rechtstexte für **studiob.bar**, tatsächlichen Betreiber und die eingesetzten Versand-/Schutzdienste prüfen/ergänzen. Aktuelle Links gehen auf bestehende Betreiberseiten bei studiob030.de und gelten nicht automatisch für die neue Verarbeitung.
5. Neue Bilder einfügen, finale Inhalte prüfen, `noindex,nofollow` in `index.html` entfernen, erst dann den Branch veröffentlichen.

Die ursprüngliche Anweisung, studiob.bar nicht zu verwenden, wurde am 20. Oktober für diesen Websiteauftrag durch „Nutze unsere Seite studiob.bar als Basis“ ersetzt. Google Ads und Maps wurden dabei nicht geändert.

## Bilder und Inhalte

`assets/street.jpg`, `bar.jpg`, `wall.jpg`, `door.jpg` stammen unverändert aus dem bestehenden Repository. `assets/acai.jpeg` ist das zuvor vom Nutzer freigegebene Studio-B-Foto aus der lokalen September-Vorschau. Neue Bilder folgen laut Nutzer; feste Bildflächen und responsive Zuschnitte sind vorbereitet.

Frühstück 09–16 Uhr, Lunch 11–20 Uhr, 16 Außenplätze und Zahlarten stammen aus Betreiberangaben im Chat. Telefonnummer: 030 67392575. Es werden keine wechselnden Angebote, Preise, Gästezahlen oder Testimonials erfunden.

Schriften der bestehenden Seite sind nun lokal eingebunden. Lizenzen liegen unter `assets/fonts/`. Papillon dient als Gestaltungsreferenz für großflächige Bildführung und klare Reservierung; kein fremdes Bildmaterial und keine übernommenen Texte.
