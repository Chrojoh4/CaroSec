"""Optional read-only CARO assistance; no identity/title/eligibility inference."""
import copy,json,math,re,time,uuid,threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from urllib.request import Request,build_opener
from urllib.error import HTTPError,URLError
from src.cloud.judge_pdf import PdfRequestError,configuration,NoRedirect,caller_token
FIELDS=['trial_start_date','trial_number','round_number','judge_name','event_level','score','status','stream','trial_host_name','event_category','exercise_name','exercise_level','result','exercise','level','outcome']
CACHE=OrderedDict();LOCK=threading.Lock()
def claim_allowance(token,trial_id):
 url,key=configuration();request=Request(url+'/rest/v1/rpc/caro_claim_lookup',data=json.dumps({'p_trial':trial_id}).encode('utf-8'),headers={'apikey':key,'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
 try:
  with build_opener(NoRedirect()).open(request,timeout=12) as response:result=json.loads(response.read(4096))
  if type(result) is not bool:raise PdfRequestError(503,'Lookup authorization needs the database update.')
  return result
 except HTTPError as error:
  if error.code in (401,403):raise PdfRequestError(error.code,'Sign-in and current trial access are required.') from None
  raise PdfRequestError(503,'Lookup authorization is unavailable. You can continue entering manually.') from None
 except (URLError,TimeoutError,ValueError):raise PdfRequestError(503,'Lookup authorization is unavailable. You can continue entering manually.') from None
def fetch_records(discipline,dog_id):
 request=Request('https://app.canadianrallyo.ca/api/dog-results/'+discipline+'/'+dog_id,headers={'Accept':'application/json'},method='GET')
 try:
  with build_opener(NoRedirect()).open(request,timeout=8) as response:return response.status,response.read(2_000_001)
 except HTTPError as error:return error.code,error.read(2_000_001)
 except (URLError,TimeoutError):return 503,b''
def project_part(discipline,status,raw):
 unavailable={'discipline':discipline,'status':'unavailable','records':[]}
 try:
  if len(raw)>2_000_000:return unavailable
  data=json.loads(raw)
  if status==404 and isinstance(data,dict) and data.get('message')=='No results found for the provided dog ID.':return {'discipline':discipline,'status':'no_results','records':[]}
  if status!=200 or not isinstance(data,list) or len(data)>5000:return unavailable
  rows=[]
  for row in data:
   if not isinstance(row,dict):return unavailable
   clean={key:str(row[key])[:500] for key in FIELDS if key in row and type(row[key]) in (str,int,float) and (type(row[key]) is not float or math.isfinite(row[key]))}
   if not clean:return unavailable
   rows.append(clean)
  return {'discipline':discipline,'status':'available' if rows else 'no_results','records':rows}
 except (ValueError,TypeError):return unavailable
def lookup_results(authorization,body,claim=claim_allowance,fetch=fetch_records,use_cache=True):
 token=caller_token(authorization,'checking public CARO results')
 if not isinstance(body,dict) or set(body)-{'trialId','dogId'}:raise PdfRequestError(422,'Provide the trial and CARO dog ID.')
 trial=body.get('trialId');dog_id=body.get('dogId')
 try:
  if not isinstance(trial,str) or str(uuid.UUID(trial))!=trial.lower():raise ValueError()
 except (ValueError,AttributeError):raise PdfRequestError(422,'Choose an authorized trial.') from None
 if not isinstance(dog_id,str) or not re.fullmatch('[0-9]{1,12}',dog_id):raise PdfRequestError(422,'Public CARO lookup uses a numeric ID. You can continue manually with the ID as entered.')
 if not claim(token,trial):raise PdfRequestError(429,'Please wait for the next minute before another lookup. You can continue manually.')
 if use_cache:
  with LOCK:
   cached=CACHE.get(dog_id)
   if cached and time.monotonic()-cached[0]<600:return copy.deepcopy(cached[1])
 def part(discipline):
  try:status,raw=fetch(discipline,dog_id);return project_part(discipline,status,raw)
  except Exception:return {'discipline':discipline,'status':'unavailable','records':[]}
 with ThreadPoolExecutor(max_workers=2) as pool:parts=list(pool.map(part,['rally','working']))
 result={'queriedDogId':dog_id,'sourceUrl':'https://canadianrallyo.ca/quick-results/','fetchedAt':datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),'sourceAsOf':None,'parts':parts}
 if use_cache and all(part['status']!='unavailable' for part in parts):
  with LOCK:
   CACHE[dog_id]=(time.monotonic(),copy.deepcopy(result));CACHE.move_to_end(dog_id)
   while len(CACHE)>100:CACHE.popitem(last=False)
 return result
