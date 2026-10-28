import { randomUUID } from 'node:crypto';
import { execute } from './db.mjs';

export function writeAudit(context, action, entityType, entityId, previousState = '', newState = '', reference = '') {
  execute(`INSERT INTO audit_events(id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state, reference, ip_address, session_id, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  randomUUID(), context?.user?.id || null, context?.actorRole || (context?.user?.roles || []).join(','), action, entityType, entityId,
  serialize(previousState), serialize(newState), reference, context?.ip || '', context?.sessionId || '', new Date().toISOString());
}

function serialize(value) {
  if (value === null || value === undefined || value === '') return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}
