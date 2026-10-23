"""Private staff-only PDF proof. Fetch saved source with the caller JWT and RLS."""
import json,uuid,re,tempfile,subprocess,sys
from pathlib import Path
from urllib.request import Request,build_opener
from urllib.error import HTTPError,URLError
from src.cloud.judge_pdf import configuration,caller_token,NoRedirect,PdfRequestError

def authorized_source(token,trial_id):
 url,key=configuration()
 def fetch(path,body=None):
  request=Request(url+path,data=json.dumps(body).encode() if body is not None else None,headers={'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST' if body is not None else 'GET')
  try:
   with build_opener(NoRedirect()).open(request,timeout=12) as response:
    raw=response.read(500001)
    if len(raw)>500000:raise PdfRequestError(413,'Trial proof is too large.')
    return json.loads(raw)
  except HTTPError as error:
   if error.code in (401,403):raise PdfRequestError(403,'Sign in with access to this trial.') from None
   raise PdfRequestError(503,'Saved trial information could not be loaded.') from None
  except (URLError,TimeoutError,ValueError):raise PdfRequestError(503,'Trial proof is temporarily unavailable.') from None
 user=fetch('/auth/v1/user')
 if not user.get('id') or user.get('is_anonymous'):raise PdfRequestError(403,'A staff account is required.')
 rows=fetch('/rest/v1/caro_trials?id=eq.'+trial_id+'&select=id,title,start_date,end_date,timezone,planning,application_state')
 if not isinstance(rows,list) or len(rows)!=1:raise PdfRequestError(403,'Trial access is required.')
 trial=rows[0]
 if trial['application_state']=='finalized':
  try:return {'configuration':fetch('/rest/v1/rpc/caro_manual_entry_configuration',{'p_trial':trial_id})}
  except PdfRequestError:pass
 drafts=fetch('/rest/v1/caro_premium_drafts?trial_id=eq.'+trial_id+'&select=content')
 return {'trial':trial,'content':drafts[0]['content'] if drafts else {}}

def generate_private_entry_pdf(authorization,body,source=authorized_source,temporary_root=None):
 token=caller_token(authorization,'reviewing entry forms')
 if not isinstance(body,dict) or set(body)!={'trialId'}:raise PdfRequestError(422,'Choose a saved trial.')
 trial_id=body.get('trialId')
 try:
  if not isinstance(trial_id,str) or str(uuid.UUID(trial_id))!=trial_id.lower():raise ValueError()
 except (ValueError,AttributeError):raise PdfRequestError(422,'Choose a valid trial.') from None
 value=source(token,trial_id)
 if 'configuration' in value:
  config=value['configuration']
  if config.get('id')!=trial_id:raise PdfRequestError(403,'Trial scope could not be verified.')
  data={key:config.get(key,'') for key in ['title','date','endDate','timezone','host','venue','address','secretary','email','opens','closes','premiumVersion','payment','confirmations','waiver','accommodations','moveups','refunds']};data['events']=config['events']
 else:
  trial=value['trial'];content=value.get('content') or {};planning=trial.get('planning') or {}
  if trial.get('id')!=trial_id:raise PdfRequestError(403,'Trial scope could not be verified.')
  data={key:planning.get(key,'') for key in ['host','venue','address','secretary','email']};data.update(title=trial['title'],date=trial['start_date'],endDate=trial['end_date'],timezone=trial['timezone'],premiumVersion='Unpublished draft')
  data.update({key:content.get(key,'') for key in ['opens','closes','payment','confirmations','waiver','accommodations','moveups','refunds']});data['savedFeeSummary']='; '.join(str(fee.get('label',''))+' $'+format(fee.get('cents',0)/100,'.2f')+' '+str(fee.get('unit','')) for fee in content.get('fees',[]));data['events']=[]
  for i,event in enumerate(planning.get('events') or []):
   data['events'].append({'id':event['id'],'round':i+1,'dayId':event.get('dayId',''),'level':event.get('level',''),'format':event.get('format',''),'judge':event.get('judge',''),'levels':re.findall(r'[^ ,;]+',event.get('stream','')) or ['Not configured'],'exercises':[{'id':'preview-'+str(n),'name':name.strip()} for n,name in enumerate(re.split(r'[;,\n]+',event.get('exercises',''))) if name.strip()],'basis':'not configured','fee':{'cents':0},'feoFee':None,'previewMissingFee':True})
 if not isinstance(data.get('events'),list) or not 1<=len(data['events'])<=100:raise PdfRequestError(422,'Save between 1 and 100 rounds before generating this proof.')
 data['privateProof']=True;data['trialNumber']='PRIVATE DRAFT - NOT FOR ENTRY';data['fictional']=False
 with tempfile.TemporaryDirectory(prefix='caro-entry-proof-',dir=temporary_root) as folder:
  target=Path(folder)/'proof.pdf';script=Path(__file__).resolve().parents[1]/'pdf/entry_form.py'
  result=subprocess.run([sys.executable,str(script),str(target)],input=json.dumps(data),text=True,encoding='utf-8',capture_output=True,timeout=20)
  if result.returncode or not target.exists():raise PdfRequestError(503,'Entry proof could not be generated.')
  return target.read_bytes()
