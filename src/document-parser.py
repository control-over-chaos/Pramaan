"""Bounded local parsing. Native text is not issuer authentication; OCR confidence is unknown."""
import sys,json,os,re,tempfile,subprocess,warnings
from pathlib import Path
from PIL import Image,ImageStat,ImageFilter,ImageOps
Image.MAX_IMAGE_PIXELS=25000000
warnings.simplefilter('error',Image.DecompressionBombWarning)
def ocr(image):
    if os.name!='nt': return {'text':'','lines':[], 'warning':'Local image OCR requires Windows OCR or a configured OCR provider.'}
    scratch=Path(os.environ.get('PRIVATE_STORAGE_DIR','storage'))/'.parser-tmp';scratch.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pramaan-ocr-',dir=scratch) as tmp:
        path=str((Path(tmp)/'page.png').resolve());image.thumbnail((2400,2400));image.convert('RGB').save(path)
        script=Path(__file__).with_name('native-ocr.ps1').read_text().split('\n',1)[1]
        run=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',"$ImagePath=$env:PRAMAAN_OCR_IMAGE;\n"+script],env={**os.environ,'PRAMAAN_OCR_IMAGE':path},capture_output=True,timeout=25)
        if run.returncode: return {'text':'','lines':[],'warning':'Local OCR unavailable; manual review is required.'}
        result=json.loads(run.stdout.decode('utf-8-sig'));result['text']='\n'.join(line['text'] for line in result.get('lines',[]));return result
def parse(path,mode='extract'):
    if mode.startswith('preview:'):
        import base64,io
        page=int(mode.split(':')[1])
        if not 1<=page<=20:raise ValueError('Page out of range')
        if Path(path).suffix.lower()=='.pdf':
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                if page>len(pdf.pages):raise ValueError('Page out of range')
                image=pdf.pages[page-1].to_image(resolution=100).original
        else:
            if page!=1:raise ValueError('Page out of range')
            image=Image.open(path);image.load()
        image.thumbnail((1600,2200));buf=io.BytesIO();image.convert('RGB').save(buf,format='PNG')
        return {'status':'VALID','image':base64.b64encode(buf.getvalue()).decode()}
    pages=[];quality=[]
    if Path(path).suffix.lower()=='.pdf':
        from pypdf import PdfReader
        reader=PdfReader(path,strict=True)
        if reader.is_encrypted: raise ValueError('Encrypted PDFs require an unlocked replacement.')
        if not 1<=len(reader.pages)<=20: raise ValueError('PDF must contain 1 to 20 pages.')
        if reader.trailer['/Root'].get('/OpenAction') or reader.trailer['/Root'].get('/AA'): raise ValueError('PDF active actions are not accepted.')
        names=reader.trailer['/Root'].get('/Names')
        if names and any(key in names.get_object() for key in ['/JavaScript','/EmbeddedFiles']): raise ValueError('PDF scripts and embedded attachments are not accepted.')
        import pdfplumber
        with pdfplumber.open(path) as pdf:
            for i,p in enumerate(pdf.pages):
                if p.width<=0 or p.height<=0 or p.width*p.height>4000000: raise ValueError('PDF page dimensions exceed the supported limit.')
                if reader.pages[i].get('/AA'): raise ValueError('PDF page actions are not accepted.')
                text=p.extract_text() or '';words=p.extract_words()[:10000]
                page={'page':i+1,'text':text[:50000],'width':p.width,'height':p.height,'words':words,'method':'PDF_TEXT','confidence':None}
                if mode=='extract' and len(text.strip())<20:
                    img=p.to_image(resolution=120).original
                    result=ocr(img);page.update(text=result['text'],words=result.get('lines',[]),method='WINDOWS_OCR',confidence=None)
                    if result.get('warning'):quality.append(result['warning'])
                pages.append(page)
    else:
        with Image.open(path) as im: im.verify()
        with Image.open(path) as im:
            im.load()
            if im.width*im.height>25000000: raise ValueError('Image exceeds 25 megapixels.')
            if min(im.size)<300:quality.append('Low-resolution image: provide a clearer scan.')
            gray=im.convert('L');gray.thumbnail((600,600))
            if ImageStat.Stat(gray).stddev[0]<3:quality.append('Very low contrast or blank image; manual review is required.')
            im=ImageOps.exif_transpose(im)
            page={'page':1,'width':im.width,'height':im.height,'text':'','words':[],'method':'WINDOWS_OCR','confidence':None}
            if mode=='extract':
                result=ocr(im.copy());page.update(text=result['text'],words=result.get('lines',[]))
                if result.get('warning'): quality.append(result['warning'])
            pages.append(page)
    fields=[]
    aliases={'certificate number':'certificate_number','certificate no':'certificate_number','registration number':'registration_number','registration no':'registration_number','institution name':'institution_name','address':'address','issue date':'issue_date','expiry date':'expiry_date','academic year':'academic_year'}
    for p in pages:
        for line in p['text'].splitlines():
            match=re.match(r'^\s*([^:]{2,50}):\s*(.{1,2000})$',line)
            if match and match[1].strip().lower() in aliases:
                matched=[w for w in p['words'] if isinstance(w,dict) and 'x0' in w and w.get('text','') in line.split()]
                box=[min(w['x0'] for w in matched),min(w['top'] for w in matched),max(w['x1'] for w in matched),max(w['bottom'] for w in matched)] if matched else None
                fields.append({'name':aliases[match[1].strip().lower()],'value':match[2].strip(),'confidence':p['confidence'],'page':p['page'],'location':json.dumps({'page':p['page'],'matchingText':line,'bbox':box,'units':'PDF points' if p['method']=='PDF_TEXT' else 'OCR pixels'},ensure_ascii=False),'method':p['method']})
    return {'status':'VALID','pageCount':len(pages),'pages':pages,'fields':fields,'qualityWarnings':list(set(quality)),'malwareScan':'NOT_CONFIGURED','scope':'Structural parsing and text extraction do not prove authenticity or absence of malware.'}
try:
    print(json.dumps(parse(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else 'extract'),ensure_ascii=True))
except Exception as error:
    print(json.dumps({'status':'INVALID','reason':str(error)[:300]}));sys.exit(2)
