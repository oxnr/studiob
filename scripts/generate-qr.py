#!/usr/bin/env python3
"""Generate Studio B QR originals, an A6 sign, and decode checks.

Install: python -m pip install 'qrcode[pil]==8.2' reportlab pypdfium2 zxing-cpp
Run:     python scripts/generate-qr.py
"""

import argparse
from datetime import date
import json
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw
import pypdfium2 as pdfium
import qrcode
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
import zxingcpp


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "print"
RESERVATION_URL = "https://studiob.bar/#reservieren"
HOME_URL = "https://studiob.bar/"
DARK = "#0C0B0B"
WARM = "#EFEAE4"
GOLD = "#B8965A"
BLACK = "#000000"
WHITE = "#FFFFFF"
BORDER = 4
PIXELS_PER_MODULE = 64


def make_code(url):
    code = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=PIXELS_PER_MODULE,
        border=BORDER,
    )
    code.add_data(url)
    code.make(fit=True)
    return code


def save_svg(matrix, path, label):
    size = len(matrix)
    svg = ET.Element(
        "svg",
        {
            "xmlns": "http://www.w3.org/2000/svg",
            "viewBox": f"0 0 {size} {size}",
            "width": "60mm",
            "height": "60mm",
            "role": "img",
            "aria-label": label,
            "shape-rendering": "crispEdges",
        },
    )
    ET.SubElement(svg, "title").text = label
    ET.SubElement(
        svg, "rect", {"width": str(size), "height": str(size), "fill": WHITE}
    )
    for y, row in enumerate(matrix):
        for x, is_dark in enumerate(row):
            if is_dark:
                ET.SubElement(
                    svg,
                    "rect",
                    {
                        "x": str(x),
                        "y": str(y),
                        "width": "1",
                        "height": "1",
                        "fill": BLACK,
                    },
                )
    ET.indent(svg)
    ET.ElementTree(svg).write(path, encoding="utf-8", xml_declaration=True)


def rasterize_svg(path):
    """Render this script's rectangular SVG primitives for a stored-file decode."""
    svg = ET.parse(path).getroot()
    units = int(svg.attrib["viewBox"].split()[-1])
    scale = 16
    image = Image.new("RGB", (units * scale, units * scale), WHITE)
    draw = ImageDraw.Draw(image)
    for rect in svg.findall("{http://www.w3.org/2000/svg}rect"):
        x = int(rect.get("x", 0)) * scale
        y = int(rect.get("y", 0)) * scale
        w = int(rect.get("width")) * scale
        h = int(rect.get("height")) * scale
        draw.rectangle((x, y, x + w - 1, y + h - 1), fill=rect.get("fill"))
    return image


def register_fonts():
    font_dir = Path("/System/Library/Fonts/Supplemental")
    definitions = {
        "StudioDisplay": ("Baskerville.ttc", "Times-Roman"),
        "StudioItalic": ("Georgia Italic.ttf", "Times-Italic"),
        "StudioSans": ("GillSans.ttc", "Helvetica"),
    }
    fonts = {}
    for name, (filename, fallback) in definitions.items():
        font_path = font_dir / filename
        if font_path.exists():
            pdfmetrics.registerFont(TTFont(name, str(font_path)))
            fonts[name] = name
        else:
            fonts[name] = fallback
    return fonts


def tracked_text(pdf, text, y, font, size, spacing=1.5):
    pdf.saveState()
    width = pdfmetrics.stringWidth(text, font, size) + spacing * (len(text) - 1)
    line = pdf.beginText((105 * mm - width) / 2, y * mm)
    line.setFont(font, size)
    line.setCharSpace(spacing)
    line.textOut(text)
    pdf.drawText(line)
    pdf.restoreState()


def save_sign(matrix, path, fonts):
    pdf = canvas.Canvas(str(path), pagesize=(105 * mm, 148 * mm), pageCompression=1)
    pdf.setTitle("Studio B – Ein Tisch. Gute Zeit.")
    pdf.setAuthor("Studio B")
    pdf.setSubject("A6-Aufsteller für Reservierungsanfragen")
    pdf.setFillColor(HexColor(DARK))
    pdf.rect(0, 0, 105 * mm, 148 * mm, fill=1, stroke=0)
    pdf.setStrokeColor(HexColor(GOLD))
    pdf.setFillColor(HexColor(GOLD))
    pdf.setLineWidth(0.4)
    pdf.rect(5 * mm, 5 * mm, 95 * mm, 138 * mm, fill=0, stroke=1)

    tracked_text(pdf, "KREUZBERG · BERLIN", 132, fonts["StudioSans"], 7.1, 1.7)
    pdf.setFillColor(HexColor(WARM))
    tracked_text(pdf, "STUDIO B", 117, fonts["StudioDisplay"], 32, 1.3)
    pdf.setFont(fonts["StudioItalic"], 15)
    pdf.drawCentredString(52.5 * mm, 105 * mm, "Ein Tisch. Gute Zeit.")
    pdf.line(44 * mm, 98 * mm, 61 * mm, 98 * mm)

    # Entire square includes four white modules on every side. No logo or overlay.
    side = 53 * mm
    left = (105 * mm - side) / 2
    bottom = 39 * mm
    module = side / len(matrix)
    pdf.setFillColor(HexColor(WHITE))
    pdf.rect(left, bottom, side, side, fill=1, stroke=0)
    pdf.setFillColor(HexColor(BLACK))
    for y, row in enumerate(matrix):
        for x, is_dark in enumerate(row):
            if is_dark:
                pdf.rect(
                    left + x * module,
                    bottom + (len(matrix) - y - 1) * module,
                    module,
                    module,
                    fill=1,
                    stroke=0,
                )

    pdf.setFillColor(HexColor(WARM))
    pdf.setFont(fonts["StudioSans"], 12)
    pdf.drawCentredString(52.5 * mm, 30 * mm, "Scannen & Tisch anfragen")
    pdf.setFont(fonts["StudioSans"], 7.4)
    pdf.drawCentredString(52.5 * mm, 24.3 * mm, "Verbindlich erst nach unserer Bestätigung.")
    pdf.setLineWidth(0.3)
    pdf.line(31 * mm, 19.5 * mm, 74 * mm, 19.5 * mm)
    pdf.setFont(fonts["StudioSans"], 8.2)
    pdf.drawCentredString(52.5 * mm, 13.8 * mm, "Oranienstraße 168 · 10999 Berlin")
    pdf.setFont(fonts["StudioSans"], 8.2)
    pdf.drawCentredString(52.5 * mm, 9.3 * mm, "030 67392575  ·  studiob.bar")
    pdf.showPage()
    pdf.save()


def decode(image, expected, filename):
    result = zxingcpp.read_barcodes(image)
    values = [item.text for item in result]
    if values != [expected]:
        raise RuntimeError(f"{filename}: expected exactly {expected!r}, got {values!r}")
    return {"file": filename, "decoded_url": values[0], "result": "PASS"}


def write_readme(reservation_url, home_url):
    (OUTPUT / "README.txt").write_text(
        f"""STUDIO B · QR-DATEIEN

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
Reservierung: {reservation_url}
Startseite:   {home_url}

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
""",
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reservation-url", default=RESERVATION_URL)
    parser.add_argument("--home-url", default=HOME_URL)
    args = parser.parse_args()
    for url in [args.reservation_url, args.home_url]:
        if not url.startswith("https://studiob.bar/"):
            parser.error("QR destinations must use the user-selected https://studiob.bar/ domain.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    checks = []
    codes = {}
    for name, url, label in [
        ("reservieren", args.reservation_url, "Studio B – Tisch anfragen"),
        ("startseite", args.home_url, "Studio B – offizielle Website"),
    ]:
        code = make_code(url)
        matrix = code.get_matrix()
        codes[name] = matrix
        png_name = f"studio-b-{name}-qr.png"
        svg_name = f"studio-b-{name}-qr.svg"
        code.make_image(fill_color=BLACK, back_color=WHITE).save(
            OUTPUT / png_name, dpi=(600, 600)
        )
        save_svg(matrix, OUTPUT / svg_name, label)
        checks.append(decode(Image.open(OUTPUT / png_name), url, png_name))
        checks.append(decode(rasterize_svg(OUTPUT / svg_name), url, svg_name))
    pdf_name = "studio-b-reservieren-a6.pdf"
    save_sign(codes["reservieren"], OUTPUT / pdf_name, register_fonts())
    document = pdfium.PdfDocument(OUTPUT / pdf_name)
    preview = document[0].render(scale=300 / 72).to_pil()
    preview.save(OUTPUT / "studio-b-reservieren-a6.png", dpi=(300, 300))
    checks.append(decode(preview, args.reservation_url, pdf_name))
    (OUTPUT / "verification.json").write_text(
        json.dumps(
            {
                "generated_for_date": date.today().isoformat(),
                "release_status": "REQUIRES_LIVE_VERIFICATION",
                "release_gate": "Before printing, scan the QR, verify the live native reservation form, and confirm actual receipt of a test request in the owner's inbox.",
                "error_correction": "H",
                "quiet_zone_modules": BORDER,
                "a6_size_mm": [105, 148],
                "a6_qr_size_mm": 53,
                "reservation_matrix_modules_including_border": len(codes["reservieren"]),
                "checks": checks,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    write_readme(args.reservation_url, args.home_url)
    print(f"Generated QR originals and A6 print files in {OUTPUT}.")
    print(f"Decode checks: {len(checks)}/{len(checks)} passed.")


if __name__ == "__main__":
    main()
