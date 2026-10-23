"""Protected PDF projection: caller JWT -> authorized RPC -> minimal judge packet."""
import json,os,re,uuid,tempfile
from pathlib import Path
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
from urllib.parse import urlparse
from src.pdf.judge_sheets import build_judge_sheets

class PdfRequestError(Exception):
 def __init__(self,status,message):super().__init__(message);self.status=status

def caller_token(authorization,purpose='downloading judge sheets'):
 if not isinstance(authorization,str) or len(authorization)>16384 or not re.fullmatch(r'Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',authorization):raise PdfRequestError(401,'Sign in before '+purpose+'.')
 return authorization[7:]

def configuration():
 defaults=json.loads((Path(__file__).resolve().parents[2]/'hosted/public-config.json').read_text(encoding='utf-8'))
 url=os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or defaults['url']
 key=os.environ.get('SUPABASE_PUBLISHABLE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') or defaults['publishableKey']
 parsed=urlparse(url)
 if parsed.scheme!='https' or not parsed.hostname or not parsed.hostname.endswith('.supabase.co') or parsed.path not in ('','/') or parsed.query or parsed.fragment or parsed.username or parsed.port:
  raise PdfRequestError(503,'PDF service configuration needs review.')
 if not isinstance(key,str) or not key.startswith('sb_publishable_'):raise PdfRequestError(503,'PDF service configuration needs review.')
 return url.rstrip('/'),key

class NoRedirect(HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def authorized_round(token,event_id):
 url,key=configuration()
 request=Request(url+'/rest/v1/rpc/caro_event_desk',data=json.dumps({'p_event':event_id}).encode('utf-8'),headers={'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json'},method='POST')
 try:
  with build_opener(NoRedirect()).open(request,timeout=12) as response:
   raw=response.read(4_000_001)
   if len(raw)>4_000_000:raise PdfRequestError(413,'This round is too large for this export. Contact the secretary.')
   return json.loads(raw)
 except HTTPError as error:
  if error.code==401:raise PdfRequestError(401,'Sign in again before downloading judge sheets.') from None
  if error.code==403:raise PdfRequestError(403,'Trial access is required for these judge sheets.') from None
  raise PdfRequestError(503,'Judge sheets could not load the authorized round. Check the database update and retry.') from None
 except (URLError,TimeoutError,ValueError):raise PdfRequestError(503,'Judge sheets are temporarily unavailable. Retry after refreshing the round.') from None

def generate_judge_pdf(authorization,body,rpc=authorized_round,temporary_root=None):
 token=caller_token(authorization)
 if not isinstance(body,dict) or set(body)-{'eventId','reviewToken','startRun','runCount'}:raise PdfRequestError(422,'Choose a valid round and print range.')
 event_id=body.get('eventId');review=body.get('reviewToken');start=body.get('startRun',1);count=body.get('runCount',100)
 try:
  if not isinstance(event_id,str) or str(uuid.UUID(event_id))!=event_id.lower():raise ValueError()
 except (ValueError,AttributeError):raise PdfRequestError(422,'Choose a valid round.') from None
 if not isinstance(review,str) or not re.fullmatch('[a-f0-9]{64}',review) or type(start) is not int or start<1 or type(count) is not int or not 1<=count<=100:raise PdfRequestError(422,'Choose a valid reviewed round and range of up to 100 runs.')
 # The token is never decoded locally to grant access, stored, or logged.
 desk=rpc(token,event_id)
 if not isinstance(desk,dict) or not isinstance(desk.get('event'),dict) or desk['event'].get('id')!=event_id or not isinstance(desk.get('runs'),list):raise PdfRequestError(503,'The round response needs review.')
 if desk.get('reviewToken')!=review:raise PdfRequestError(409,'The round changed. Refresh before printing.')
 event=desk['event'];source=desk['runs'];runs=[]
 if (source and start>len(source)) or (not source and start!=1):raise PdfRequestError(422,'The selected range is outside this running order.')
 def dog(value,handler):
  value=value or {}
  return {key:value.get(key,'') for key in ['name','caroId','breed','height','jumpHeight']}|{'veteran':value.get('veteran') is True,'handler':handler or ''}
 for number,run in enumerate(source[start-1:start-1+count],start):
  names={item['id']:item.get('name','') for item in run.get('offeredExercises') or []}
  dogs=[dog(run.get('dog'),run.get('handler'))]
  if event['format'] in ('Team','Brace') and run.get('partner'):dogs.append(dog(run['partner'].get('dog'),run['partner'].get('handler')))
  runs.append({'run':number,'entryId':run['entryId'],'handler':run.get('handler') or '','stream':run.get('stream'),'feo':run.get('feo') is True,'dogs':dogs,
   'exercises':[{'name':names.get(item['id']) or item['id'],'level':item.get('level','')} for item in run.get('exercises') or []],
   'accommodation':'Confirm accommodation instructions with the secretary.'})
 packet={'title':event.get('title',''),'host':event.get('host') or '','trialNumber':event.get('trialNumber') or '','timezone':event['timezone'],'fictional':event.get('fictional') is True or 'TEST ONLY' in event.get('title',''),
  'events':[{'id':event_id,'round':event['round'],'date':event['date'],'format':event['format'],'level':event['level'],'judge':event['judge'],'officiatingJudge':event.get('officiatingJudge') or event['judge'],'complete':bool(desk.get('completed')),'runs':runs}]}
 with tempfile.TemporaryDirectory(prefix='caro-judges-',dir=temporary_root) as directory:
  path=Path(directory)/'judge-sheets.pdf';build_judge_sheets(packet,path);result=path.read_bytes()
 if len(result)>4_000_000:raise PdfRequestError(413,'Choose fewer runs and download this round in smaller groups.')
 return result
