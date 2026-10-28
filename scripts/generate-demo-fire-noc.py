from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "demo-registry"
OUT.mkdir(parents=True, exist_ok=True)
PNG = OUT / "DEMO-FIRE-NOC-011.png"
PDF = OUT / "DEMO-FIRE-NOC-011.pdf"

W, H = 1500, 2121
NAVY = (15, 39, 75)
BLUE = (26, 86, 151)
SAFFRON = (226, 143, 28)
GREEN = (27, 132, 91)
INK = (35, 52, 72)
MUTED = (96, 112, 132)
RED = (172, 45, 48)
PAPER = (250, 249, 245)

FONT_DIR = Path("C:/Windows/Fonts")
FONT_REGULAR = FONT_DIR / "segoeui.ttf"
FONT_BOLD = FONT_DIR / "segoeuib.ttf"

def font(size, bold=False):
    candidate = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default()

image = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(image)

# Restrained Indian tricolour linework and a document-style frame; no government emblems or seals.
draw.rectangle((0, 0, W, 24), fill=SAFFRON)
draw.rectangle((0, 24, W, 36), fill=(255, 255, 255))
draw.rectangle((0, 36, W, 60), fill=GREEN)
draw.rounded_rectangle((46, 78, W - 46, H - 48), radius=22, outline=NAVY, width=4)
draw.rounded_rectangle((62, 94, W - 62, H - 64), radius=18, outline=(214, 222, 231), width=2)

draw.rounded_rectangle((96, 126, 196, 226), radius=22, fill=NAVY)
draw.polygon([(146, 145), (177, 158), (171, 192), (146, 210), (121, 192), (115, 158)], outline=(255,255,255), fill=BLUE)
draw.line((132, 177, 143, 188, 163, 165), fill=(255,255,255), width=7)
draw.text((226, 125), "PRAMAAN · SYNTHETIC TEST FIXTURE", fill=NAVY, font=font(34, True))
draw.text((228, 174), "FIRE SAFETY DOCUMENT REVIEW SAMPLE", fill=MUTED, font=font(25))

draw.rounded_rectangle((96, 260, W - 96, 342), radius=14, fill=(255, 239, 237), outline=(227, 177, 171), width=2)
draw.text((126, 278), "DEMO ONLY  ·  NOT A FIRE NOC  ·  NOT VALID FOR SUBMISSION", fill=RED, font=font(28, True))

draw.text((100, 380), "Fire Safety Record", fill=NAVY, font=font(58, True))
draw.text((102, 455), "For Pramaan upload, extraction and review workflow testing", fill=MUTED, font=font(27))

# Large diagonal repeated watermark makes the mock status visible even when cropped.
watermark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
wm = ImageDraw.Draw(watermark)
wm_font = font(82, True)
for y in (700, 1220, 1740):
    wm.text((80, y), "SYNTHETIC DEMO · NO LEGAL EFFECT", font=wm_font, fill=(170, 38, 38, 28))
watermark = watermark.rotate(0, resample=Image.Resampling.BICUBIC)
image = Image.alpha_composite(image.convert("RGBA"), watermark).convert("RGB")
draw = ImageDraw.Draw(image)

fields = [
    ("Certificate number", "DEMO-FIRE-2026-011"),
    ("Registration number", "DEMO-REG-011"),
    ("Institution name", "IIT Bombay"),
    ("Address", "Mumbai"),
    ("Issue date", "2026-04-01"),
    ("Expiry date", "2027-03-31"),
]
left, right = 100, W - 100
top = 552
row_h = 114
draw.rounded_rectangle((left, top, right, top + len(fields) * row_h + 32), radius=18, fill=(255,255,255), outline=(211,220,230), width=2)
for index, (label, value) in enumerate(fields):
    y = top + 22 + index * row_h
    if index:
        draw.line((left + 24, y - 10, right - 24, y - 10), fill=(231,235,240), width=2)
    draw.text((left + 28, y + 2), f"{label}:", fill=MUTED, font=font(22, True))
    draw.text((left + 350, y - 1), value, fill=INK, font=font(29, True))

box_y = top + len(fields) * row_h + 84
draw.rounded_rectangle((left, box_y, right, box_y + 267), radius=18, fill=(241,246,251), outline=(206,219,233), width=2)
draw.text((left + 28, box_y + 26), "TEST SCENARIO — NOT AN INSPECTION OR APPROVAL", fill=BLUE, font=font(25, True))
scenario_lines = [
    "Building: Academic Block A (illustrative scope only)",
    "Occupancy label: Educational (Group B) — test label only",
    "Height band: under 15 m — hypothetical; not an IIT Bombay measurement",
    "Mock source state: NOT CONNECTED / NOT AUTHENTICATED",
]
for i, line in enumerate(scenario_lines):
    draw.text((left + 32, box_y + 80 + i * 42), "• " + line, fill=INK, font=font(22))

notice_y = box_y + 302
draw.text((left + 2, notice_y), "Important", fill=RED, font=font(25, True))
notice = [
    "This is fictional test data, not issued by IIT Bombay, Mumbai Fire Brigade,",
    "Maharashtra Fire & Emergency Services, or any licensed fire agency. No",
    "signature, seal, inspection, equipment condition, or legal approval is represented.",
    "Actual fire-system requirements depend on the building, height, occupancy,",
    "approved Fire Safety Approval and competent local authority requirements.",
]
for i, line in enumerate(notice):
    draw.text((left + 2, notice_y + 42 + i * 36), line, fill=MUTED, font=font(20))

footer_y = H - 148
draw.line((left, footer_y - 18, right, footer_y - 18), fill=(211,220,230), width=2)
draw.text((left, footer_y), "PRAMAAN UAT FIXTURE  •  DEMO-FIRE-NOC-011", fill=NAVY, font=font(19, True))
draw.text((right - 500, footer_y), "NOT VALID · DO NOT RELY ON", fill=RED, font=font(19, True))
image.save(PNG, format="PNG", optimize=True)

# Searchable companion PDF mirrors the PNG's synthetic warning and exact parser field labels.
pdf = canvas.Canvas(str(PDF), pagesize=A4, pageCompression=1)
page_w, page_h = A4
pdf.setTitle("DEMO Fire Safety Document — Not a Fire NOC")
pdf.setAuthor("Pramaan synthetic test fixture")
pdf.setSubject("Fictional test data; not an official certificate or safety approval")
pdf.setFillColorRGB(*[v / 255 for v in NAVY]); pdf.rect(0, page_h - 19, page_w, 19, fill=1, stroke=0)
pdf.setFillColorRGB(*[v / 255 for v in SAFFRON]); pdf.rect(0, page_h - 7, page_w / 3, 7, fill=1, stroke=0)
pdf.setFillColorRGB(*[v / 255 for v in GREEN]); pdf.rect(2 * page_w / 3, page_h - 7, page_w / 3, 7, fill=1, stroke=0)
pdf.setFillColorRGB(*[v / 255 for v in NAVY]); pdf.setFont("Helvetica-Bold", 15); pdf.drawString(42, page_h - 56, "PRAMAAN · SYNTHETIC TEST FIXTURE")
pdf.setFillColorRGB(*[v / 255 for v in RED]); pdf.setFont("Helvetica-Bold", 10); pdf.drawString(42, page_h - 78, "DEMO ONLY — NOT A FIRE NOC — NOT VALID FOR SUBMISSION")
pdf.setFillColorRGB(*[v / 255 for v in NAVY]); pdf.setFont("Helvetica-Bold", 22); pdf.drawString(42, page_h - 117, "Fire Safety Record")
pdf.setFillColorRGB(*[v / 255 for v in MUTED]); pdf.setFont("Helvetica", 10); pdf.drawString(42, page_h - 136, "For Pramaan upload, extraction and review workflow testing")

y = page_h - 185
pdf.setStrokeColorRGB(0.82, 0.86, 0.90); pdf.roundRect(38, y - 218, page_w - 76, 230, 10, stroke=1, fill=0)
for label, value in fields:
    pdf.setFillColorRGB(*[v / 255 for v in MUTED]); pdf.setFont("Helvetica-Bold", 9); pdf.drawString(54, y, label + ":")
    pdf.setFillColorRGB(*[v / 255 for v in INK]); pdf.setFont("Helvetica-Bold", 11); pdf.drawString(205, y, value)
    y -= 33

y -= 12
pdf.setFillColorRGB(*[v / 255 for v in BLUE]); pdf.setFont("Helvetica-Bold", 11); pdf.drawString(42, y, "TEST SCENARIO — NOT AN INSPECTION OR APPROVAL")
y -= 22
pdf.setFillColorRGB(*[v / 255 for v in INK]); pdf.setFont("Helvetica", 9)
for line in [
    "Building: Academic Block A (illustrative scope only)",
    "Occupancy label: Educational (Group B) — test label only",
    "Height band: under 15 m — hypothetical; not an IIT Bombay measurement",
    "Mock source state: NOT CONNECTED / NOT AUTHENTICATED",
]:
    pdf.drawString(52, y, "• " + line); y -= 16

y -= 7
pdf.setFillColorRGB(*[v / 255 for v in RED]); pdf.setFont("Helvetica-Bold", 10); pdf.drawString(42, y, "IMPORTANT — FICTIONAL TEST DATA")
y -= 18
pdf.setFillColorRGB(*[v / 255 for v in MUTED]); pdf.setFont("Helvetica", 8.5)
for line in [
    "Not issued by IIT Bombay, Mumbai Fire Brigade, Maharashtra Fire & Emergency Services, or a licensed fire agency.",
    "No signature, seal, inspection, equipment condition, or legal approval is represented.",
    "Actual fire-system requirements depend on the building, height, occupancy, approved Fire Safety Approval,",
    "and competent local authority requirements. DO NOT SUBMIT OR RELY ON THIS SAMPLE.",
]:
    pdf.drawString(42, y, line); y -= 14

pdf.setStrokeColorRGB(0.82, 0.86, 0.90); pdf.line(42, 47, page_w - 42, 47)
pdf.setFillColorRGB(*[v / 255 for v in RED]); pdf.setFont("Helvetica-Bold", 9); pdf.drawString(42, 32, "NOT VALID · PRAMAAN UAT FIXTURE · DEMO-FIRE-NOC-011")
pdf.showPage(); pdf.save()

print(f"Generated {PNG.name} and {PDF.name} (fictional, prominently marked test fixtures).")
