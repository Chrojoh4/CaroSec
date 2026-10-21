"""No network: verify public paper form projection and interactive fields."""
import io,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from pypdf import PdfReader
from src.cloud.public_entry_pdf import generate_public_entry_pdf,PdfRequestError

class Checks(unittest.TestCase):
 def test_private_and_invalid_links_never_render(self):
  calls=[]
  with self.assertRaises(PdfRequestError):generate_public_entry_pdf('../private',rpc=lambda slug:calls.append(slug))
  self.assertEqual(calls,[])
  for kind in ['manual_entry_edition','private_review_copy']:
   with self.assertRaises(PdfRequestError):generate_public_entry_pdf('test-trial',rpc=lambda _:{'kind':kind,'publicationReady':True})
 def test_published_form_preserves_fields_and_frozen_policy(self):
  config={'title':'Layout verification fixture (not a real trial)','date':'2027-04-17','endDate':'2027-04-17','trialNumber':'TEST-REFERENCE','email':'test@example.com','premiumVersion':'test-agreement','waiver':'FROZEN agreement for layout verification.','payment':'Fictional payment instructions','events':[{'id':'event-1','round':1,'dayId':'2027-04-17','format':'Regular','level':'Novice','levels':['B'],'judge':'Fictional judge','basis':'dog','fee':{'cents':2500},'feoFee':{'cents':2000}}]}
  value={'kind':'public_entry_edition','publicationReady':True,'configuration':config,'content':{'refunds':'Fictional refund policy','moveups':'Contact the test secretary'}}
  (ROOT/'tmp').mkdir(exist_ok=True)
  data=generate_public_entry_pdf('test-trial',rpc=lambda _:value,temporary_root=ROOT/'tmp')
  reader=PdfReader(io.BytesIO(data));text='\n'.join(p.extract_text() for p in reader.pages)
  self.assertIn('FROZEN agreement',text);self.assertIn('test@example.com',text);self.assertGreater(len(reader.get_fields()),20)
  self.assertIn('r1_enter',reader.get_fields());self.assertIn('signature',reader.get_fields())
  (ROOT/'output/pdf').mkdir(parents=True,exist_ok=True);(ROOT/'output/pdf/public-entry-layout-check.pdf').write_bytes(data)
if __name__=='__main__':unittest.main()
