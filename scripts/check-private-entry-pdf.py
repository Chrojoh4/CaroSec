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
 def test_unsaved_selections_populate_only_private_proof(self):
  value=fixture();value['content']['fees']=[{'label':'Competitive','cents':2400,'unit':'per dog'}]
  before=json.dumps(value);event=value['trial']['planning']['events'][0]
  rows=[{'key':event['id'],'levels':['B','C'],'fee_index':0,'feo_index':None,'basis':'dog'}]
  data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID,'draftRows':rows},source=lambda *args:value,temporary_root=ROOT/'tmp')
  text=' '.join(p.extract_text() for p in PdfReader(io.BytesIO(data)).pages)
  self.assertIn('$24.00',text);self.assertIn('PRIVATE PROOF',text);self.assertEqual(json.dumps(value),before)
  (ROOT/'output/pdf/unsaved-entry-proof-review.pdf').write_bytes(data)
  rows[0]['fee_index']=999
  with self.assertRaises(PdfRequestError):generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID,'draftRows':rows},source=lambda *args:value)
 def test_host_defaults_populate_pdf_and_feo_needs_explicit_switch(self):
  value=fixture();value['content']['fees']=[{'label':'Regular','cents':2400,'unit':'per dog','kind':'regular'},{'label':'FEO','cents':1600,'unit':'per dog','kind':'feo','offered':True},{'label':'Team','cents':1200,'unit':'per entry','kind':'team'},{'label':'Brace','cents':1400,'unit':'per dog','kind':'brace'},{'label':'Working','cents':1000,'unit':'per exercise','kind':'working'}]
  before=json.dumps(value)
  data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:value,temporary_root=ROOT/'tmp')
  reader=PdfReader(io.BytesIO(data));text=' '.join(p.extract_text() for p in reader.pages)
  self.assertIn('Regular $24.00',text);self.assertIn('FEO $16.00',text);self.assertNotIn('Fee assignment pending',text);self.assertIn('/B_FEO',reader.get_fields()['r1_entry_type']['/_States_']);self.assertEqual(json.dumps(value),before)
  (ROOT/'output/pdf/trial-default-fees-proof.pdf').write_bytes(data)
  value['content']['fees'][1]['offered']=False
  data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:value,temporary_root=ROOT/'tmp')
  self.assertNotIn('/B_FEO',PdfReader(io.BytesIO(data)).get_fields()['r1_entry_type']['/_States_'])
 def test_compact_cards_keep_stream_and_type_choices_exclusive_and_fillable(self):
  value=fixture();value['trial']['planning']['events']=value['trial']['planning']['events'][:2]
  value['trial']['planning']['events'][0].update(level='Advanced',format='Regular',stream='B C',judge='Lorraine Perron',dayId='2026-11-29')
  value['trial']['planning']['events'][1].update(level='Intermediate',format='Regular',stream='B',judge='Lorraine Perron',dayId='2026-11-29')
  value['content']['fees']=[{'label':'Regular','kind':'regular','cents':2400,'unit':'per dog'},{'label':'FEO','kind':'feo','offered':True,'cents':1600,'unit':'per dog'}]
  data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:value,temporary_root=ROOT/'tmp')
  reader=PdfReader(io.BytesIO(data));text=' '.join(p.extract_text() for p in reader.pages);fields=reader.get_fields()
  self.assertIn('Advanced Stream B, November 29, 2026',text);self.assertIn('Advanced Stream C, November 29, 2026',text)
  self.assertIn('Judge Lorraine Perron',text);self.assertIn('Regular $24.00',text);self.assertIn('FEO $16.00',text)
  self.assertNotIn('r1_stream',fields);self.assertNotIn('r1_amount',fields);self.assertNotIn('Event fee (CAD)',text)
  self.assertEqual(set(fields['r1_entry_type']['/_States_']),{'/Off','/B_Regular','/B_FEO','/C_Regular','/C_FEO'})
  writer=PdfWriter();writer.clone_document_from_reader(reader);writer.update_page_form_field_values(None,{'r1_entry_type':'/C_FEO','handler_name':'Fictional choice test'},auto_regenerate=False)
  output=io.BytesIO();writer.write(output);reopened=PdfReader(io.BytesIO(output.getvalue()));self.assertEqual(reopened.get_fields()['r1_entry_type']['/V'],'/C_FEO')
  active=[];widgets=0
  for page in reopened.pages:
   for ref in page.get('/Annots',[]):
    widget=ref.get_object();parent=widget.get('/Parent')
    if parent and parent.get_object().get('/T')=='r1_entry_type':
     widgets+=1;self.assertTrue(widget.get('/AP',{}).get('/N'))
     if widget.get('/AS')!='/Off':active.append(str(widget.get('/AS')))
  self.assertEqual(widgets,4);self.assertEqual(active,['/C_FEO'])
 def test_fill_save_reopen_preserves_fields_and_private_labels(self):
  (ROOT/'tmp').mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as folder:
   data=generate_private_entry_pdf('Bearer a.b.c',{'trialId':ID},source=lambda *args:fixture(),temporary_root=folder)
   reader=PdfReader(io.BytesIO(data));text=' '.join(p.extract_text() for p in reader.pages)
   self.assertIn('PRIVATE PROOF',text);self.assertIn('Regular price pending',text);self.assertNotIn('Competitive $0.00',text)
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
