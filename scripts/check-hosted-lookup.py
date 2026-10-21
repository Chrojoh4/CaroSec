import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from src.cloud.dog_lookup import lookup_results,project_part,CACHE,LOCK,PdfRequestError
TRIAL='00000000-0000-0000-0000-000000000001';AUTH='Bearer test.token.signature'
class Checks(unittest.TestCase):
 def setUp(self):
  with LOCK:CACHE.clear()
 def test_authentication_and_trial_allowance_precede_external_requests(self):
  def forbidden(*args):self.fail('Unexpected external request')
  with self.assertRaises(PdfRequestError) as error:lookup_results(None,{'trialId':TRIAL,'dogId':'1334'},claim=forbidden,fetch=forbidden)
  self.assertEqual(error.exception.status,401)
  with self.assertRaises(PdfRequestError) as error:lookup_results(AUTH,{'trialId':TRIAL,'dogId':'1334'},claim=lambda *_:False,fetch=forbidden)
  self.assertEqual(error.exception.status,429)
 def test_numeric_id_validation_does_not_change_the_entry_id(self):
  def forbidden(*args):self.fail('Invalid ID reached authorization or external service')
  for dog_id in ['DOG-TEST','123/456',' 1334 ',1334]:
   with self.assertRaises(PdfRequestError) as error:lookup_results(AUTH,{'trialId':TRIAL,'dogId':dog_id},claim=forbidden,fetch=forbidden)
   self.assertEqual(error.exception.status,422)
 def test_allowlist_and_no_results_keep_source_provenance_without_identity_inference(self):
  calls=[]
  def claim(token,trial):self.assertEqual(token,'test.token.signature');self.assertEqual(trial,TRIAL);return True
  def fetch(discipline,dog):
   calls.append((discipline,dog));return (200,json.dumps([{'trial_number':'MOCK-ONLY','score':0,'judge_name':'Mock Judge','owner_email':'PRIVATE@example.com'}]).encode()) if discipline=='rally' else (404,b'{"message":"No results found for the provided dog ID."}')
  result=lookup_results(AUTH,{'trialId':TRIAL,'dogId':'001334'},claim=claim,fetch=fetch,use_cache=False)
  self.assertEqual(result['queriedDogId'],'001334');self.assertIsNone(result['sourceAsOf']);self.assertTrue(result['fetchedAt'].endswith('Z'));self.assertEqual(result['parts'][0]['records'][0]['score'],'0');self.assertEqual(result['parts'][1]['status'],'no_results');self.assertNotIn('PRIVATE',json.dumps(result));self.assertEqual(sorted(calls),[('rally','001334'),('working','001334')])
 def test_schema_failures_are_unavailable_not_invented_no_results(self):
  for status,raw in [(404,b'{"message":"Different error"}'),(200,b'{"unexpected":true}'),(200,b'[{"owner_email":"PRIVATE"}]'),(200,b'not json'),(503,b''),(200,b'x'*2_000_001)]:self.assertEqual(project_part('rally',status,raw)['status'],'unavailable')
 def test_cache_still_checks_current_authorization_and_does_not_cache_outages(self):
  claims=[];fetches=[]
  def claim(*args):claims.append(args);return True
  def fetch(*args):fetches.append(args);return 200,b'[]'
  body={'trialId':TRIAL,'dogId':'1334'};first=lookup_results(AUTH,body,claim=claim,fetch=fetch);second=lookup_results(AUTH,body,claim=claim,fetch=fetch)
  self.assertEqual(first,second);self.assertEqual(len(claims),2);self.assertEqual(len(fetches),2)
  with LOCK:CACHE.clear()
  lookup_results(AUTH,body,claim=claim,fetch=lambda *_:(503,b''))
  with LOCK:self.assertNotIn('1334',CACHE)
if __name__=='__main__':unittest.main()
