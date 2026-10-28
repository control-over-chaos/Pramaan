import { allRows, oneRow } from './db.mjs';
import { normalizeValue } from './evidence.mjs';

export class DocumentSourceAdapter {
  async getConnectionStatus() { throw new Error('getConnectionStatus is not implemented'); }
  async beginAuthorization() { throw new Error('beginAuthorization is not implemented'); }
  async handleAuthorizationCallback() { throw new Error('handleAuthorizationCallback is not implemented'); }
  async listAuthorizedDocuments() { throw new Error('listAuthorizedDocuments is not implemented'); }
  async importDocument() { throw new Error('importDocument is not implemented'); }
  async revokeAuthorization() { throw new Error('revokeAuthorization is not implemented'); }
}

function parseObject(value, fallback = {}) {
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
}

export class DemoRegistryAdapter extends DocumentSourceAdapter {
  async getConnectionStatus() {
    return { provider: 'DEMO_REGISTRY', status: oneRow('SELECT registry_id FROM demo_registry_records LIMIT 1') ? 'DEMO_CONNECTED' : 'UNAVAILABLE',
      official: false, label: 'DEMO REGISTRY — CONNECTED', note: 'Fictional local records only. This is not an official government source.' };
  }

  async beginAuthorization() { return { authorized: false, status: 'NOT_REQUIRED', note: 'The local synthetic registry uses no user or government authorization.' }; }
  async handleAuthorizationCallback() { throw Object.assign(new Error('The synthetic registry has no authorization callback.'), { code: 'AUTHORIZATION_NOT_SUPPORTED' }); }
  async listAuthorizedDocuments() {
    return allRows('SELECT registry_id,lookup_certificate,scenario_label,record_kind,source_available,required_document_types_json FROM demo_registry_records ORDER BY registry_id')
      .map((row) => ({ id: row.registry_id, reference: row.lookup_certificate, scenario: row.scenario_label, recordKind: row.record_kind,
        sourceAvailable: Boolean(row.source_available), requiredDocumentTypes: parseObject(row.required_document_types_json, []) }));
  }
  async importDocument({ registryId } = {}) {
    const record = oneRow('SELECT lookup_certificate FROM demo_registry_records WHERE registry_id=?', String(registryId || ''));
    if (!record) throw Object.assign(new Error('Synthetic sample record was not found.'), { status: 404, code: 'DEMO_RECORD_NOT_FOUND' });
    return { status: 'MANUAL_UPLOAD_REQUIRED', sampleUrl: `/demo-registry/${encodeURIComponent(record.lookup_certificate)}.pdf`,
      note: 'Upload the fictional sample through the normal document upload so the standard validation, storage, OCR and audit pipeline is used.' };
  }
  async revokeAuthorization() { return { revoked: false, status: 'NOT_REQUIRED', note: 'The synthetic registry stores no user authorization.' }; }

  async verify(fields, applicationId) {
    const submitted = Object.fromEntries((Array.isArray(fields) ? fields : []).map((field) => [field.field_name, field.field_value]));
    const certificate = String(submitted.certificate_number || '').trim();
    const record = certificate ? oneRow('SELECT * FROM demo_registry_records WHERE lookup_certificate=?', certificate) : null;
    if (!record) return { result: 'INCONCLUSIVE', error: certificate ? 'No matching synthetic demo reference was found.' : 'A certificate number is required to look up the synthetic demo registry.' };
    if (!record.source_available) return { result: 'SOURCE_UNAVAILABLE', error: 'This synthetic sample is configured to demonstrate an unavailable reference source.' };

    const reference = parseObject(record.reference_fields_json);
    const requiredDocumentTypes = parseObject(record.required_document_types_json, []);
    const availableDocumentTypes = applicationId ? allRows(`SELECT DISTINCT d.document_type FROM documents d JOIN document_versions dv
      ON dv.document_id=d.id AND dv.version_number=d.current_version WHERE d.application_id=?`, applicationId).map((row) => row.document_type) : [];
    const norm = (value) => normalizeValue(value);
    const missingDocuments = requiredDocumentTypes.filter((required) => !availableDocumentTypes.some((available) => norm(available) === norm(required)));
    const comparisons = Object.entries(reference).filter(([field]) => field !== 'certificate_number').map(([field, value]) => {
      const exists = Object.hasOwn(submitted, field);
      return { field, submitted: exists ? submitted[field] : '', source: value,
        status: !exists ? 'NOT_SUPPLIED' : norm(submitted[field]) === norm(value) ? 'MATCH' : 'MISMATCH' };
    });
    const missingFields = comparisons.filter((item) => item.status === 'NOT_SUPPLIED').map((item) => item.field);
    const mismatches = comparisons.filter((item) => item.status === 'MISMATCH');
    const expired = /^\d{4}-\d{2}-\d{2}$/.test(String(reference.expiry_date || '')) && reference.expiry_date < new Date().toISOString().slice(0,10);
    const findings = [];
    if (mismatches.length) findings.push({ type: 'MISMATCH', fields: mismatches.map((item) => item.field) });
    if (expired) findings.push({ type: 'EXPIRED', field: 'expiry_date', value: reference.expiry_date });
    if (missingFields.length) findings.push({ type: 'MISSING_FIELDS', fields: missingFields });
    if (missingDocuments.length) findings.push({ type: 'MISSING_DOCUMENTS', documentTypes: missingDocuments });
    if (record.review_required) findings.push({ type: 'MANUAL_REVIEW', note: 'This synthetic fixture is designated for manual review; it does not establish alteration or fraud.' });

    let result = 'DEMO_MATCH';
    if (record.review_required || missingFields.length || missingDocuments.length) result = 'DEMO_REVIEW_REQUIRED';
    else if (mismatches.length) result = 'DEMO_MISMATCH';
    else if (expired) result = 'DEMO_EXPIRED';
    return { result, sourceValues: { source: 'DEMO_REGISTRY', official: false, registryId: record.registry_id,
      scenario: record.scenario_label, recordKind: record.record_kind, reference, comparisons, missingFields, missingDocuments, findings },
      evidenceReference: `demo-registry:${record.registry_id}`, error: '' };
  }
}

export class DigiLockerRequesterAdapter extends DocumentSourceAdapter {
  async getConnectionStatus() {
    return { provider: 'DIGILOCKER', status: 'NOT_CONNECTED', official: false,
      note: 'Requester credentials, approved partner configuration and consent workflow are not present. No DigiLocker endpoint is configured or contacted.' };
  }
  async beginAuthorization() { throw Object.assign(new Error('DigiLocker requester access is not configured.'), { code: 'DIGILOCKER_NOT_CONNECTED' }); }
  async handleAuthorizationCallback() { throw Object.assign(new Error('DigiLocker requester access is not configured.'), { code: 'DIGILOCKER_NOT_CONNECTED' }); }
  async listAuthorizedDocuments() { throw Object.assign(new Error('DigiLocker requester access is not configured.'), { code: 'DIGILOCKER_NOT_CONNECTED' }); }
  async importDocument() { throw Object.assign(new Error('DigiLocker requester access is not configured.'), { code: 'DIGILOCKER_NOT_CONNECTED' }); }
  async revokeAuthorization() { throw Object.assign(new Error('DigiLocker requester access is not configured.'), { code: 'DIGILOCKER_NOT_CONNECTED' }); }
}

export async function trustHubStatus() {
  const demo = new DemoRegistryAdapter();
  const digilocker = new DigiLockerRequesterAdapter();
  return { sources: [await demo.getConnectionStatus(), await digilocker.getConnectionStatus()], demoCases: await demo.listAuthorizedDocuments() };
}
