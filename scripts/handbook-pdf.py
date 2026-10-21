"""Render the source handbook without splitting short workflow sections."""
import re
from pathlib import Path
from html import escape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,KeepTogether,PageBreak
from reportlab.lib.enums import TA_LEFT

ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'output/pdf/secretary-handbook.pdf'
TARGET.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('Handbook','arial.ttf'),('HandbookBold','arialbd.ttf'),('HandbookItalic','ariali.ttf')]:
 pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Handbook',normal='Handbook',bold='HandbookBold',italic='HandbookItalic',boldItalic='HandbookBold')
INK=HexColor('#243c31');GREEN=HexColor('#294e3c');MUTED=HexColor('#4b5d53');LINE=HexColor('#c7d4cb')
styles={
 'title':ParagraphStyle('title',fontName='HandbookBold',fontSize=25,leading=31,textColor=GREEN,spaceAfter=16),
 'heading':ParagraphStyle('heading',fontName='HandbookBold',fontSize=16,leading=21,textColor=GREEN,spaceBefore=16,spaceAfter=11,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Handbook',fontSize=12.5,leading=18.5,textColor=INK,spaceAfter=11,alignment=TA_LEFT,allowWidows=0,allowOrphans=0),
 'intro':ParagraphStyle('intro',fontName='Handbook',fontSize=12.5,leading=18.5,textColor=INK,backColor=HexColor('#eef3ed'),borderPadding=12,spaceAfter=19),
}
def clean(text):
 return text.translate(str.maketrans({'\u2011':'-','\u2013':'-','\u2014':'-','\u2018':"'",'\u2019':"'"}))
def inline(text):
 text=escape(clean(text))
 text=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',text)
 text=re.sub(r'`(.+?)`',r'<font name="HandbookBold">\1</font>',text)
 return text
class Handbook(SimpleDocTemplate):
 def afterFlowable(self,flowable):
  if isinstance(flowable,Paragraph) and flowable.style.name=='heading':
   key='section-'+str(self.seq.nextf('section'));self.canv.bookmarkPage(key);self.canv.addOutlineEntry(flowable.getPlainText(),key,level=0)
def decoration(canvas,doc):
 canvas.saveState()
 if doc.page>1:
  canvas.setFont('HandbookBold',12);canvas.setFillColor(GREEN);canvas.drawString(48,758,'CARO Trial Secretary')
  canvas.setStrokeColor(LINE);canvas.line(48,747,564,747)
 canvas.setStrokeColor(LINE);canvas.line(48,43,564,43)
 canvas.setFont('Handbook',10);canvas.setFillColor(MUTED);canvas.drawString(48,28,'Working handbook');canvas.drawRightString(564,28,'Page '+str(doc.page));canvas.restoreState()
source=(ROOT/'docs/manual/secretary-handbook.md').read_text(encoding='utf-8')
blocks=re.split(r'\n\s*\n',source.strip());story=[];section=[];chapters=[]
def finish():
 if section:
  # These short workflow chapters fit a full page. Keep a chapter together
  # instead of starting it in the last few lines of the preceding page.
  chapters.append(section.copy());section.clear()
for index,block in enumerate(blocks):
 if block.startswith('# '):story.append(Paragraph(inline(block[2:]),styles['title']))
 elif block.startswith('## '):finish();section.append(Paragraph(inline(block[3:]),styles['heading']))
 elif index==1:story.append(Paragraph(inline(block),styles['intro']));story.append(Spacer(1,5))
 else:section.append(Paragraph(inline(block.replace('\n',' ')),styles['body']))
finish()
doc=Handbook(str(TARGET),pagesize=(612,792),leftMargin=48,rightMargin=48,topMargin=60,bottomMargin=60,title='CARO Trial Secretary - Working Handbook',author='CARO Trial Secretary project')
# Reserve paragraph spacing explicitly. KeepTogether alone can underestimate
# combined section spacing when several headings share a frame.
def height(flowable):
 return flowable.wrap(doc.width-12,100000)[1]+flowable.getSpaceBefore()+flowable.getSpaceAfter()
used=sum(height(item) for item in story)+24
for chapter in chapters:
 required=sum(height(item) for item in chapter)
 if used+required>doc.height-12:
  story.append(PageBreak());used=0
 story.extend(chapter);used+=required
doc.build(story,onFirstPage=decoration,onLaterPages=decoration)
print(TARGET)
