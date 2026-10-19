import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emptyRecords, DeskError } from '../domain/secretary.js';
export class LocalRecords {
  #queue=Promise.resolve();
  constructor(path) { this.path=path; }
  async read() {
    try { const value=JSON.parse(await readFile(this.path,'utf8')); if(value.schemaVersion!==1||!Number.isInteger(value.revision))throw new Error('Unrecognized local records format');return {...emptyRecords(),...value}; }
    catch(error) { if(error.code==='ENOENT')return emptyRecords();throw error; }
  }
  mutate(expectedRevision, fn) {
    const task=this.#queue.then(async()=>{
      const state=await this.read();if(expectedRevision!==undefined&&state.revision!==expectedRevision)throw new DeskError('Records changed. Refresh and try again.',409);
      const result=await fn(state);state.revision++;
      await mkdir(dirname(this.path),{recursive:true});
      await writeFile(this.path+'.next',JSON.stringify(state,null,2),'utf8');
      await rename(this.path+'.next',this.path);
      return { revision:state.revision,result };
    });
    this.#queue=task.catch(()=>{});return task;
  }
}
