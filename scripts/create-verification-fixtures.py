from pathlib import Path
from reportlab.pdfgen import canvas
from pypdf import PdfReader,PdfWriter
from PIL import Image,ImageDraw,ImageFont
import json
root=Path(__file__).resolve().parents[1]/'test-fixtures'/'verification';root.mkdir(parents=True,exist_ok=True)
base={'Certificate number':'TEST-FIRE-001','Institution name':'Pramaan Test Institute','Address':'1 Test Road','Issue date':'2026-01-01','Expiry date':'2027-12-31'}
def pdf(name,values):
    c=canvas.Canvas(str(root/name));c.setTitle('CONTROLLED TEST ONLY - Fictional Fire NOC');c.setFont('Helvetica-Bold',16);c.drawString(50,790,'CONTROLLED TEST ONLY - NOT AN OFFICIAL NOC');c.setFont('Helvetica',12);c.drawString(50,760,'Fictional issuer: Pramaan local verification fixture')
    for index,(key,value) in enumerate(values.items()):c.drawString(50,715-index*32,f'{key}: {value}')
    c.drawString(50,470,'Use only to test software. This file grants no permission or approval.');c.save()
pdf('valid.pdf',base);pdf('expired.pdf',{**base,'Expiry date':'2025-12-31'});pdf('mismatch.pdf',{**base,'Institution name':'Different Test Institute'});pdf('corrected.pdf',base);pdf('unsupported.pdf',{'Example':'Unsupported artwork document'})
writer=PdfWriter();writer.append(PdfReader(root/'valid.pdf'));writer.encrypt('fixture-password');writer.write(root/'encrypted.pdf')
image=Image.new('RGB',(1500,1100),'white');draw=ImageDraw.Draw(image);font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',34)
draw.text((50,50),'CONTROLLED TEST ONLY - FICTIONAL FIRE NOC',font=font,fill='black')
for index,(key,value) in enumerate(base.items()):draw.text((50,180+index*90),f'{key}: {value}',font=font,fill='black')
image.save(root/'scanned.png');image.save(root/'scanned.pdf','PDF',resolution=120)
Image.new('RGB',(400,400),'white').save(root/'unreadable.png')
(root/'corrupt.pdf').write_bytes(b'%PDF-1.7\nthis is corrupt')
(root/'empty.pdf').write_bytes(b'')
(root/'expected.json').write_text(json.dumps({'assessmentDate':'2026-10-25','valid.pdf':'PASS for expiry; official source unavailable','expired.pdf':'FAIL for expiry','mismatch.pdf':'TEST_ONLY with mismatch in controlled source comparison','corrected.pdf':'New version; old checks must not apply','unsupported.pdf':'MANUAL_REVIEW','encrypted.pdf':'REJECT','corrupt.pdf':'REJECT','empty.pdf':'REJECT','scanned.pdf':'OCR then REVIEW_REQUIRED because native OCR confidence is unknown','unreadable.png':'MANUAL_REVIEW'},indent=2))
print(root)
