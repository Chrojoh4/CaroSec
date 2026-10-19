import {mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=import.meta.dirname;
const output=resolve(root,'public');
await mkdir(output,{recursive:true});
const unexpected=(await readdir(output)).filter(name=>name!=='index.html');
if(unexpected.length)throw new Error('Public build contains unexpected files; refusing to publish.');
await copyFile(resolve(root,'index.html'),resolve(output,'index.html'));
console.log('Built static holding page only. Local APIs, records and environment files are not published.');
