# Studio B: Reservierungsanfragen per E-Mail

Stand: 20. Oktober 2026. Produktionsvorbereiteter Worker für die statische
Website `https://studiob.bar`. Noch nicht bereitgestellt, keine Zugangsdaten
hinterlegt und keine E-Mail versandt. Das alte WordPress-System wird nicht
verwendet.

## Ablauf und Bestätigung

Das Formular sendet eine Anfrage an `POST /reservations`. Der Worker validiert
die Angaben und einen Cloudflare-Turnstile-Token und übergibt genau eine
Text-E-Mail an Resend. Empfänger ist ausschließlich das serverseitig
konfigurierte Betreiberpostfach. „Antworten“ adressiert die angegebene
Gäste-E-Mail. Es gibt keinen frei wählbaren Empfänger und keinen automatischen
Mailversand an Gäste.

Der Besitzer prüft den Termin und antwortet persönlich. Eine erfolgreiche
API-Antwort bedeutet Annahme durch den Versanddienst, nicht bewiesenen
Postfacheingang und nicht die Zusage eines Tisches.

## Was noch fehlt

- **Bestätigung des gewünschten Reservierungspostfachs** für `RESERVATION_TO`.
  Die öffentliche Kontaktadresse `info@studiob030.de` ist keine bestätigte
  Zustelladresse für dieses neue System.
- Ein Resend-Projekt mit verifizierter Absenderdomain und API-Schlüssel.
- Cloudflare-Worker-Zugang und ein Turnstile-Widget für `studiob.bar`.
- Auf die tatsächliche Verarbeitung durch Cloudflare/Resend angepasste
  Datenschutzhinweise. Die bestehende Betreiberseite
  <https://studiob030.de/datenschutz/> wurde am 20. Oktober 2026 mit HTTP 200
  und dem Titel „Datenschutzerklärung | Studio B Berlin“ geprüft. Sie deckt
  diesen neuen technischen Ablauf nicht automatisch ab.
- Ein mit dem Betreiber abgestimmter Zustelltest und eine Prüfung der
  Absenderauthentifizierung/Spamablage vor der Freischaltung.

## Konfiguration und Bereitstellung

Diese Befehle sind eine Anleitung; sie wurden nicht ausgeführt.

1. In `server/` eine lokale Kopie von `wrangler.toml.example` als
   `wrangler.toml` anlegen. `ALLOWED_ORIGIN` bleibt exakt
   `https://studiob.bar`, ohne abschließenden Schrägstrich. `www.studiob.bar`
   leitet derzeit auf die Hauptdomain um.
2. Cloudflare-Zugang verbinden und nur bestätigte Werte als Secrets speichern:

   ```sh
   npx wrangler login
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put RESERVATION_TO
   npx wrangler secret put MAIL_FROM
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

   `MAIL_FROM` und `RESERVATION_TO` enthalten jeweils genau eine reine
   E-Mail-Adresse ohne Anzeigenamen. Der Absender muss bei Resend verifiziert
   sein. API-Schlüssel und Turnstile-Secret gehören niemals in
   Browser-JavaScript oder Git. Ohne einen dieser Werte verweigert der Worker
   den Versand mit HTTP 503.
3. Beim Turnstile-Widget `studiob.bar` als erlaubten Host eintragen.
   Im Frontend die Aktion `reservation` verwenden. Der Worker verlangt
   `success: true`, exakt diesen Host und exakt diese Aktion in der
   serverseitigen Turnstile-Antwort.
4. Nach Freigabe im Verzeichnis `server/`:

   ```sh
   npx wrangler deploy
   ```

5. Die erhaltene HTTPS-Worker-Adresse plus `/reservations` und den öffentlichen
   Turnstile-Sitekey in der Frontendkonfiguration setzen, beispielsweise:

   ```js
   window.STUDIO_B_CONFIG = {
     reservationEndpoint: 'https://WORKER.SUBDOMAIN.workers.dev/reservations',
     turnstileSiteKey: 'PUBLIC_SITE_KEY',
   };
   ```

   Platzhalter vor Freischaltung durch die tatsächlichen Werte ersetzen.
   `reservationEndpoint: ''` lässt die Vorschau aktiv und verschickt nichts.
   Der Adapter sendet außerdem nur, wenn die aktuelle Seiten-Origin exakt
   `https://studiob.bar` ist; lokale und fremde Vorschauen verschicken nichts.
6. Einen ausdrücklich vereinbarten Test an das bestätigte Betreiberpostfach
   durchführen: Anfrage absenden, Empfang und alle Daten kontrollieren,
   Antwortadresse prüfen und die manuelle Bestätigung erproben. API-Erfolg
   allein genügt nicht als Zustellnachweis.

Optional ergänzend: Cloudflare-Regeln für Rate Limits auf `/reservations`
einrichten. CORS allein ist kein Spam-Schutz; Turnstile ist deshalb bei jedem
Live-Versand zwingend. Keine Body-Erfassung in Workers-Logs, Traces oder
Fehlerreportern aktivieren. Die Beispielkonfiguration deaktiviert Observability.

## Request und Schutz

JSON mit ausschließlich diesen Feldern:

```js
{
  guests: 2,                 // Zahl oder ganzzahliger String: 1–20
  date: '2026-11-20',         // echter Kalendertag: heute bis 180 Tage voraus
  time: '18:30',             // 09:00–23:30, Schritte von 30 Minuten
  name: 'Example Guest',     // 2–100 Zeichen, keine Steuerzeichen
  phone: '+49 30 1234567',    // maximal 40 Zeichen, 7–15 Ziffern
  email: 'guest@example.invalid',
  note: '',                 // maximal 1000 Zeichen, Klartext
  website: '',              // unsichtbarer Honeypot
  language: 'de',            // de / en / tr
  requestId: '550e8400-e29b-41d4-a716-446655440000', // echte zufällige UUID v4
  turnstileToken: 'TOKEN_FROM_WIDGET'
}
```

Das Beispiel enthält Platzhalter; nicht an den Live-Endpunkt senden.
Die Zeitgrenzen sind Anfragegrenzen, keine behaupteten Öffnungszeiten oder
Zusagen zur Verfügbarkeit. Sie müssen mit dem Betreiber und den UI-Optionen
übereinstimmen. Bereits vergangene lokale Termine werden anhand von
`Europe/Berlin` einschließlich Sommer-/Winterzeit abgelehnt.

Der Worker begrenzt sowohl `Content-Length` als auch die tatsächlich
eingelesenen Bytes auf 8192. Er akzeptiert nur JSON, validiert Typen und
Feldgrenzen und schützt E-Mail-/Namensfelder gegen Header-Injection.
Gästedaten erscheinen ausschließlich in der Text-E-Mail und als Reply-To;
Absender, Empfänger und Betreffstruktur sind serverseitig festgelegt.
Unbekannte Requestfelder werden abgelehnt. Ein gefüllter Honeypot führt zu
einem Fehler, niemals zu einer vorgetäuschten Erfolgsmeldung.

Die Anwendung speichert keine Gästedaten, schreibt keine Bodies in Logs
und setzt keine eigenen Tracking-Cookies. E-Mail-Inhalte werden naturgemäß
an Resend und das Betreiberpostfach übertragen; deren Aufbewahrung und
Auftragsverarbeitung sind gesondert zu konfigurieren.

## Fehler, Wiederholungen und Idempotenz

- Erfolg: HTTP 200, `{success:true, requestId}` erst nach positiver
  Resend-Antwort mit E-Mail-ID.
- Fehler: `{success:false, error:CODE, deliveryUnknown:BOOLEAN}`.
  Providerantworten, Tokens und private Konfiguration werden nicht
  an den Browser zurückgespiegelt.
- Der Frontendadapter übersetzt Fehler auf Deutsch, Englisch oder Türkisch.
  Fehlertexte per `textContent` anzeigen.
- Kein automatischer Retry. Bei einem Timeout kann der Anbieter die
  Nachricht bereits angenommen haben. `deliveryUnknown:true` muss den Gast
  zum telefonischen Abgleich auffordern.
- Pro unveränderter Anfrage eine zufällige UUID v4 erzeugen und über manuelle
  Wiederholungsversuche beibehalten. Nach einem bestätigten Erfolg oder einer
  Änderung der Nutzdaten eine neue UUID verwenden. Persönliche Daten und
  Token nicht in Browser-Speicher schreiben.
- Für jeden manuellen Versuch einen frischen Turnstile-Token anfordern.
  Turnstile-Tokens sind nur einmal verwendbar. Die Anfrage-ID bleibt dabei
  gleich; der Token gehört nicht zur E-Mail-Nutzlast.
- Der Worker gibt `studio-b-reservation/<requestId>` als
  `Idempotency-Key` an Resend. Die Mail-Nutzlast enthält keinen wechselnden
  Zeitstempel und bleibt bei unveränderten Angaben identisch. Resend hält
  diese Schlüssel 24 Stunden vor. Das ist keine dauerhafte Deduplizierung.
  Eine Wiederholung nach mehr als 24 Stunden sollte telefonisch geklärt werden.
- Je Provider-Aufruf gilt ein Timeout von 10 Sekunden. Der Browseradapter
  wartet insgesamt höchstens 25 Sekunden.

## Tests

Im Repository-Hauptverzeichnis:

```sh
node --test tests/reservations.test.mjs
```

Alle externen Anfragen sind ersetzt. Es werden weder Turnstile-Tokens live
validiert noch E-Mails versandt. Die Tests decken Eingabegrenzen, Berlin-Zeit,
CORS, Spam-Schutz, feste Empfänger, Idempotenz und fehlgeschlagene
Providerantworten ab.

Offizielle technische Quellen, geprüft am 20. Oktober 2026:

- <https://resend.com/docs/api-reference/emails/send-email>
- <https://resend.com/docs/dashboard/emails/idempotency-keys>
- <https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>
- <https://developers.cloudflare.com/workers/configuration/secrets/>
