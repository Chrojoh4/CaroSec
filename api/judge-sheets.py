from http.server import BaseHTTPRequestHandler
import json,os
from src.cloud.judge_pdf import generate_judge_pdf,PdfRequestError

class handler(BaseHTTPRequestHandler):
 def error_response(self,status,message):
  value=json.dumps({'error':message}).encode('utf-8');self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(value)
 def do_GET(self):self.error_response(405,'Use the signed-in judge-sheet download control.')
 def do_POST(self):
  try:
   try:length=int(self.headers.get('Content-Length','0'))
   except ValueError:raise PdfRequestError(422,'Invalid request.')
   if length<1 or length>4096:raise PdfRequestError(413,'Invalid PDF request size.')
   if not self.headers.get('Content-Type','').startswith('application/json'):raise PdfRequestError(415,'JSON is required.')
   try:body=json.loads(self.rfile.read(length))
   except (ValueError,UnicodeError):raise PdfRequestError(422,'Invalid PDF request.')
   result=generate_judge_pdf(self.headers.get('Authorization'),body,temporary_root=os.environ.get('CARO_PDF_TEMP_ROOT'))
   self.send_response(200);self.send_header('Content-Type','application/pdf');self.send_header('Content-Disposition','attachment; filename="CARO-judge-working-sheets.pdf"');self.send_header('Content-Length',str(len(result)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(result)
  except PdfRequestError as error:self.error_response(error.status,str(error))
  except Exception:self.error_response(500,'Judge sheets could not be generated. Refresh and retry.')
 def log_message(self,*args):pass
