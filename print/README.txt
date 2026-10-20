STUDIO B · QR-ENTWÜRFE — NOCH NICHT ZUM DRUCK FREIGEGEBEN
Stand: 20. Oktober 2026

DRUCKSPERRE / VORAUSSETZUNG
Die neue Website und ihr Formular sind noch nicht auf studiob.bar veröffentlicht.
Der QR wird erst mit der neuen Website und ihrem Abschnitt id="reservieren"
nutzbar. Das Ziel wurde für diesen Entwurf angenommen; der Nutzer hat die
Basisdomain studiob.bar festgelegt, aber das endgültige QR-Ziel noch nicht.
Erst drucken, wenn das finale Ziel bestätigt, der Abschnitt auf der Live-Domain
erreichbar und eine Reservierungsanfrage bis zur Betreiber-E-Mail getestet ist.
Das QR-Decoding unten prüft den Inhalt des Codes, nicht diese Live-Funktion.
Die Dateien in studio-b-site-2026-10-20/print/ sind überholte Varianten auf Basis
von studiob030.de und dürfen nicht als freigegebene neue QR-Dateien benutzt werden.

ZIELE
Reservierung: https://studiob.bar/#reservieren
Startseite:   https://studiob.bar/

Kein Code führt auf eine private Vorschau. Beide Ziele sind die vom Nutzer jetzt
vorgegebene Basis studiob.bar. Der Reservierungsanker ist noch eine Annahme.
Die Dateien wurden nur lokal erzeugt und nicht als QR-Schilder ausgegeben.
Ein älterer Projekt-QR vom 6. September wurde zusätzlich dekodiert:
https://g.page/r/CSzx6gGtoX8lEBM/review
Dieser Code führte zu Google-Rezensionen. Ob er der vom Nutzer gemeinte alte QR
ist, ist nicht bestätigt. Ein Ersatz durch den Reservierungs-QR ändert den Zweck.
Ein gedruckter QR lässt sich nicht nachträglich ändern. Die neue Druckdatei muss
den alten Ausdruck physisch ersetzen.

DATEIEN
studio-b-reservieren-qr.svg    Vektor-QR für Reservierungsanfragen
studio-b-reservieren-qr.png    Hochauflösender QR, ganzzahlige Module
studio-b-reservieren-a6.pdf    A6-Hochformat, 105 × 148 mm, vektorbasiert
studio-b-reservieren-a6.png    Gerenderte Vorschau des identischen A6-PDFs
studio-b-startseite-qr.svg     Zweiter QR: offizielle Startseite
studio-b-startseite-qr.png     Zweiter QR: offizielle Startseite
verification.json             Exakte decodierte Ziele und bestandene Prüfungen

DRUCK
- A6-PDF bei 100 % / tatsächlicher Größe drucken. Keine Seitenanpassung.
- Für einen Tischaufsteller die 105 × 148 mm große Karte in einen A6-Halter stecken.
  Dies ist eine einzelne Einlegekarte, kein gefalztes Zelt.
- Für andere Formate SVG verwenden. QR mitsamt weißem Rand proportional skalieren.
- QR-Fläche im A6-Aufsteller: 53 × 53 mm inklusive mindestens vier weißer
  Randmodule auf allen Seiten. Schwarz auf Weiß, Fehlerkorrektur H, keine Logos.
- Den weißen Rand nicht abschneiden, überdrucken, einfärben oder überkleben.
- QR nach Möglichkeit mindestens 35 mm breit drucken, hoher Kontrast, mattes Papier.
- Erst einen Probeausdruck aus typischer Betrachtungsdistanz mit zwei Handys testen.
- PDF enthält keine Beschnittzugabe und ist für A6-Halter / Büro- oder Digitaldruck
  ausgelegt. Professionellen randabfallenden Druck mit der Druckerei abstimmen.
- Gedruckte Texte bezeichnen eine Anfrage; erst die Bestätigung des Betreibers
  macht eine Reservierung verbindlich.

ERZEUGUNG
Python-Abhängigkeiten: qrcode[pil]==8.2, reportlab, pypdfium2, zxing-cpp==2.3.0
Aus Projektordner: python scripts/generate-qr.py
Alternatives freigegebenes Ziel:
python scripts/generate-qr.py --reservation-url 'https://…'
Der Generator überschreibt diese Druckdateien reproduzierbar.
Auf macOS werden verfügbare Baskerville-, Gill-Sans- und Georgia-Schriften im PDF
eingebettet; auf anderen Systemen dienen PDF-Basisschriften als Fallback.

VERIFIKATION
PNG-Dateien werden mit ZXing-C++ decodiert. SVG-Module werden aus der gespeicherten
SVG-Datei rekonstruiert und ebenfalls decodiert. Das tatsächliche PDF wird mit
PDFium gerendert und anschließend decodiert. Die erzeugte Druckvorschau wurde
visuell kontrolliert. Der Decoder prüft die URL, nicht Verfügbarkeit, Inhalt,
Datenschutz oder E-Mail-Funktion der Zielseite.
