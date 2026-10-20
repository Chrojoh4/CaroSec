import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const files={'/':['index.html','text/html'],'/staff.js':['staff.js','text/javascript'],'/staff.css':['staff.css','text/css']};
createServer(async(req,res)=>{const item=files[new URL(req.url,'http://localhost').pathname];if(!item){res.writeHead(404).end();return;}try{const bytes=await readFile(new URL('../../public/'+item[0],import.meta.url));res.writeHead(200,{'Content-Type':item[1]+'; charset=utf-8','Cache-Control':'no-store'}).end(bytes);}catch{res.writeHead(503).end('Run npm run build first.');}}).listen(4320,'127.0.0.1',()=>console.log('Staff preview: http://127.0.0.1:4320'));
