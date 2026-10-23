"""Readable secretary premium export; no submission or publication side effects."""
import json, sys, os, re
from pathlib import Path
if __package__:
 from .time_labels import timezone_label
else:
 from time_labels import timezone_label
from xml.sax.saxutils import escape
from urllib.parse import urlparse,quote
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,KeepTogether,CondPageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors

sys.stdin.reconfigure(encoding='utf-8')
data=json.load(sys.stdin)
target=Path(sys.argv[1]);target.parent.mkdir(parents=True,exist_ok=True)
green=colors.HexColor('#164b3c');ink=colors.HexColor('#183c31');gold=colors.HexColor('#a5792b')
styles={
 'body':ParagraphStyle('Body',fontName='Helvetica',fontSize=12,leading=16,textColor=ink,spaceAfter=6,allowWidows=0,allowOrphans=0),
 'title':ParagraphStyle('Title',fontName='Helvetica-Bold',fontSize=27,leading=33,textColor=green,spaceAfter=10,keepWithNext=True),
 'heading':ParagraphStyle('Heading',fontName='Helvetica-Bold',fontSize=16,leading=21,textColor=green,spaceBefore=11,spaceAfter=6,keepWithNext=True),
 'sub':ParagraphStyle('Subheading',fontName='Helvetica-Bold',fontSize=12,leading=17,textColor=green,spaceBefore=5,spaceAfter=4,keepWithNext=True),
 'notice':ParagraphStyle('Notice',fontName='Helvetica-Bold',fontSize=12,leading=17,textColor=green,backColor=colors.HexColor('#edf2e7'),borderPadding=8,spaceBefore=6,spaceAfter=10),
}
def p(value,style='body'):return Paragraph(escape(str(value or '')).replace('\n','<br/>'),styles[style])
story=[]
def section(title,value):
 if value:
  parts=re.split(r'\n\s*\n',str(value))
  if len(parts)==1 and len(str(value))<=1200:story.append(KeepTogether([p(title,'heading'),p(value)]))
  else:
   story.append(p(title,'heading'))
   for paragraph in parts:story.append(KeepTogether([p(paragraph)]) if len(paragraph)<=1200 else p(paragraph))
def safe_url(value):
 try:return value if urlparse(value).scheme in ('https','http') and urlparse(value).netloc else None
 except:return None
def link(label,value):
 url=safe_url(value)
 if url and not data.get('fictional'):story.append(Paragraph(escape(label)+': <link href="'+escape(url,{'"':'&quot;'})+'" color="#164b3c"><u>'+escape(url)+'</u></link>',styles['body']))
 else:story.append(p(label+': not open / not configured in this preview.'))
def table(rows,widths):
 t=Table(rows,colWidths=widths,repeatRows=1,hAlign='LEFT',splitByRow=1,splitInRow=1)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf2e7')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,-1),.5,colors.HexColor('#bfcec4'))]))
 return t

story.extend([p('CARO · TRIAL PREMIUM','sub'),p(data.get('title'),'title')])
notice='FICTIONAL TEST TRIAL — no real entries, payments or CARO submission.' if data.get('fictional') else ('CARO trial '+str(data.get('trialNumber',''))+' · Secretary reviewed premium' if data.get('publicationReady') else 'SECRETARY PREVIEW — verify approval, fees, agreement and entry links before distribution.')
story.append(p(notice,'notice'))
story.append(p(str(data.get('date',''))+' to '+str(data.get('endDate') or data.get('date',''))+' · '+timezone_label(data.get('timezone')),'sub'))
story.extend([p(data.get('host')),p(data.get('venue'))])
address=str(data.get('address') or '').strip()
if address:
 map_url='https://www.google.com/maps/search/?api=1&query='+quote(address,safe='')
 story.append(Paragraph('<link href="'+escape(map_url,{'"':'&quot;'})+'" color="#164b3c"><u>'+escape(address)+'</u></link>',styles['body']))

story.append(HRFlowable(width='100%',thickness=2,color=gold,spaceBefore=8,spaceAfter=12))
section('Welcome',data.get('intro'))
story.append(p('Entry essentials','heading'))
story.append(p('Opens: '+str(data.get('opens') or 'To be confirmed')+' · Closes: '+str(data.get('closes') or 'To be confirmed')))
story.append(p('Entry limit: '+str(data.get('capacity') or 'Confirm with the secretary')))
story.append(p('Secretary: '+str(data.get('secretary',''))+' · '+str(data.get('email',''))))
story.append(p('Trial chair: '+str(data.get('chair',''))))
link('Online entry form',data.get('entryUrl'))
link('Download email / paper entry form',data.get('entryPdfUrl'))
section('Email and paper entry instructions',data.get('paperEntryInstructions') or ('Return the completed entry form to '+data.get('email','the trial secretary')+'. Confirm the stated closing date and payment instructions.'))
story.extend([CondPageBreak(95),p('Offered events and judges','heading')])
for event in data.get('events',[]):
 label=event.get('format') if event.get('format')=='Working' else str(event.get('level',''))+' '+str(event.get('format',''))
 story.append(p('Round '+str(event.get('round',''))+' · '+str(event.get('dayId') or data.get('date',''))+' · '+str(label),'sub'))
 story.append(p('Judge: '+str(event.get('judge',''))+' · Streams / levels: '+str(event.get('stream',''))))
 if event.get('exercises'):story.append(p('Working exercises: '+str(event['exercises'])))
story.append(p('Entry fees · Canadian dollars','heading'))
rows=[[p('Fee / pricing unit','sub'),p('CAD','sub')]]
for fee in data.get('fees',[]):rows.append([p(str(fee.get('label',''))+'\n'+str(fee.get('unit',''))),p('$'+format(fee.get('cents',0)/100,'.2f'))])
story.append(table(rows,[412,100]))
for title,key in [('Payment instructions','payment'),('Entry confirmations','confirmations'),('Schedule and arrival','timing'),('Day-of entries','dayOf'),('Running order','orderNote'),('Facilities','facilities'),('Accessibility and accommodations','accommodations'),('Awards','awards'),('Move-ups','moveups'),('Withdrawals and refunds','refunds'),('Site rules','siteRules'),('Host agreement — read before entering','waiver')]:section(title,data.get(key))
story.append(Spacer(1,12));story.append(p('Questions? Contact '+str(data.get('secretary','the trial secretary'))+' at '+str(data.get('email','the listed address'))+'.'))
def footer(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(gold);canvas.line(50,44,562,44);canvas.setFont('Helvetica',10);canvas.setFillColor(ink);canvas.drawString(50,28,'CARO Trial Secretary · '+('Fictional practice premium' if data.get('fictional') else 'Secretary preview'));canvas.drawRightString(562,28,'Page '+str(doc.page));canvas.restoreState()
temp=target.with_suffix('.pdf.next')
SimpleDocTemplate(str(temp),pagesize=(612,792),leftMargin=50,rightMargin=50,topMargin=36,bottomMargin=58,title=str(data.get('title','Trial premium')),author='CARO Trial Secretary').build(story,onFirstPage=footer,onLaterPages=footer)
os.replace(temp,target)
