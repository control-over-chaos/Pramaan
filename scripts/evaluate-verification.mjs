import {parseDocument} from '../src/local-processing.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const expected={certificate_number:'TEST-FIRE-001',institution_name:'Pramaan Test Institute',address:'1 Test Road',issue_date:'2026-01-01',expiry_date:'2027-12-31'};
const cases=[];
for(const file of ['valid.pdf','expired.pdf','mismatch.pdf','corrected.pdf','unsupported.pdf','encrypted.pdf','corrupt.pdf','empty.pdf','scanned.png','scanned.pdf','unreadable.png']){
 const started=performance.now(),result=await parseDocument(resolve('test-fixtures/verification',file));
 const truth={...expected,...(file==='expired.pdf'?{expiry_date:'2025-12-31'}:{}),...(file==='mismatch.pdf'?{institution_name:'Different Test Institute'}:{})};
 const expectedFields=/^(valid|expired|mismatch|corrected|scanned)/.test(file)?Object.entries(truth):[];
 const exact=expectedFields.filter(([key,value])=>result.fields?.some(f=>f.name===key&&f.value===value)).length;
 cases.push({file,validation:result.status,reason:result.reason||'',elapsedMs:Math.round(performance.now()-started),fieldsExpected:expectedFields.length,fieldsExact:exact,extracted:result.fields?.length||0,requiresReview:(result.fields||[]).some(f=>f.method==='WINDOWS_OCR')||!(result.fields||[]).length||Boolean(result.qualityWarnings?.length),warnings:result.qualityWarnings||[]});
}
const expectedFields=cases.reduce((n,c)=>n+c.fieldsExpected,0),exactFields=cases.reduce((n,c)=>n+c.fieldsExact,0);
const report={generatedAt:new Date().toISOString(),environment:process.platform,node:process.version,dataset:'Fictional controlled fixture pack, v1',generalization:'These small controlled samples do not establish real-world accuracy or production capacity.',fieldAccuracy:{exact:exactFields,total:expectedFields,fraction:expectedFields?exactFields/expectedFields:null},cases};
await mkdir('output/verification',{recursive:true});await writeFile('output/verification/evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
