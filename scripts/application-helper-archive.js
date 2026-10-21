import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
// Small, uncompressed ZIP for a fixed allowlist of extension source files.
export function storedZip(files){
 let offset=0;const local=[],central=[];
 function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
 for(const [name,source] of Object.entries(files)){
  if(!/^[A-Za-z0-9_.-]+$/.test(name))throw new Error('Invalid archive path');
  const filename=Buffer.from(name),data=Buffer.from(source),crc=crc32(data),header=Buffer.alloc(30),entry=Buffer.alloc(46);
  header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(33,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(filename.length,26);
  entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(33,14);entry.writeUInt32LE(crc,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(data.length,24);entry.writeUInt16LE(filename.length,28);entry.writeUInt32LE(offset,42);
  local.push(header,filename,data);central.push(entry,filename);offset+=header.length+filename.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
export async function applicationHelperArchive(){
 const base=new URL('../hosted/caro-helper/',import.meta.url),files={};
 for(const name of ['manifest.json','popup.html','popup.css','README.md'])files[name]=await readFile(new URL(name,base));
 const result=await build({entryPoints:[fileURLToPath(new URL('popup.js',base))],bundle:true,write:false,platform:'browser',format:'esm',target:'es2022'});
 files['popup.js']=result.outputFiles[0].contents;return storedZip(files);
}
