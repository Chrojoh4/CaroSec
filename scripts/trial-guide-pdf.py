"""Create the illustrated, large-print hosted secretary guide from its Markdown source."""
import re,json
from pathlib import Path
from html import escape
from PIL import Image as PILImage
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether,PageBreak,Flowable
from reportlab.lib.utils import ImageReader
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/manual/trial-to-results-guide.md'
TARGET=ROOT/'output/pdf/CARO-Secretary-Trial-to-Results-Manual.pdf'
TARGET.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('Guide','arial.ttf'),('GuideBold','arialbd.ttf'),('GuideItalic','ariali.ttf')]:pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Guide',normal='Guide',bold='GuideBold',italic='GuideItalic',boldItalic='GuideBold')
GREEN=HexColor('#175b47');INK=HexColor('#193b32');MUTED=HexColor('#465e53');PALE=HexColor('#edf3ed')
body=ParagraphStyle('body',fontName='Guide',fontSize=12.25,leading=17,textColor=INK,spaceAfter=5,allowWidows=0,allowOrphans=0)
styles={'body':body,'title':ParagraphStyle('title',parent=body,fontName='GuideBold',fontSize=29,leading=35,textColor=GREEN,spaceAfter=17),'subtitle':ParagraphStyle('subtitle',parent=body,fontSize=18,leading=24,textColor=MUTED,spaceAfter=16),'chapter':ParagraphStyle('chapter',parent=body,fontName='GuideBold',fontSize=19,leading=24,textColor=GREEN,spaceAfter=10,keepWithNext=True),'caption':ParagraphStyle('caption',parent=body,fontSize=12,leading=15,textColor=MUTED,spaceBefore=6,spaceAfter=5),'callout':ParagraphStyle('callout',parent=body,backColor=PALE,borderPadding=8,spaceBefore=6,spaceAfter=11),'subheading':ParagraphStyle('subheading',parent=body,fontName='GuideBold',fontSize=13.5,leading=18,spaceBefore=7,spaceAfter=8,keepWithNext=True)}
crops=json.loads((SOURCE.parent/'screenshots/crops.json').read_text())
def clean(s):return s.translate(str.maketrans({'\u2013':'-','\u2014':'-','\u2011':'-','\u2019':"'",'\u2018':"'",'\u201c':'"','\u201d':'"'}))
def inline(s):
 s=escape(clean(s));s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s);s=re.sub(r'\[([^]]+)\]\((https?://[^)]+)\)',r'<link href="\2" color="#175b47">\1</link>',s)
 return s
class Screenshot(Flowable):
 def __init__(self,path,meta):
  super().__init__();self.path=path;self.iw,self.ih=PILImage.open(path).size;self.cx=meta.get('cropX',0);self.cy=meta.get('cropY',0);self.cw=meta.get('cropWidth',self.iw);self.ch=min(meta.get('cropHeight',self.ih),self.ih-self.cy);self.width=min(524,self.cw*.7);self.scale=self.width/self.cw;self.height=self.ch*self.scale;self.hAlign='CENTER'
 def draw(self):
  c=self.canv;c.saveState();p=c.beginPath();p.rect(0,0,self.width,self.height);c.clipPath(p,stroke=0,fill=0);c.drawImage(ImageReader(str(self.path)),-self.cx*self.scale,-(self.ih-self.cy-self.ch)*self.scale,width=self.iw*self.scale,height=self.ih*self.scale,mask='auto');c.restoreState()
class Guide(SimpleDocTemplate):
 def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.chapter_pages={}
 def afterFlowable(self,f):
  if isinstance(f,Paragraph) and f.style.name=='chapter':
   title=f.getPlainText();key='chapter-'+re.match(r'\d+',title).group();self.canv.bookmarkPage(key);self.canv.addOutlineEntry(title,key,0,False);self.chapter_pages[title]=self.page

def furniture(c,doc):
 c.saveState();c.setFillColor(GREEN);c.rect(0,756,612,36,fill=1,stroke=0);c.setFillColor(HexColor('#ffffff'));c.setFont('GuideBold',10);c.drawString(44,769,'CARO TRIAL SECRETARY  |  TRIAL SETUP TO RESULTS')
 c.setStrokeColor(HexColor('#bdcdc1'));c.line(44,37,568,37);c.setFillColor(MUTED);c.setFont('Guide',10);c.drawString(44,23,'Reviewed October 27, 2026  |  Illustrated training guide');c.drawRightString(568,23,str(doc.page));c.restoreState()
story=[];paragraph=[];figures=[]
def flush():
 if not paragraph:return
 text=' '.join(paragraph);paragraph.clear();style=styles['subheading'] if text.startswith('**') and text.endswith('**') and text.count('**')==2 else body
 story.append(Paragraph(inline(text),style))
for line in SOURCE.read_text(encoding='utf-8-sig').splitlines():
 if not line.strip():flush();continue
 if line.startswith('##manual-subtitle##'):
  flush();story.append(Paragraph(inline(line.replace('##manual-subtitle##','').strip()),styles['subtitle']));continue
 if line.startswith('# '):flush();story.append(Paragraph(inline(line[2:]),styles['title']));continue
 if line.startswith('## '):flush();story.append(PageBreak());story.append(Paragraph(inline(line[3:]),styles['chapter']));continue
 match=re.fullmatch(r'!\[([^]]+)\]\(([^)]+)\)',line)
 if match:
  flush();caption,relative=match.groups();path=SOURCE.parent/relative;meta=crops.get(path.stem,{});fig=Screenshot(path,meta);figures.append({'file':relative,'width_pt':fig.width,'height_pt':fig.height,'scale':fig.scale});story.append(KeepTogether([Spacer(1,6),fig,Paragraph(inline('Training view: '+caption),styles['caption'])]));continue
 if line.startswith('> '):flush();story.append(Paragraph(inline(line[2:]),styles['callout']));continue
 if re.match(r'^\d+\. ',line):flush();number,text=line.split('. ',1);story.append(KeepTogether([Paragraph('<b>'+number+'.</b> '+inline(text),body)]));continue
 paragraph.append(line)
flush()
doc=Guide(str(TARGET),pagesize=(612,792),rightMargin=44,leftMargin=44,topMargin=52,bottomMargin=52,title='CARO Secretary - Trial setup to results',author='CARO Secretary documentation',allowSplitting=True)
doc.build(story,onFirstPage=furniture,onLaterPages=furniture)
from pypdf import PdfReader
reader=PdfReader(TARGET)
audit={'pages':len(reader.pages),'chapters':doc.chapter_pages,'figures':figures,'body_points':12.25,'caption_points':12,'target':str(TARGET),'page_words':[len((p.extract_text() or '').split()) for p in reader.pages]}
(ROOT/'output/pdf/manual-layout-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
print(json.dumps(audit,indent=2))
