"""Private fillable proof checks: no live requests or entry writes."""
import io,json,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from pypdf import PdfReader,PdfWriter
from src.cloud.private_entry_pdf import generate_private_entry_pdf,PdfRequestError
ID='11111111-1111-4111-8111-111111111111'
def fixture():
 value=json.loads((ROOT/'fixtures/rallypaws-practice-trial.json').read_text(encoding='utf-8'));value['id']=ID;value['application_state']='draft';return {'trial':value,'content':{'waiver':'Private test agreement - review only'}}
class Checks(unittest.TestCase):
 def test_unauthenticated_never_reads_trial(self):
  def forbidden(*args):self.fail('Unauthenticated request reached saved data')
  with self.assertRaises(PdfRequestError):generate_private_entry_pdf(None,{'trialId':ID},source=forbidden)
 def test_foreign_source_denied(self):
  value=fixture();value['trial']['id']='another-trial'
  with self.assertRaises(PdfRequestError) as error:generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:value)
  self.assertEqual(error.exception.status,403)
 def test_fill_save_reopen_preserves_fields_and_private_labels(self):
  (ROOT/'tmp').mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as folder:
   data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:fixture(),temporary_root=folder)
   reader=PdfReader(io.BytesIO(data));text=' '.join(p.extract_text() for p in reader.pages)
   self.assertIn('PRIVATE PROOF',text);self.assertIn('Fee assignment pending',text);self.assertNotIn('Competitive $0.00',text)
   self.assertIn('handler_name',reader.get_fields());self.assertIn('signature',reader.get_fields())
   writer=PdfWriter();writer.clone_document_from_reader(reader);writer.update_page_form_field_values(None,{'handler_name':'Fictional PDF Test'},auto_regenerate=False)
   output=io.BytesIO();writer.write(output);reopened=PdfReader(io.BytesIO(output.getvalue()));self.assertEqual(reopened.get_fields()['handler_name']['/V'],'Fictional PDF Test')
   found=False
   for page in reopened.pages:
    for annotation in page.get('/Annots',[]):
     widget=annotation.get_object()
     if widget.get('/T')=='handler_name':self.assertEqual(widget.get('/V'),'Fictional PDF Test');self.assertTrue(widget.get('/AP',{}).get('/N'));found=True
   self.assertTrue(found)
   (ROOT/'output/pdf').mkdir(parents=True,exist_ok=True);(ROOT/'output/pdf/private-entry-proof-review.pdf').write_bytes(data)
   print(len(reader.pages),'pages;',len(reader.get_fields()),'interactive fields')
if __name__=='__main__':unittest.main()
