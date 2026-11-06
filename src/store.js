import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeedState } from './seed.js';
import { scrubAuditMetadata } from './security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_STORE_PATH = path.join(__dirname, '..', 'data', 'aros-runtime.json');

export function createStore(customFilePath = null) {
  const storePath = customFilePath || process.env.AROS_STORE_PATH || DEFAULT_STORE_PATH;
  let memoryCache = null;

  function load() {
    if (memoryCache) return memoryCache;
    try {
      if (fs.existsSync(storePath)) {
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (parsed && Array.isArray(parsed.organizations)) {
          memoryCache = parsed;
          return memoryCache;
        }
      }
    } catch {
      // Fall back to clean seed state if file is unreadable
    }
    memoryCache = buildSeedState();
    persist();
    return memoryCache;
  }

  function persist() {
    if (!memoryCache) return;
    try {
      fs.mkdirSync(path.dirname(storePath), { recursive: true });
      fs.writeFileSync(storePath, JSON.stringify(memoryCache, null, 2), 'utf8');
    } catch {
      // Serverless read-only fs gracefully retains in-memory state until Supabase Postgres is wired
    }
  }

  function appendAudit({ org_id, actor_email, actor_role, action, metadata = {} }) {
    const db = load();
    const entry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      org_id: org_id || 'global',
      actor_email: actor_email || 'anonymous',
      actor_role: actor_role || 'none',
      action,
      metadata: scrubAuditMetadata(metadata),
      created_at: new Date().toISOString()
    };
    db.audit_logs.unshift(entry);
    db.audit_logs = db.audit_logs.slice(0, 250);
    persist();
    return entry;
  }

  function getTenantSlice(orgId) {
    const db = load();
    const org = db.organizations.find((o) => o.id === orgId);
    if (!org) return null;
    return {
      org,
      users: db.users
        .filter((u) => u.org_id === orgId)
        .map(({ password_hash, ...safeUser }) => safeUser),
      locations: db.locations.filter((l) => l.org_id === orgId),
      leads: db.leads.filter((l) => l.org_id === orgId),
      customers: db.customers.filter((c) => c.org_id === orgId),
      memberships: db.memberships.filter((m) => m.org_id === orgId),
      workflow_tasks: db.workflow_tasks.filter((w) => w.org_id === orgId),
      weekly_trends: db.weekly_trends.filter((t) => t.org_id === orgId),
      csv_imports: db.csv_imports.filter((i) => i.org_id === orgId),
      audit_logs: db.audit_logs.filter((a) => a.org_id === orgId),
      integrations: db.integrations
    };
  }

  return {
    load,
    persist,
    appendAudit,
    getTenantSlice,
    resetToSeed() {
      memoryCache = buildSeedState();
      persist();
      return memoryCache;
    }
  };
}

export const defaultStore = createStore();
