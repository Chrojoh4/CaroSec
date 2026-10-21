"""Generate a readable interactive entry form; keep rows and event groups intact."""
import json,sys,os
from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor,white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
sys.stdin.reconfigure(encoding='utf-8')
trial=json.load(sys.stdin);target=Path(sys.argv[1]);target.parent.mkdir(parents=True,exist_ok=True)
temporary=target.with_suffix('.pdf.next');c=canvas.Canvas(str(temporary),pagesize=(612,792))
c.setTitle(f"{trial['title']} - Entry form")
GREEN=HexColor('#294e3c');INK=HexColor('#334b3e');MUTED=HexColor('#4f6250');LINE=HexColor('#c3cebc');PALE=HexColor('#f5f6ed')
style=ParagraphStyle('body',fontName='Helvetica',fontSize=12,leading=17,textColor=INK)
y=0;fields=[]
def clean(value):return str(value or '').translate(str.maketrans({'\u2011':'-','\u2013':'-','\u2014':'-','\u2197':'','\u2192':'','\u2022':'-'}))
def para(value,width=508):return Paragraph(escape(clean(value)).replace('\n','<br/>'),style)
def footer():
 c.setStrokeColor(LINE);c.line(52,43,560,43);c.setFont('Helvetica',10);c.setFillColor(MUTED)
 c.drawString(52,28,'Entry form - '+clean(trial.get('trialNumber') or 'Private sample'));c.drawRightString(560,28,f'Page {c.getPageNumber()}')
def page():
 global y
 if y:footer();c.showPage()
 c.setFillColor(GREEN);c.rect(0,680,612,112,fill=1,stroke=0);c.setFillColor(white)
 c.setFont('Helvetica-Bold',12);c.drawString(52,766,'CARO TRIAL ENTRY FORM'+(' - FICTIONAL SAMPLE' if trial.get('fictional') else ''))
 title=Paragraph(escape(clean(trial['title'])),ParagraphStyle('title',fontName='Times-Roman',fontSize=24,leading=26,textColor=white))
 _,h=title.wrap(508,60);title.drawOn(c,52,746-h)
 c.setFont('Helvetica',12);c.drawString(52,696,clean(trial['date'])+(' to '+clean(trial['endDate']) if trial.get('endDate') and trial['endDate']!=trial['date'] else '')+' | '+clean(trial.get('trialNumber') or 'Approval pending / sample'))
 y=654

def ensure(height):
 if y-height<61:page()
def section(title,keep=80):
 global y
 ensure(keep+38);c.setFillColor(GREEN);c.setFont('Times-Roman',18);c.drawString(52,y,clean(title));y-=32

def note(value):
 global y
 if not value:return
 remaining=para(value)
 while remaining:
  _,h=remaining.wrap(508,10000)
  if h<=y-61:remaining.drawOn(c,52,y-h);y-=h+14;return
  available=y-69
  parts=remaining.split(508,available) if available>=40 else []
  if not parts:page();continue
  first=parts[0];_,h=first.wrap(508,available);first.drawOn(c,52,y-h);y-=h+14
  remaining=parts[1] if len(parts)>1 else None
  if remaining:page();section('Continued',40)

def row(specs):
 global y
 # Each spec: name,label,x,width, optional offered choices or multiline height.
 labels=[para(spec[1]) for spec in specs]
 heights=[label.wrap(spec[3],1000)[1] for label,spec in zip(labels,specs)]
 labelh=max(heights);boxh=max([spec[5] if len(spec)>5 else 30 for spec in specs]);ensure(labelh+boxh+24)
 for label,h,spec in zip(labels,heights,specs):
  name,description,x,width=spec[:4];label.drawOn(c,x,y-h);bottom=y-labelh-8-boxh
  common=dict(name=name,tooltip=clean(description),x=x,y=bottom,width=width,height=boxh,fontName='Helvetica',fontSize=12,borderColor=LINE,fillColor=PALE,textColor=INK,forceBorder=True)
  if len(spec)>4 and spec[4]:c.acroForm.choice(**common,options=['Select...']+spec[4],value='Select...')
  else:c.acroForm.textfield(**common,borderWidth=.8,fieldFlags='multiline' if boxh>30 else '',maxlen=2000 if boxh>30 else 250)
  fields.append(name)
 y-=labelh+boxh+24

def check(name,label):
 global y
 p=para(label);_,h=p.wrap(480,1000);ensure(h+15)
 c.acroForm.checkbox(name=name,tooltip=clean(label),x=53,y=y-15,size=15,borderColor=GREEN,fillColor=white,textColor=GREEN,buttonStyle='check',checked=False,forceBorder=True)
 p.drawOn(c,80,y-h);fields.append(name);y-=max(h,17)+14

def dog(prefix,title):
 section(title,140)
 row([(prefix+'_name','Dog call name',52,240),(prefix+'_caro','CARO ID (keep leading zeros)',320,240)])
 row([(prefix+'_owner','Owner (if different from handler)',52,508)])
 row([(prefix+'_breed','Breed / mix',52,240),(prefix+'_dob','Birth date (YYYY-MM-DD)',320,240)])
 row([(prefix+'_height','Height at withers (include unit)',52,240),(prefix+'_jump','Jump height',320,240)])
 check(prefix+'_veteran','Veteran')

page();section('1. Handler & contact',150)
row([('handler_name','Handler name',52,240),('handler_email','Email address',320,240)])
row([('handler_phone','Phone number',52,240),('handler_address','Mailing address',320,240)])
dog('dog1','2. Your dog')
has_partner=any(e['format'] in ('Team','Brace') for e in trial['events'])
if has_partner:
 dog('dog2','3. Partner dog - Team / Brace only')
 row([('partner_handler','Partner handler (Brace: same handler as above)',52,508)])
 note('Team has two handlers and two dogs; Brace has one handler and two dogs. For a bye dog, contact the secretary rather than entering CARO ID 2799 as an owned dog.')
section(('4' if has_partner else '3')+'. Choose your events',190)
note('Tick each event you wish to enter. Select an offered stream or Working exercise level. FEO applies to the entire round. Complete both dogs for Team / Brace. Fees are in CAD; check per-dog or per-exercise units.')
for event in trial['events']:
 # Keep the full event block on one page, including all offered exercises.
 count=len(event['exercises']) if event['format']=='Working' else 1
 fee=f"Competitive ${event['fee']['cents']/100:.2f} per {event['basis']}"
 if event.get('feoFee'):fee+=f"; FEO ${event['feoFee']['cents']/100:.2f} per {event['basis']}"
 details=fee+'. Judge: '+event['judge']
 _,detailh=para(details).wrap(508,1000)
 row_heights=[para(exercise['name']+' - choose level, or leave Select...').wrap(508,1000)[1]+54 for exercise in event['exercises']] if event['format']=='Working' else [71]
 block=49+31+(31 if event.get('feoFee') else 0)+detailh+14+sum(row_heights)+12
 ensure(block if block<=593 else 250)
 c.setFillColor(PALE);c.roundRect(52,y-33,508,34,3,fill=1,stroke=0);c.setFillColor(GREEN);c.setFont('Helvetica-Bold',12)
 label=f"Round {event['round']} - {event['level']} / {event['format']} - {event['dayId']}"
 c.drawString(63,y-21,clean(label));y-=49
 check(f"r{event['round']}_enter",'Enter this event')
 if event.get('feoFee'):check(f"r{event['round']}_feo",'FEO for this whole round')
 note(details)
 if event['format']=='Working':
  for exercise,row_height in zip(event['exercises'],row_heights):
   if y-row_height<61:
    page();section(f"Round {event['round']} - Working (continued)",int(row_height)+30)
   row([(f"r{event['round']}_{exercise['id']}_level",exercise['name']+' - choose level, or leave Select...',52,508,event['levels'])])
 else:row([(f"r{event['round']}_stream",'Stream',52,180,event['levels']),(f"r{event['round']}_amount",'Event fee (CAD)',280,280)])
 y-=12
section(('5' if has_partner else '4')+'. Fees, payment & submission',140)
note('Calculate the total using the per-dog / per-exercise units stated above.')
row([('total_cad','Total entry fees (CAD)',52,240),('payment_reference','Payment method / reference',320,240)])
note('Agreement / premium reference: '+str(trial.get('premiumVersion') or 'Contact secretary'))
note(trial.get('payment',''))
note('Return the completed form to '+trial['email']+'. Save a completed copy first. Submission is pending secretary review; it does not confirm acceptance or payment. '+trial.get('confirmations',''))
section(('6' if has_partner else '5')+'. Requests & entry agreement',130)
row([('accommodation','Accommodation request (arrange supporting documents with secretary)',52,508,None,65)])
note(trial.get('accommodations',''))
policies=['Move-ups: '+trial.get('moveups',''),'Refunds: '+trial.get('refunds','')]
policy_height=sum(para(value).wrap(508,10000)[1]+14 for value in policies)
section('Move-up and refund policies',min(policy_height+10,500))
for value in policies:note(value)
agreement=trial.get('waiver','')
_,agreement_height=para(agreement).wrap(508,10000)
section('Agreement - read before signing',min(agreement_height+240,540));note(agreement)
ensure(225)
check('eligibility_declaration','I declare that the selected classes/levels are appropriate for this entry.')
check('agreement_read','I have read the premium and host agreement.')
row([('signature','Signature / name (follow host instructions)',52,300),('signature_date','Date (YYYY-MM-DD)',385,175)])
note('This form does not send itself. Email it to '+trial['email']+' using your own email application. Contact the secretary if a handwritten signature or another submission method is required.')
footer();c.save();os.replace(temporary,target)
print(json.dumps({'fields':len(fields),'path':str(target)}))
