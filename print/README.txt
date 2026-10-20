STUDIO B · QR-DATEIEN

LIVE-ZIEL VOR DEM DRUCK PRÜFEN
Der Reservierungs-QR führt standardmäßig zum nativen Formular im Abschnitt
#reservieren auf studiob.bar. Die Formularsprachen sind DE, EN und TR.
Vor jeder Druckauflage den QR mit einem Smartphone scannen, das angezeigte Ziel
mit der URL unten abgleichen und das Formular auf der Live-Seite öffnen.
Erst drucken, wenn eine abgestimmte Testanfrage beim Betreiber-Postfach
angekommen ist. Eine technische Erfolgsmeldung allein belegt den Empfang nicht.
Das QR-Decoding prüft den Inhalt des Codes, nicht Formularfunktion oder
Mailzustellung. Die Erzeugung dieser Dateien erteilt keine Druckfreigabe.

ZIELE
Reservierung: https://studiob.bar/#reservieren
Startseite:   https://studiob.bar/

Beide Ziele verwenden die öffentliche Basisdomain studiob.bar.
Vor dem Ersetzen eines alten QR dessen Ziel prüfen: Ein Bewertungs-QR hat
einen anderen Zweck als dieser Reservierungs-QR.
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
PDFium gerendert und anschließend decodiert. Die erzeugte Druckvorschau vor
dem Druck visuell kontrollieren. Der Decoder prüft die URL, nicht Verfügbarkeit, Inhalt,
Datenschutz oder E-Mail-Funktion der Zielseite.
