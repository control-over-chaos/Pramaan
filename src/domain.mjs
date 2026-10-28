import { randomUUID } from 'node:crypto';
import { allRows, execute, oneRow } from './db.mjs';
import { writeAudit } from './audit.mjs';
import { workflowBlockers } from './evidence.mjs';

export function requirePermission(context, permission) {
  if (!context?.user?.permissions?.includes(permission)) throw Object.assign(new Error('You do not have permission to perform this action.'), { status: 403 });
}

export function appRecord(applicationId) {
  return oneRow(`SELECT a.*, i.name AS institution_name, i.aicte_id, i.state_ut, ac.label AS category_label,
    u.display_name AS assigned_officer FROM applications a JOIN institutions i ON i.id=a.institution_id
    JOIN application_categories ac ON ac.id=a.category_id LEFT JOIN users u ON u.id=a.assigned_user_id WHERE a.id=?`, applicationId);
}

export function ensureInstitutionScope(context, institutionId) {
  if (context.user.roles.includes('INSTITUTION_USER') && context.user.institution_id !== institutionId) {
    throw Object.assign(new Error('This record is outside your institution access scope.'), { status: 404 });
  }
}

export function ensureApplicationScope(context, applicationId) {
  const application = appRecord(applicationId);
  if (!application) throw Object.assign(new Error('Application not found.'), { status: 404 });
  ensureInstitutionScope(context, application.institution_id);
  return application;
}

export function applicationPriority(applicationId, dueDate) {
  const openFindings = allRows(`SELECT severity, title FROM findings WHERE application_id=?
    AND status IN ('OPEN','UNDER_REVIEW','VERIFICATION_REQUIRED','RECTIFICATION_REQUESTED','INSPECTION_RECOMMENDED')`, applicationId);
  const factors = openFindings.map((f) => f.title);
  const severities = openFindings.map((f) => f.severity.toUpperCase());
  const overdue=Boolean(dueDate&&dueDate<new Date().toISOString().slice(0,10));
  if(overdue)factors.push('Action due date has passed');
  if (severities.includes('CRITICAL')) return { value: 'CRITICAL REVIEW', factors };
  if (severities.includes('HIGH')) return { value: 'HIGH', factors };
  if (severities.includes('MEDIUM')||overdue) return { value: 'MEDIUM', factors };
  if (severities.includes('LOW')) return { value: 'LOW', factors };
  return { value: 'LOW', factors: [] };
}

const transitions = {
  RECEIVED: ['PRE_VALIDATION'],
  PRE_VALIDATION: ['DOCUMENT_PROCESSING'],
  DOCUMENT_PROCESSING: ['SOURCE_VERIFICATION', 'COMPLIANCE_REVIEW'],
  SOURCE_VERIFICATION: ['COMPLIANCE_REVIEW'],
  COMPLIANCE_REVIEW: ['OFFICER_REVIEW'],
  OFFICER_REVIEW: ['RECTIFICATION_REQUIRED', 'INSPECTION_RECOMMENDED', 'FINAL_REVIEW'],
  RECTIFICATION_REQUIRED: ['RECTIFICATION_RECEIVED'],
  RECTIFICATION_RECEIVED: ['DOCUMENT_PROCESSING', 'OFFICER_REVIEW'],
  INSPECTION_RECOMMENDED: ['INSPECTION_IN_PROGRESS', 'FINAL_REVIEW'],
  INSPECTION_IN_PROGRESS: ['FINAL_REVIEW'],
  FINAL_REVIEW: ['COMPLETED'],
  COMPLETED: [],
};

export function transitionApplication(context, applicationId, nextStage, overrideReason='') {
  requirePermission(context, 'application.review');
  const current = ensureApplicationScope(context, applicationId);
  if (!(transitions[current.processing_stage] || []).includes(nextStage)) {
    throw Object.assign(new Error(`Transition from ${current.processing_stage} to ${nextStage} is not allowed.`), { status: 409 });
  }
  if(['FINAL_REVIEW','COMPLETED'].includes(nextStage)) {
    const blockers=workflowBlockers(applicationId);
    if(blockers.length) {
      if(!context.user.roles.some(r=>['APPROVING_AUTHORITY','REGULATORY_ADMINISTRATOR'].includes(r))||overrideReason.trim().length<20)throw Object.assign(new Error(`Stage blocked: ${blockers.join(' ')} An approving authority may record an explicit, reasoned override.`),{status:409});
      writeAudit(context,'WORKFLOW_BLOCKER_OVERRIDE','APPLICATION',applicationId,blockers,{nextStage,reason:overrideReason.trim()});
    }
  }
  const now = new Date().toISOString();
  execute('UPDATE applications SET processing_stage=?, updated_at=?, version=version+1 WHERE id=?', nextStage, now, applicationId);
  writeAudit(context, 'APPLICATION_STAGE_CHANGED', 'APPLICATION', applicationId, current.processing_stage, nextStage);
  return appRecord(applicationId);
}

export function addNotification(userId, eventType, title, body, entityType = '', entityId = '') {
  const id = randomUUID();
  execute('INSERT INTO notifications(id, user_id, event_type, title, body, entity_type, entity_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
    id, userId, eventType, title, body, entityType, entityId, new Date().toISOString());
  return id;
}

export function validUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)); }
export function safeJson(value, fallback = {}) { try { return JSON.parse(value); } catch { return fallback; } }
