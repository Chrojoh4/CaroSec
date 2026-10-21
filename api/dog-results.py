from http.server import BaseHTTPRequestHandler
import json
from src.cloud.dog_lookup import lookup_results,PdfRequestError
class handler(BaseHTTPRequestHandler):
 def respond(self,status,value):
  raw=json.dumps(value,ensure_ascii=False).encode('utf-8');self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(raw)
 def do_GET(self):self.respond(405,{'error':'Use the optional lookup in the signed-in entry form.'})
 def do_POST(self):
  try:
   try:length=int(self.headers.get('Content-Length','0'))
   except ValueError:raise PdfRequestError(422,'Invalid lookup request.')
   if not 1<=length<=4096:raise PdfRequestError(413,'Invalid lookup request size.')
   if not self.headers.get('Content-Type','').startswith('application/json'):raise PdfRequestError(415,'JSON is required.')
   try:body=json.loads(self.rfile.read(length))
   except (ValueError,UnicodeError):raise PdfRequestError(422,'Invalid lookup request.')
   self.respond(200,lookup_results(self.headers.get('Authorization'),body))
  except PdfRequestError as error:self.respond(error.status,{'error':str(error)})
  except Exception:self.respond(503,{'error':'Public lookup is unavailable. Continue entering manually.'})
 def log_message(self,*args):pass
