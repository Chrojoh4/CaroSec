"""Large-print secretary working sheets. No calculated qualification or official-form claim."""
import json,sys,os
from pathlib import Path
if __package__:
 from .time_labels import timezone_label
else:
 from time_labels import timezone_label
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,KeepTogether,Flowable
styles={name:ParagraphStyle(name,fontName='Helvetica-Bold' if name!='body' else 'Helvetica',fontSize=size,leading=size+4,textColor=colors.HexColor('#183c30'),spaceAfter=8) for name,size in [('body',12),('title',18),('heading',14)]}
def p(text,style='body'):return Paragraph(escape(str(text or '')).replace('\n','<br/>'),styles[style])
def table(rows,widths):
 t=Table([[p(cell) for cell in row] for row in rows],colWidths=widths,hAlign='LEFT')
 t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#a7b8ab')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]));return t
class RunMarker(Flowable):
 def __init__(self,text):super().__init__();self.text=text;self.width=0;self.height=0
 def draw(self):self.canv._caro_context=self.text

def footer(c,doc):
 c.saveState();c.setFont('Helvetica',12);c.setFillColor(colors.HexColor('#43564c'));c.drawString(50,44,getattr(c,'_caro_context',''));c.setFont('Helvetica',10);c.drawString(50,26,'Working copy - verify against current CARO score sheet and signed judge record');c.drawRightString(562,26,str(doc.page));c.restoreState()

def build_judge_sheets(packet,target):
 target=Path(target);target.parent.mkdir(parents=True,exist_ok=True)
 story=[];first=True
 for event in packet['events']:
  for run in event['runs'] or [None]:
   if not first:story.append(PageBreak())
   first=False
   story.append(RunMarker(f"Round {event['round']} | Run {run['run'] if run else '-'} | Entry {run['entryId'] if run else 'No active entries'}"))
   story.extend([p('Judge working score sheet','title'),p(packet['title'],'heading'),p('FICTIONAL TEST TRIAL' if packet.get('fictional') else 'Secretary working layout - use current official CARO forms where required'),p(f"Trial {packet.get('trialNumber') or 'Not sanctioned'} | {packet['host']}"),p(f"{event['date']} | Round {event['round']} | {event['format'] if event['format']=='Working' else event['level']+' '+event['format']}"),p(f"Attending judge: {event.get('officiatingJudge') or event['judge']}"),p(f"Results credit: {event['judge']} | Timezone: {timezone_label(packet['timezone'])}")])
   if event['complete']:story.append(p('TRIAL RECORD COMPLETE - working reprint; do not overwrite signed results.'))
   if run is None:
    story.extend([Spacer(1,16),p('No active accepted runs in this event.','heading'),p('Secretary verification: ____________________   Date: ______________')]);continue
   story.append(p(f"Run {run['run']} | {'FEO' if run['feo'] else 'Competitive'} | Stream: {run.get('stream') or 'See exercise levels'}",'heading'))
   for i,dog in enumerate(run['dogs'],1):
    story.append(KeepTogether([p(f"Dog {i}: {dog['name']} | CARO ID: {dog['caroId']}"),p(f"Handler: {dog['handler']} | Breed: {dog['breed']}"),p(f"Shoulder: {dog['height']} | Jump: {dog['jumpHeight']} | Veteran: {'Yes' if dog['veteran'] else 'No'}")]))
   story.extend([p(run['accommodation']),Spacer(1,8)])
   if event['format']=='Working':
    rows=[['Selected exercise','Level','Judge outcome / notes']]+[[x['name'],x['level'],'Pass / Not Yet / FEO / Absent / Excused\n________________________'] for x in run['exercises']]
    story.append(table(rows,[200,75,237]))
   else:
    story.append(table([['Judge score','Deductions / observations'],['________________','____________________________________\n____________________________________\n____________________________________'],['Outcome: __________','Elapsed time: ______________________']],[170,342]))
   story.append(KeepTogether([Spacer(1,12),p('Comments and scoring details','heading'),table([['________________________________________________________________\n________________________________________________________________\n________________________________________________________________']],[512])]))
   story.append(KeepTogether([Spacer(1,14),p('Judge signature / initials: _______________________________________'),p('Transcribed by: ___________________   Checked by: ________________')]))
 temp=target.with_suffix('.pdf.next')
 class JudgeDocument(SimpleDocTemplate):
  def afterPage(self):footer(self.canv,self)
 JudgeDocument(str(temp),pagesize=(612,792),leftMargin=50,rightMargin=50,topMargin=36,bottomMargin=65,title='CARO judge working sheets',author='CARO Secretary').build(story)
 os.replace(temp,target)

if __name__=='__main__':
 sys.stdin.reconfigure(encoding='utf-8')
 build_judge_sheets(json.load(sys.stdin),sys.argv[1])
