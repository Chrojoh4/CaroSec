"""Paper forms use only the approved anonymous premium projection."""
import json,re,subprocess,sys,tempfile
from pathlib import Path
from urllib.request import Request,build_opener
from urllib.error import HTTPError,URLError
from src.cloud.judge_pdf import configuration,NoRedirect,PdfRequestError

def published_trial(slug):
 url,key=configuration()
 request=Request(url+'/rest/v1/rpc/caro_public_premium',data=json.dumps({'p_slug':slug}).encode(),headers={'apikey':key,'Content-Type':'application/json','Accept':'application/json'},method='POST')
 try:
  with build_opener(NoRedirect()).open(request,timeout=12) as response:
   raw=response.read(400001)
   if len(raw)>400000:raise PdfRequestError(413,'The published entry form needs review.')
   return json.loads(raw)
 except HTTPError as error:
  if error.code in (400,404):raise PdfRequestError(404,'Published trial is unavailable.') from None
  raise PdfRequestError(503,'The published form is temporarily unavailable.') from None
 except (URLError,TimeoutError,ValueError):raise PdfRequestError(503,'The published form is temporarily unavailable.') from None

def generate_public_entry_pdf(slug,rpc=published_trial,temporary_root=None):
 if not isinstance(slug,str) or not re.fullmatch(r'[a-z0-9][a-z0-9-]{2,79}',slug):raise PdfRequestError(422,'Choose a valid published trial link.')
 value=rpc(slug)
 if not isinstance(value,dict) or value.get('kind')!='public_entry_edition' or value.get('publicationReady') is not True:raise PdfRequestError(404,'Published trial is unavailable.')
 config=value.get('configuration');content=value.get('content')
 if not isinstance(config,dict) or not isinstance(content,dict) or not isinstance(config.get('events'),list) or not 1<=len(config['events'])<=100:raise PdfRequestError(503,'The published entry form needs review.')
 trial={key:config.get(key,'') for key in ['title','trialNumber','date','endDate','timezone','host','venue','address','secretary','email','opens','closes','premiumVersion','payment','confirmations','waiver']}
 trial.update({key:content.get(key,'') for key in ['accommodations','moveups','refunds']});trial['events']=config['events'];trial['fictional']=False
 with tempfile.TemporaryDirectory(prefix='caro-public-entry-',dir=temporary_root) as folder:
  target=Path(folder)/'entry.pdf'
  script=Path(__file__).resolve().parents[1]/'pdf/entry_form.py'
  result=subprocess.run([sys.executable,str(script),str(target)],input=json.dumps(trial,ensure_ascii=False),text=True,encoding='utf-8',capture_output=True,timeout=15)
  if result.returncode or not target.exists():raise PdfRequestError(503,'The entry form could not be generated. Contact the secretary.')
  return target.read_bytes()
