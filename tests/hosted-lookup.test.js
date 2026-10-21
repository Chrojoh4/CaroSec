import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
test('hosted CARO assistance protects caller access, bounds data and preserves source/unknown identity',()=>{
 const bundled=resolve(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
 const python=process.env.CARO_PYTHON||(existsSync(bundled)?bundled:process.platform==='win32'?'python':'python3');
 execFileSync(python,['scripts/check-hosted-lookup.py'],{cwd:resolve(import.meta.dirname,'..'),env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'},stdio:'pipe',timeout:30000});
});
