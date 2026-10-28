import {oneRow} from './db.mjs';
import {documentManifest} from './evidence.mjs';
// This boundary is shared by external-AI and local-summary responses.
const sectionPermissions={compliance:'rule.read',sourceVerifications:'verification.review',findings:'finding.read',documents:'document.read',audit:'audit.read',inspections:'inspection.manage',rectifications:'rectification.review',infrastructure:'document.read'};
const prohibited=new Set(['password_hash','token','token_hash','storage_key','contentBase64','sourceRecord','officer_notes','email','phone','contact_phone','contact_email']);
const prohibitedField=/(?:^|_)(?:password|token|secret|api_key|access_key|authorization|cookie|email|phone|mobile|contact|address|source_record|storage_key|file_content)(?:_|$)/i;
export function prepareAssistantEvidence(context,retrieval) {
 const allowed=new Set(context.user.permissions),copy=structuredClone(retrieval),links=new Map();
 function clean(value){
  if(Array.isArray(value))return value.map(clean);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [key,item]of Object.entries(value)){
   const normalizedKey=key.replace(/([a-z0-9])([A-Z])/g,'$1_$2').toLowerCase();
   if(prohibited.has(key)||prohibitedField.test(normalizedKey))continue;
   if(sectionPermissions[key]&&!allowed.has(sectionPermissions[key]))continue;
   out[key]=clean(item);
  }
  if(out.execution_id){const execution=oneRow('SELECT application_id,document_manifest,assessment_date FROM rule_executions WHERE id=?',out.execution_id);if(execution){out.assessment_date=execution.assessment_date;out.evidenceCurrency=execution.document_manifest===JSON.stringify(documentManifest(execution.application_id))?'CURRENT':'HISTORICAL_REQUIRES_RERUN';if(out.evidenceCurrency!=='CURRENT')out.status='HISTORICAL_REQUIRES_RERUN';}}
  if(out.document_version_id){const v=oneRow('SELECT dv.version_number,d.current_version FROM document_versions dv JOIN documents d ON d.id=dv.document_id WHERE dv.id=?',out.document_version_id);if(v)out.evidenceCurrency=v.version_number===v.current_version?'CURRENT':'HISTORICAL';}
  if(out.application_id)links.set('application:'+out.application_id,{label:'Open application '+out.application_id,page:'application',id:out.application_id});
  if(out.document_id&&allowed.has('document.read'))links.set('document:'+out.document_id,{label:'Open document evidence',page:'document',id:out.document_id});
  return out;
 }
 copy.data=clean(copy.data);
 copy.evidenceClaims=[];
 function collect(value,path='data',record={}){
   if(Array.isArray(value))return value.forEach((v,i)=>collect(v,`${path}.${i}`,record));
   if(value&&typeof value==='object'){const next=value.id?value:record;return Object.entries(value).forEach(([k,v])=>collect(v,`${path}.${k}`,next));}
   if(copy.evidenceClaims.length<100&&['string','number','boolean'].includes(typeof value))copy.evidenceClaims.push({path,value,recordId:record.id||record.application_id||null,applicationId:record.application_id||null,documentId:record.document_id||null,kind:'STORED_FACT'});
 }
 collect(copy.data);
 if(JSON.stringify(copy.data||{}).includes('HISTORICAL_REQUIRES_RERUN'))copy.sources=(copy.sources||[]).map(s=>String(s).replace(/\((PASS|FAIL|VERIFIED)\)/g,'(historical; rerun required)'));
 copy.suggestedActions=[...(copy.suggestedActions||[]),...links.values()].filter((a,i,list)=>list.findIndex(b=>a.page===b.page&&a.id===b.id)===i).slice(0,12);
 copy.knowledgeTypes={records:'Stored authorized records',computed:'Deterministic calculations and version checks',ai:'Explanatory wording only; not a verification decision'};
 return copy;
}
// Citation membership and literal facts are checked server-side. Unsupported free text is never a regulatory decision.
export function validateAssistantClaims(payload,retrieval) {
 let parsed;try{parsed=JSON.parse(payload);}catch{return {valid:false,reason:'UNSTRUCTURED_CLAIMS'};}
 if(!Array.isArray(parsed.claims)||!parsed.claims.length||parsed.claims.length>12)return {valid:false,reason:'INVALID_CLAIMS'};
 const facts=[];
 function visit(v,path='data'){if(Array.isArray(v))v.forEach((x,i)=>visit(x,`${path}.${i}`));else if(v&&typeof v==='object')Object.entries(v).forEach(([k,x])=>visit(x,`${path}.${k}`));else if(['string','number','boolean'].includes(typeof v))facts.push({path,value:v});}
 visit(retrieval.data);
 const statements=[];
 for(const claim of parsed.claims){const fact=facts.find(f=>f.path===claim.path&&f.value===claim.value);if(!fact)return {valid:false,reason:'UNSUPPORTED_CLAIM'};statements.push({path:fact.path,value:fact.value});}
 return {valid:true,claims:statements};
}
