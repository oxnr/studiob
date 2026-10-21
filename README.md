# Studio B

Redesign der bestehenden Website **studiob.bar** auf Basis von `oxnr/studiob`.
Stand: 21. Oktober 2026. Eigener Branch `codex/studio-b-reservations`.

## Status

Produktive Version für GitHub Pages (`main`, Repository-Root, Domain `studiob.bar`).
Das Reservierungsformular ist direkt in die Website eingebaut. Der AJAX-Versand über FormSubmit an das Studio-B-Gmail-Postfach ist aktiviert; Gäste bleiben auf studiob.bar. Keine Weiterleitung zum alten Buchungssystem. Die öffentliche Formular-Kennung ist in `site-config.js` hinterlegt, `reservationEnabled` ist `true`. Aktivierung, positive API-Antwort und Eingang einer markierten Testmail einschließlich Antwortadresse wurden am 21.10.2026 geprüft. Der Versandendpunkt verwendet eine öffentliche Formular-Kennung; die vom Nutzer zur Veröffentlichung freigegebene Kontaktadresse steht im Impressum.

- Eigene Studio-B-Fotos, das originale Vektorlogo aus der gelieferten `STUDIO B.pdf` und warme dunkle Farbwelt. Die am 20.10.2026 gelieferten Fotos ergänzen Hero, Açaí-Bereich und eine aufklappbare Galerie.
- Ergänzt: Tag-/Abendbereiche, Kontakt, Telefon, Formular und mobile Reservierungsnavigation.
- Deutsch, Englisch und Türkisch; keine externen Fonts oder Analytics.
- Eigene Speise- und Getränkekarte unter `speisekarte.html`: 126 Positionen mit Preisen in 22 Kategorien. Die Bedienung ist dreisprachig; Namen, Beschreibungen und Kennzeichnungen bleiben originalsprachlich Deutsch.
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

Einrichtung und Wiederinbetriebnahme:

1. Im Studio-B-Gmail-Postfach die neueste FormSubmit-Mail öffnen und „Activate Form“ bestätigen. Am 21.10.2026 erledigt. Nach erneuter Aktivierungsanforderung ist der ältere Bestätigungslink möglicherweise ungültig; die öffentliche Formular-Kennung bleibt davon getrennt. Einrichtungstexte und Tests sind ausdrücklich keine Reservierungen.
2. Die anonyme Formular-Kennung aus der Anbieter-Mail in `reservationEndpoint` einsetzen: `https://formsubmit.co/ajax/ANONYME_FORMULAR_KENNUNG`. Keine private API-Kennung zum Lesen des Nachrichtenarchivs veröffentlichen. Die verwendete Kennung muss ausdrücklich für das öffentliche Formular bestimmt sein.
3. Mit einem als Test markierten Versand die positive API-Antwort und den Postfacheingang prüfen. Aktivierungsantworten werden niemals als erfolgreiche Reservierungsanfrage angezeigt.
4. `reservationEnabled` in `site-config.js` auf `true` setzen, Tests/Build ausführen, veröffentlichen und Formular im Browser prüfen.

Bei einem Versandproblem `reservationEnabled` auf `false` setzen und mit neuer Cache-Version veröffentlichen; dann zeigt die Website wieder die telefonische Alternative. Tests immer deutlich als „FUNKTIONSTEST – KEINE RESERVIERUNG“ kennzeichnen und anhand einer neuen Anfrage-ID im Postfach abgleichen. Eine erfolgreiche API-Antwort allein beweist keinen Postfacheingang. Der technische Test vom 21.10.2026 um 10:54 Uhr (Berlin) wurde im Posteingang bestätigt; Datum, Uhrzeit, Personen, Nachricht und Reply-To stimmten überein.

Außerhalb von `https://studiob.bar` läuft das Formular als klar gekennzeichnete Vorschau ohne Versand. Ohne JavaScript bleibt der Absende-Button deaktiviert und eine Telefonalternative sichtbar. Der zuvor vorbereitete Worker (`server/` und `reservation-service.js`) bleibt als ungenutzte Alternative erhalten; er ist nicht bereitgestellt und wird nicht von `app.js` geladen.

Die Gestaltung verwendet ausschließlich vorhandene und vom Nutzer gelieferte Studio-B-Aufnahmen. Die eigenen Informationsseiten sind verlinkt; die konkrete Verarbeitung der Reservierungsanfrage ist zusätzlich direkt im Formular erläutert.

## Antworten auf Reservierungsanfragen

Neue Anfrage-E-Mails enthalten das Feld „Anfrage beantworten“ mit einem Link auf `reply.html`. Das Team kann eine Zusage, Absage, einen Vorschlag 30 Minuten früher/später, einen anderen Termin oder eine eigene Rückfrage vorbereiten. Die festen Texte folgen der Sprache des Gastes (DE/EN/TR); eigene Rückfragen werden nicht automatisch übersetzt. Betreff und Nachricht bleiben bearbeitbar. „In Mail öffnen“ bereitet einen `mailto:`-Entwurf im eingerichteten Mailprogramm vor; erst dort sendet das Team selbst. Vor dem Senden das Studio-B-Absenderkonto, den Empfänger und die Verfügbarkeit prüfen. Alternativ kann der Text in die Antwort auf die Originalmail kopiert werden. Ein neuer Mailentwurf wird nicht zwingend dem ursprünglichen Mailthread zugeordnet.

`reservation-reply.js` kodiert ausschließlich Name, Gast-E-Mail, Datum, Uhrzeit, Personen, Sprache und Anfrage-ID im URL-Fragment. Telefonnummer und freie Gastnachricht bleiben aus dem Link heraus. Der Link ist nicht verschlüsselt und kein Authentizitätsnachweis: Originalmail und Angaben abgleichen, Link nicht weitergeben. Die Seite liest das Fragment, entfernt es aus der Adresszeile und behält die Daten nur im Arbeitsspeicher. Nach Neuladen den ursprünglichen E-Mail-Link erneut öffnen. Keine zusätzliche Datenbank, Anmeldung, Versand-API oder Speicherung eines Bearbeitungsstatus. Alte E-Mails erhalten nachträglich keinen Link; dort direkt antworten. Seltene Gastadressen mit Prozentzeichen bekommen ebenfalls die normale Antwortmöglichkeit, damit die konservative `mailto:`-Validierung keine Reservierungsanfrage verhindert.

Die Bedienung muss nach Änderungen anhand einer eindeutig markierten Live-Testmail geprüft werden: vollständiger Link im tatsächlichen Postfach, alle Aktionen, editierter Text und Empfänger im Mailentwurf. Auf dem tatsächlichen Besitzer-Handy ist die Wahl der Mail-App und des Absenderkontos gesondert zu prüfen. Automatisch versendet die Antwortseite nichts; Zeitvorschläge und Rückfragen bestätigen noch keinen Tisch.

## Impressum und Datenschutz

`impressum.html` und `datenschutz.html` liegen auf der eigenen Domain; Startseite, Formular und Speisekarte verlinken sie direkt. Die Seiten sind derzeit deutsch. Der Nutzer hat am 21.10.2026 „Studio B“ ausdrücklich als Platzhalter für den noch nicht bestätigten rechtlichen Betreiber erlaubt. Die alte Website lieferte bei der erneuten Prüfung HTTP 503. Aus dem Google-Ads-Zahlungsprofil wird keine Betreiberidentität abgeleitet.

Offen bleiben vollständiger rechtlicher Betreibername und gegebenenfalls Rechtsform, Vertretung, Register-/Identifikationsangaben sowie zuständige Aufsichtsbehörde. Die Datenschutzhinweise beschreiben den tatsächlichen Ablauf mit GitHub Pages, FormSubmit, Gmail und Antwortentwürfen. Die 30 Tage des FormSubmit-Archivs sind keine automatische Löschfrist für Gmail. Die Postfach-Löschfrist und die vertraglichen Datenschutz-/Übermittlungsgrundlagen der Anbieter müssen mit dem Betreiber geklärt werden. Beide Seiten kennzeichnen ihre noch fehlenden Angaben; sie sind keine Zusage rechtlicher Vollständigkeit.

## Veröffentlichung und Rücknahme

GitHub Pages veröffentlicht `main` aus dem Repository-Root, nicht `dist/`. `CNAME` muss `studiob.bar` enthalten. Vor Push Tests und Build ausführen, danach Pages-Buildstatus sowie Live-Domain, Sprachwechsel und natives Formular prüfen. Kein Force-Push. Eine Rücknahme erfolgt durch einen neuen Revert-Commit auf `main`; die Version vor dem Redesign war `fdcfda08f17b22f87d5aaadea0fbd6962cab5717`.

Bei Änderungen an Scripts, Konfiguration oder CSS die Versionsparameter in `index.html` und den Modul-Imports in `app.js` gemeinsam erhöhen. Damit laden wiederkehrende Besucher keine Kombination aus neuem HTML und alten Formular-Scripts aus dem Browser-/CDN-Cache.

Die ursprüngliche Anweisung, studiob.bar nicht zu verwenden, wurde am 20. Oktober für diesen Websiteauftrag durch „Nutze unsere Seite studiob.bar als Basis“ ersetzt. Google Ads und Maps wurden dabei nicht geändert.

## Bilder und Inhalte

`assets/street.jpg`, `bar.jpg`, `wall.jpg`, `door.jpg` stammen unverändert aus dem bestehenden Repository. `assets/acai.jpeg` ist das zuvor vom Nutzer freigegebene Studio-B-Foto aus der lokalen September-Vorschau. Die Lieferung vom 20.10.2026 enthält 19 unterschiedliche Motive und fünf zusätzliche Kopien mit identischen Bildpixeln. `assets/food/` enthält responsive WebP-Versionen ohne Kamerametadaten, zusätzlich ein JPEG für Linkvorschauen. Originaldateien bleiben außerhalb des öffentlichen Repositorys erhalten. Quelle, Abmessungen und Dateigrößen stehen in `docs/photo-assets-2026-10-20.json`. Die später gelieferte Speisekarte bestätigt „The Schnitzel“ als Hähnchenschnitzel mit Nudeln in Käsesahnesauce; die zunächst neutrale Bildunterschrift wurde entsprechend aktualisiert. Sechs Galeriebilder erscheinen direkt, elf weitere in einem auch ohne JavaScript bedienbaren Aufklappbereich.

Frühstück 09–16 Uhr, Lunch 11–20 Uhr, 16 Außenplätze und Zahlarten stammen aus Betreiberangaben im Chat. Telefonnummer: 030 67392575. Es werden keine wechselnden Angebote, Preise, Gästezahlen oder Testimonials erfunden.

Schriften der bestehenden Seite sind nun lokal eingebunden. Lizenzen liegen unter `assets/fonts/`. Papillon dient als Gestaltungsreferenz für großflächige Bildführung und klare Reservierung; kein fremdes Bildmaterial und keine übernommenen Texte.

## Speise- und Getränkekarte

Die am 20.10.2026 bereitgestellten PDFs `MENU.pdf` und `ALKOL MENU.pdf` sind die Quelle. Beide enthalten ausschließlich Bildseiten. Die Inhalte wurden manuell übertragen und in einem zweiten, unabhängigen Durchgang vollständig mit allen vier Seiten abgeglichen.

- `data/menu-food-source.json`: 64 Positionen, einschließlich Kaffee, alkoholfreier Getränke und Dessert.
- `data/menu-drinks-source.json`: 62 Positionen, einschließlich vier Bar-Snacks.
- Die Website ordnet 39 Einträge Speisen und 87 Einträge Getränken zu. Frühstück/Lunch/Bar-Snacks bleiben in getrennten Kategorien; keine zusätzlichen Verfügbarkeitszeiten oder Füllmengen erfunden.
- `scripts/menu-page.html` ist die Seitenvorlage; `scripts/render-menu.mjs` erzeugt daraus `speisekarte.html` mit statischem HTML. Native Aufklappbereiche funktionieren auch ohne JavaScript. Ohne JavaScript erscheinen beide Karten untereinander; mit JavaScript wechseln die Navigationslinks zwischen Speisen und Getränken.
- `menu.js` übernimmt den Karten- und Sprachwechsel; `menu.css` die Darstellung. Originaltexte sind mit `lang="de"` gekennzeichnet.
- `assets/menus/` enthält beide PDFs als zusätzliche Downloads. Dokumentmetadaten wurden entfernt; die vier gerenderten Seiten sind pixelgleich mit den gelieferten Originalen. Die PDFs laden erst beim Öffnen oder Herunterladen.

Nach einer Kartenänderung die Quelldaten aktualisieren und `npm run render:menu` oder `npm run build` ausführen. Das erzeugte `speisekarte.html` mitcommitten, da GitHub Pages direkt aus dem Repository-Root veröffentlicht. Build bricht bei fehlenden Preisen oder doppelten Kategorien ab. Versionsparameter in Startseite, Karten-Vorlage und JS-Modulen konsistent erhöhen.

**Offene inhaltliche Prüfung durch das Team:** Die gelieferten Allergencodes sind widersprüchlich bzw. möglicherweise unvollständig, z. B. Eier bei „Vegan Lover“ und kein Milchcode bei „Classic“ trotz Frischkäse. Die Quellenkennzeichnungen werden unverändert übernommen, mit einem stets sichtbaren Hinweis vor der Allergenlegende. Fehlende Kennzeichnungen werden ausdrücklich nicht als Allergenfreiheit dargestellt. Keine Codes aus Zutaten abgeleitet. Bitte verbindlich vom Betreiber korrigieren lassen und anschließend beide Originalkarten und die JSON-Quelldaten aktualisieren. Weitere Quellenhinweise stehen in den jeweiligen JSON-Dateien unter `notes`.

## Logo

`assets/brand/` enthält die unveränderten schwarzen Vektorpfade aus der am 20.10.2026 gelieferten `STUDIO B.pdf`, ohne den leeren Seitenrand. `logo-mark.svg` zeigt Studio B mit Kreis im Kopf beider Seiten; `logo-full.svg` ergänzt die beiden Begleitzeilen im Abschluss der Startseite und wird dort per CSS weiß dargestellt. `favicon.svg` verwendet die vollständigen, separat vorhandenen B- und Kreispfade. Keine eingebetteten Schriften, Rasterbilder oder externen Verweise. Herkunft, Zuschnitt und Prüfsummen: `docs/logo-assets-2026-10-20.json`. Die Original-PDF bleibt außerhalb des öffentlichen Repositorys erhalten.
