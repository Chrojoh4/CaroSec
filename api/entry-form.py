from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
import json,os
from src.cloud.public_entry_pdf import generate_public_entry_pdf,PdfRequestError

class handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   query=parse_qs(urlparse(self.path).query)
   if set(query)!={'trial'} or len(query['trial'])!=1:raise PdfRequestError(422,'Choose a valid published trial link.')
   data=generate_public_entry_pdf(query['trial'][0],temporary_root=os.environ.get('CARO_PDF_TEMP_ROOT'))
   self.send_response(200);self.send_header('Content-Type','application/pdf');self.send_header('Content-Disposition','attachment; filename="CARO-email-paper-entry.pdf"');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
  except PdfRequestError as error:self.error_response(error.status,str(error))
  except Exception:self.error_response(503,'The entry form is temporarily unavailable. Contact the secretary.')
 def do_POST(self):self.error_response(405,'Use the published paper entry link.')
 def error_response(self,status,message):
  self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(json.dumps({'error':message}).encode())
 def log_message(self,*args):pass
