import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { db, execute, oneRow, allRows } from './db.mjs';
import { writeAudit } from './audit.mjs';

const SESSION_COOKIE = 'pramaan_session';
const hours = Math.min(Math.max(Number(process.env.SESSION_TTL_HOURS || 8), 1), 24);
const sessionMs = hours * 60 * 60 * 1000;

export function passwordIssue(password) {
  if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters.';
  if (password.length > 256) return 'Password must be 256 characters or fewer.';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Use upper- and lowercase letters and at least one number.';
  return '';
}

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `$scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function matchesPassword(password, encoded) {
  const [, algorithm, saltText, hashText] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltText || !hashText) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(hashText, 'base64url');
    const actual = scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function bootstrapRequired() {
  return Number(oneRow('SELECT COUNT(*) AS count FROM users').count) === 0;
}

export function createInitialAdministrator(input, context) {
  if (!bootstrapRequired()) throw Object.assign(new Error('Initial administrator setup is already closed.'), { status: 409 });
  const email = String(input.email || '').trim().toLowerCase();
  const name = String(input.displayName || '').trim();
  const password = String(input.password || '');
  const issue = passwordIssue(password);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw Object.assign(new Error('Enter a valid official email address.'), { status: 400 });
  if (name.length < 2 || name.length > 100) throw Object.assign(new Error('Enter a name between 2 and 100 characters.'), { status: 400 });
  if (issue) throw Object.assign(new Error(issue), { status: 400 });
  const id = randomUUID();
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!bootstrapRequired()) throw Object.assign(new Error('Initial administrator setup is already closed.'), { status: 409 });
    execute('INSERT INTO users(id, email, display_name, password_hash, created_at) VALUES(?, ?, ?, ?, ?)', id, email, name, hashPassword(password), now);
    execute('INSERT INTO user_roles(user_id, role_id) VALUES(?, ?)', id, 'SYSTEM_ADMINISTRATOR');
    writeAudit({ ...context, user: { id, roles: ['SYSTEM_ADMINISTRATOR'] } }, 'BOOTSTRAP_ADMIN_CREATED', 'USER', id, '', { email, role: 'SYSTEM_ADMINISTRATOR' });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  const session = createSession(id, context);
  return session;
}

export function signIn(emailInput, password, context) {
  const email = String(emailInput || '').trim().toLowerCase();
  const user = oneRow('SELECT * FROM users WHERE email = ? COLLATE NOCASE', email);
  if (!user || !user.active) throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
  if (user.locked_until && user.locked_until > new Date().toISOString()) throw Object.assign(new Error('This account is temporarily locked. Contact your system administrator.'), { status: 423 });
  if (!matchesPassword(String(password || ''), user.password_hash)) {
    const attempts = user.failed_attempts + 1;
    const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    execute('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', attempts, lockedUntil, user.id);
    writeAudit({ ...context, user: { id: user.id, roles: [] } }, 'AUTHENTICATION_FAILED', 'USER', user.id, '', { attempts, locked: Boolean(lockedUntil) });
    throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 });
  }
  execute('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', new Date().toISOString(), user.id);
  writeAudit({ ...context, user: { id: user.id, roles: getRoles(user.id) } }, 'AUTHENTICATION_SUCCEEDED', 'USER', user.id);
  return createSession(user.id, context);
}

function getRoles(userId) {
  return allRows('SELECT r.id FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?', userId).map((row) => row.id);
}

function createSession(userId, context) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + sessionMs);
  const sessionId = randomUUID();
  execute('INSERT INTO sessions(id, user_id, token_hash, created_at, expires_at, ip_address, user_agent) VALUES(?, ?, ?, ?, ?, ?, ?)',
    sessionId, userId, createHash('sha256').update(token).digest('hex'), now.toISOString(), expires.toISOString(), context?.ip || '', context?.userAgent || '');
  return { token, sessionId, expiresAt: expires.toISOString(), user: userForId(userId) };
}

function userForId(userId) {
  const row = oneRow('SELECT id, email, display_name, institution_id, must_change_password FROM users WHERE id = ? AND active = 1', userId);
  if (!row) return null;
  const roles = getRoles(userId);
  const permissions = allRows(`SELECT DISTINCT p.id FROM permissions p
    JOIN role_permissions rp ON rp.permission_id=p.id JOIN user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=?`, userId).map((item) => item.id);
  return { ...row, roles, permissions };
}

export function readSession(request) {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  const hash = createHash('sha256').update(token).digest('hex');
  const session = oneRow(`SELECT s.id AS session_id, s.user_id FROM sessions s
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?`, hash, new Date().toISOString());
  if (!session) return null;
  const user = userForId(session.user_id);
  return user ? { user, sessionId: session.session_id } : null;
}

export function revokeSession(context) {
  if (!context?.sessionId) return;
  execute('UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL', new Date().toISOString(), context.sessionId);
  writeAudit(context, 'SESSION_REVOKED', 'SESSION', context.sessionId);
}

export function sessionCookie(token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

function readCookie(header = '', name) {
  for (const item of String(header).split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return value.join('=');
  }
  return '';
}
