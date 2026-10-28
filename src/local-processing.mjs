import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const run=promisify(execFile);
export function pythonRuntime() {
 const bundled=process.env.LOCALAPPDATA ? resolve(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe') : '';
 return process.env.PRAMAAN_PYTHON || (bundled&&existsSync(bundled)?bundled:process.platform==='win32'?'python':'python3');
}
export async function parseDocument(path,mode='extract') {
 try {
  const {stdout}=await run(pythonRuntime(),[fileURLToPath(new URL('./document-parser.py',import.meta.url)),path,mode],{timeout:mode==='validate'?30000:180000,maxBuffer:8*1024*1024,windowsHide:true});
  return JSON.parse(stdout);
 } catch(error) {
  try {const parsed=JSON.parse(error.stdout);if(parsed.status==='INVALID')return parsed;}catch{}
  return {status:'UNAVAILABLE',reason:'Local parser unavailable or its resource/time limit was exceeded. Configure PRAMAAN_PYTHON with pypdf, pdfplumber and Pillow.'};
 }
}
export async function scanDocument(path){
 if(!process.env.MALWARE_SCANNER)return {status:'NOT_CONFIGURED',reason:'No antivirus scan was performed.'};
 try{await run(process.env.MALWARE_SCANNER,['--no-summary',path],{timeout:30000,maxBuffer:65536,windowsHide:true});return {status:'CLEAN',reason:'Configured scanner returned clean.'};}
 catch(error){return {status:error.code===1?'INFECTED':'UNAVAILABLE',reason:error.code===1?'The configured scanner detected unsafe content.':'The configured scanner could not complete its check.'};}
}
