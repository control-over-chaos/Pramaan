import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('public/demo-registry');
const cases = [
  ['001','Valid registration certificate — synthetic match',{certificate_number:'DEMO-CERT-001',registration_number:'DEMO-REG-001',institution_name:'Suryodaya Technical Institute',address:'Sector 12, Sample Nagar, Karnataka',issue_date:'2025-01-01',expiry_date:'2027-12-31'}],
  ['002','Registration number mismatch — synthetic review',{certificate_number:'DEMO-CERT-002',registration_number:'DEMO-REG-ALT-002',institution_name:'Pragati Institute of Applied Studies',address:'Plot 8, Sample Road, Maharashtra',issue_date:'2025-02-01',expiry_date:'2027-12-31'}],
  ['003','Expired certificate — synthetic expiry finding',{certificate_number:'DEMO-CERT-003',registration_number:'DEMO-REG-003',institution_name:'Aarohan Learning Institute',address:'Road 4, Example City, Rajasthan',issue_date:'2022-01-01',expiry_date:'2024-12-31'}],
  ['004','Missing mandatory document — synthetic checklist case',{certificate_number:'DEMO-CERT-004',registration_number:'DEMO-REG-004',institution_name:'Nirmal Institute of Technology',address:'Campus Road, Example District, Gujarat',issue_date:'2025-03-01',expiry_date:'2027-12-31'}],
  ['005','Conflicting organization address — synthetic mismatch',{certificate_number:'DEMO-CERT-005',registration_number:'DEMO-REG-005',institution_name:'Vistaar College of Engineering',address:'Building B, Sample Avenue, Tamil Nadu',issue_date:'2025-04-01',expiry_date:'2027-12-31'}],
  ['006','Reference source unavailable — synthetic pending case',{certificate_number:'DEMO-CERT-006',registration_number:'DEMO-REG-006',institution_name:'Udaya Institute of Science',address:'Hill Road, Example Town, Kerala',issue_date:'2025-05-01',expiry_date:'2027-12-31'}],
  ['007','All mapped demo checks align — not an eligibility decision',{certificate_number:'DEMO-CERT-007',registration_number:'DEMO-REG-007',institution_name:'Navchetna Institute of Engineering',address:'Knowledge Park, Sample City, Madhya Pradesh',issue_date:'2025-06-01',expiry_date:'2027-12-31'}],
  ['008','Ineligible example — synthetic identity discrepancy only',{certificate_number:'DEMO-CERT-008',registration_number:'DEMO-REG-008',institution_name:'Sankalp Technical Institute',address:'Block 2, Example Road, Punjab',issue_date:'2025-07-01',expiry_date:'2027-12-31'}],
  ['009','Existing institution renewal — synthetic reference',{certificate_number:'DEMO-CERT-009',registration_number:'DEMO-REG-009',institution_name:'Prerna Institute of Technology',address:'University Road, Sample City, Odisha',issue_date:'2025-08-01',expiry_date:'2027-12-31'}],
  ['010','Synthetic altered-document scenario — manual review required',{certificate_number:'DEMO-CERT-010',registration_number:'DEMO-REG-010',institution_name:'Samarth Institute of Advanced Studies',address:'North Campus, Sample District, Assam',issue_date:'2025-09-01',expiry_date:'2027-12-31'}],
];

function pdfString(value) { return String(value).replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)').replace(/[^\x20-\x7e]/g, '?'); }
function createPdf(lines) {
  const commands = ['BT','/F1 11 Tf','14 TL','54 738 Td',...lines.flatMap((line,index)=>index?['T*',`(${pdfString(line)}) Tj`]:[`(${pdfString(line)}) Tj`]),'ET'].join('\n');
  const stream = Buffer.from(`${commands}\n`,'ascii');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream.toString('ascii')}endstream`,
  ];
  const chunks=[Buffer.from('%PDF-1.4\n','ascii')]; let offset=chunks[0].length; const offsets=[0];
  for (const [index,object] of objects.entries()) { offsets.push(offset); const chunk=Buffer.from(`${index+1} 0 obj\n${object}\nendobj\n`,'ascii'); chunks.push(chunk); offset+=chunk.length; }
  const xrefOffset=offset; const xref=`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(value=>`${String(value).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref,'ascii')); return Buffer.concat(chunks);
}

await mkdir(out,{recursive:true});
for(const [number,scenario,fields] of cases){
  const lines=['PRAMAAN DEMO REGISTRY','SYNTHETIC SAMPLE - NOT A GOVERNMENT DOCUMENT',`Scenario: ${scenario}`,
    `certificate number: ${fields.certificate_number}`,`registration number: ${fields.registration_number}`,
    `institution name: ${fields.institution_name}`,`address: ${fields.address}`,
    `issue date: ${fields.issue_date}`,`expiry date: ${fields.expiry_date}`,'Issuer: Fictional Sample Authority'];
  await writeFile(resolve(out,`DEMO-CERT-${number}.pdf`),createPdf(lines),{mode:0o644});
}
process.stdout.write(`Generated ${cases.length} fictional PDFs in ${out}\n`);
