from http.server import BaseHTTPRequestHandler
import json,os
from src.cloud.private_entry_pdf import generate_private_entry_pdf,PdfRequestError
class handler(BaseHTTPRequestHandler):
 def do_GET(self):self.error_response(405,'Use the signed-in secretary PDF proof link.')
 def do_POST(self):
  try:
   length=int(self.headers.get('Content-Length','0'))
   if length<1 or length>2000:raise PdfRequestError(422,'Choose a saved trial.')
   try:body=json.loads(self.rfile.read(length))
   except ValueError:raise PdfRequestError(422,'Choose a saved trial.')
   data=generate_private_entry_pdf(self.headers.get('Authorization'),body,temporary_root=os.environ.get('CARO_PDF_TEMP_ROOT'))
   self.send_response(200);self.send_header('Content-Type','application/pdf');self.send_header('Content-Disposition','attachment; filename="CARO-PRIVATE-entry-proof.pdf"');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
  except PdfRequestError as error:self.error_response(error.status,str(error))
  except Exception:self.error_response(503,'Entry proof is temporarily unavailable.')
 def error_response(self,status,message):
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps({'error':message}).encode())
 def log_message(self,*args):pass
