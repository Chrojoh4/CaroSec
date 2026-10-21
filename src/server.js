import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createLocalApi } from './local-api.js';
const root = resolve(import.meta.dirname, '..');
const port=Number(process.env.CARO_PORT||4318);
const api=createLocalApi(root,port);
const routes = new Map([
  ['/', ['web/index.html', 'text/html']], ['/app.js', ['web/app.js', 'text/javascript']],
  ['/styles.css', ['web/styles.css', 'text/css']], ['/sample.js', ['web/sample.js', 'text/javascript']],
  ['/date-time.js', ['src/domain/date-time.js', 'text/javascript']],
  ['/src/domain/date-time.js', ['src/domain/date-time.js', 'text/javascript']],
  ['/premium.js', ['src/domain/premium.js', 'text/javascript']],
  ['/src/domain/premium.js', ['src/domain/premium.js', 'text/javascript']],
  ['/trial-wizard.js', ['web/trial-wizard.js', 'text/javascript']],
  ['/trial-workspace.js', ['src/domain/trial-workspace.js', 'text/javascript']],
  ['/application.js', ['src/domain/application.js', 'text/javascript']],
  ['/catalog.js', ['src/domain/catalog.js', 'text/javascript']],
  ['/desk.js', ['web/desk.js', 'text/javascript']],
  ['/entry', ['web/entry.html', 'text/html']],
  ['/entry.js', ['web/entry.js', 'text/javascript']],
  ['/entry-form.js', ['web/entry-form.js', 'text/javascript']],
  ['/reports.js', ['web/reports.js', 'text/javascript']],
  ['/run-register.js', ['web/run-register.js', 'text/javascript']],
  ['/activity-journal.js', ['web/activity-journal.js', 'text/javascript']],
  ['/trial-summary.js', ['web/trial-summary.js', 'text/javascript']],
  ['/run-status.js', ['src/domain/run-status.js', 'text/javascript']],
  ['/src/domain/run-status.js', ['src/domain/run-status.js', 'text/javascript']],
]);
const server = http.createServer(async (request, response) => {
  const url=new URL(request.url,'http://localhost');
  if(await api(request,response,url))return;
  const route = routes.get(url.pathname);
  if (!route || request.method !== 'GET') { response.writeHead(404); response.end('Not found'); return; }
  try {
    const file = await readFile(resolve(root, route[0]));
    response.writeHead(200, { 'Content-Type': `${route[1]}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(file);
  } catch { response.writeHead(500); response.end('Unable to load local preview'); }
});
server.listen(port, '127.0.0.1', () => console.log(`CARO local preview: http://localhost:${port}`));
