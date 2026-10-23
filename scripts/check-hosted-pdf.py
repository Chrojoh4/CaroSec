"""Local-only PDF authorization/projection checks. No network calls."""
import io,json,sys,tempfile,unittest,os
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from pypdf import PdfReader
from src.cloud.judge_pdf import generate_judge_pdf,PdfRequestError,configuration
EVENT='00000000-0000-0000-0000-000000000001';REVIEW='a'*64
def desk(count=1,format='Regular'):
 return {'event':{'id':EVENT,'round':1,'date':'2027-04-17','format':format,'level':'Working' if format=='Working' else 'Novice','judge':'Fictional Judge','title':'Hosted PDF TEST ONLY','host':'Fictional host','trialNumber':'TEST','timezone':'America/Vancouver'},'reviewToken':REVIEW,'completed':None,
  'runs':[{'entryId':f'10000000-0000-0000-0000-{n:012d}','status':'accepted','handler':'Fictional Handler','dog':{'name':'Test Dog '+str(n),'caroId':'TEST-'+str(n),'breed':'Mixed','height':'18 inches','jumpHeight':'12 inches','veteran':False,'ownerEmail':'PRIVATE-EMAIL@example.com'},'stream':'B','feo':False,'exercises':[],'offeredExercises':[],
   'contact':{'email':'PRIVATE-EMAIL@example.com','address':'PRIVATE-ADDRESS'},'receiptToken':'PRIVATE-RECEIPT','payment':'PRIVATE-PAYMENT'} for n in range(1,count+1)]}
class Checks(unittest.TestCase):
 def setUp(self):
  (ROOT/'tmp').mkdir(exist_ok=True);self.tmp=tempfile.TemporaryDirectory(prefix='hosted-pdf-check-',dir=ROOT/'tmp');self.addCleanup(self.tmp.cleanup)
 def render(self,source,**body):
  def rpc(token,event):self.assertEqual(token,'test.token.signature');self.assertEqual(event,EVENT);return source
  return generate_judge_pdf('Bearer test.token.signature',{'eventId':EVENT,'reviewToken':REVIEW,**body},rpc=rpc,temporary_root=self.tmp.name)
 def test_missing_authorization_never_calls_rpc(self):
  def forbidden(*args):self.fail('Unauthenticated request reached the database')
  for token in [None,'Bearer sb_publishable_fake','Bearer not-a-token','Basic fake']:
   with self.assertRaises(PdfRequestError) as error:generate_judge_pdf(token,{'eventId':EVENT,'reviewToken':REVIEW},rpc=forbidden,temporary_root=self.tmp.name)
   self.assertEqual(error.exception.status,401)
 def test_database_authorization_denial_is_preserved(self):
  def denied(*args):raise PdfRequestError(403,'Trial access required')
  with self.assertRaises(PdfRequestError) as error:generate_judge_pdf('Bearer test.token.signature',{'eventId':EVENT,'reviewToken':REVIEW},rpc=denied,temporary_root=self.tmp.name)
  self.assertEqual(error.exception.status,403)
 def test_stale_review_and_invalid_ranges_fail_closed(self):
  source=desk();source['reviewToken']='b'*64
  with self.assertRaises(PdfRequestError) as error:self.render(source)
  self.assertEqual(error.exception.status,409)
  for body in [{'runCount':101},{'startRun':0},{'runCount':True},{'startRun':2},{'packet':{'forged':True}}]:
   with self.assertRaises(PdfRequestError) as error:self.render(desk(),**body)
   self.assertEqual(error.exception.status,422)
 def test_projection_batches_keep_absolute_run_numbers_and_strip_private_fields(self):
  pdf=self.render(desk(105),startRun=101,runCount=2);self.assertTrue(pdf.startswith(b'%PDF-'));reader=PdfReader(io.BytesIO(pdf));self.assertEqual(len(reader.pages),2)
  text=' '.join(page.extract_text() for page in reader.pages)
  self.assertIn('Test Dog 101',text);self.assertIn('Run 101',text);self.assertIn('Run 102',text);self.assertNotIn('Test Dog 103',text)
  for private in ['PRIVATE-EMAIL','PRIVATE-ADDRESS','PRIVATE-RECEIPT','PRIVATE-PAYMENT']:self.assertNotIn(private,text)
 def test_working_uses_selected_names_and_completed_reprint_warning(self):
  source=desk(format='Working');source['completed']={'signoff':'Fictional signoff'};source['runs'][0]['stream']=None;source['runs'][0]['exercises']=[{'id':'ex1','level':'Rookie'}];source['runs'][0]['offeredExercises']=[{'id':'ex1','name':'Selected test exercise'},{'id':'ex2','name':'UNSELECTED-EXERCISE'}]
  reader=PdfReader(io.BytesIO(self.render(source)));text=' '.join(page.extract_text() for page in reader.pages)
  self.assertIn('Selected test exercise',text);self.assertNotIn('UNSELECTED-EXERCISE',text);self.assertIn('TRIAL RECORD COMPLETE',text)
 def test_replacement_keeps_course_credit_visible(self):
  source=desk();source['event']['officiatingJudge']='Replacement Attending Judge'
  reader=PdfReader(io.BytesIO(self.render(source)));text=' '.join(p.extract_text() for p in reader.pages)
  self.assertIn('Attending judge: Replacement Attending Judge',text);self.assertIn('Results credit: Fictional Judge',text)
 def test_empty_round_prints_explicit_blank_verification(self):
  reader=PdfReader(io.BytesIO(self.render(desk(0))));self.assertEqual(len(reader.pages),1);self.assertIn('No active accepted runs',reader.pages[0].extract_text())
 def test_configuration_rejects_server_secret_as_publishable_key(self):
  with patch.dict(os.environ,{'SUPABASE_PUBLISHABLE_KEY':'sb_'+'secret_'+'invalid_test_value'}):
   with self.assertRaises(PdfRequestError) as error:configuration()
   self.assertEqual(error.exception.status,503)
if __name__=='__main__':unittest.main()
