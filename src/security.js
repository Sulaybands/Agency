import crypto from 'node:crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'aesthetic-revos-dev-hmac-secret-change-in-production-2026';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export const ROLE_PERMISSIONS = {
  owner: new Set([
    'read:dashboard',
    'read:opportunities',
    'read:workflows',
    'write:workflows',
    'approve:communications',
    'write:imports',
    'write:locations',
    'read:prospects',
    'write:prospects',
    'read:audit',
    'manage:org',
    'delete:data'
  ]),
  operator: new Set([
    'read:dashboard',
    'read:opportunities',
    'read:workflows',
    'write:workflows',
    'approve:communications',
    'write:imports',
    'write:locations',
    'read:prospects',
    'write:prospects',
    'read:audit'
  ]),
  viewer: new Set([
    'read:dashboard',
    'read:opportunities',
    'read:workflows',
    'read:prospects'
  ])
};

// Strictly prohibited clinical / PHI / sensitive identity column patterns
const PROHIBITED_CLINICAL_PATTERNS = [
  /\bdiagnos(is|es)\b/i,
  /\bicd[-_ ]?10\b/i,
  /\bclinical[-_ ]?note/i,
  /\bchart[-_ ]?note/i,
  /\bmedical[-_ ]?histor/i,
  /\bprescri(ption|ber)\b/i,
  /\brx[-_ ]?(number|lot)\b/i,
  /\ballerg(y|ies)\b/i,
  /\bssn\b/i,
  /\bsocial[-_ ]?security/i,
  /\bpatient[-_ ]?chart/i,
  /\bblood[-_ ]?type/i,
  /\bhipaa[-_ ]?phi\b/i
];

export function detectProhibitedColumns(headers = []) {
  const flagged = [];
  for (const rawHeader of headers) {
    const h = String(rawHeader || '').trim();
    if (PROHIBITED_CLINICAL_PATTERNS.some((rx) => rx.test(h))) {
      flagged.push(h);
    }
  }
  return flagged;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const derived = crypto.scryptSync(String(password), salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signSessionToken(user) {
  const payload = {
    sub: user.id,
    org_id: user.org_id,
    role: user.role,
    email: user.email,
    name: user.name,
    exp: Date.now() + SESSION_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!payload.sub || !payload.org_id || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractSession(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const session = verifySessionToken(authHeader.slice(7).trim());
    if (session) return session;
  }
  const cookieHeader = req.headers?.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)aros_session=([^;]+)/);
  if (match) {
    return verifySessionToken(decodeURIComponent(match[1]));
  }
  return null;
}

export function hasPermission(role, permission) {
  const set = ROLE_PERMISSIONS[role];
  return Boolean(set && set.has(permission));
}

export function sanitizeString(val, maxLen = 280) {
  return String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function scrubAuditMetadata(meta = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/password|secret|token|key|phone|email/i.test(k)) continue;
    clean[k] = typeof v === 'string' ? v.slice(0, 200) : v;
  }
  return clean;
}
