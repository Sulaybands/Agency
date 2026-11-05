import {
  verifyPassword,
  signSessionToken,
  extractSession,
  hasPermission,
  sanitizeString
} from './security.js';
import {
  computeLocationMetrics,
  detectOpportunities,
  computeConsultationFunnel,
  computeProvableRoi,
  generateWeeklyExecutiveReport
} from './engine.js';
import { validateAndPreviewCsv } from './csvImporter.js';
import { draftApprovedCommunication, getLlmStatus } from './llm.js';

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(extraHeaders)) {
    res.setHeader(k, v);
  }
  res.end(JSON.stringify(payload));
}

export function createApiHandler(store) {
  return async function handleApi(req, res) {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      return res.end();
    }

    try {
      const db = store.load();

      // Public health & capability status
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          product: 'Aesthetic Revenue OS',
          llm: getLlmStatus(),
          supabase_configured: Boolean(process.env.SUPABASE_URL)
        });
      }

      // Authentication: Login (supports standard credentials + synthetic demo persona switcher)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const email = sanitizeString(body.email, 140).toLowerCase();
        const password = String(body.password || '');
        const demoPersona = sanitizeString(body.demo_persona, 60);

        let user = null;
        if (demoPersona) {
          const personaMap = {
            owner: 'ceo@lumina-demo.example',
            operator: 'revops@lumina-demo.example',
            viewer: 'cfo-readonly@lumina-demo.example',
            tenant_b: 'owner@radiance-demo.example'
          };
          const targetEmail = personaMap[demoPersona];
          const candidate = db.users.find((u) => u.email === targetEmail);
          const candidateOrg = candidate
            ? db.organizations.find((o) => o.id === candidate.org_id)
            : null;
          if (candidate && candidateOrg?.is_synthetic) {
            user = candidate;
          }
        } else {
          const candidate = db.users.find((u) => u.email.toLowerCase() === email);
          if (candidate && verifyPassword(password, candidate.password_hash)) {
            user = candidate;
          }
        }

        if (!user) {
          store.appendAudit({
            org_id: 'global',
            actor_email: email || 'unknown',
            actor_role: 'none',
            action: 'AUTH_LOGIN_FAILED',
            metadata: { reason: 'Invalid credentials' }
          });
          return sendJson(res, 401, { ok: false, error: 'Invalid email or password.' });
        }

        const token = signSessionToken(user);
        store.appendAudit({
          org_id: user.org_id,
          actor_email: user.email,
          actor_role: user.role,
          action: 'AUTH_LOGIN_SUCCESS',
          metadata: { role: user.role }
        });

        const org = db.organizations.find((o) => o.id === user.org_id);
        return sendJson(
          res,
          200,
          {
            ok: true,
            token,
            user: {
              id: user.id,
              org_id: user.org_id,
              org_name: org?.name || '',
              email: user.email,
              name: user.name,
              role: user.role
            }
          },
          {
            'Set-Cookie': `aros_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
          }
        );
      }

      if (pathname === '/api/auth/logout' && method === 'POST') {
        return sendJson(
          res,
          200,
          { ok: true },
          { 'Set-Cookie': 'aros_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' }
        );
      }

      // Require valid authenticated session for all protected routes below
      const session = extractSession(req);
      if (!session) {
        return sendJson(res, 401, {
          ok: false,
          error: 'Authentication required. Sign in or select a synthetic demo persona.'
        });
      }

      const requirePerm = (perm) => {
        if (!hasPermission(session.role, perm)) {
          store.appendAudit({
            org_id: session.org_id,
            actor_email: session.email,
            actor_role: session.role,
            action: 'RBAC_DENIED',
            metadata: { required_permission: perm, path: pathname }
          });
          sendJson(res, 403, {
            ok: false,
            error: `Forbidden: Role "${session.role}" lacks required permission "${perm}".`
          });
          return false;
        }
        return true;
      };

      const slice = store.getTenantSlice(session.org_id);
      if (!slice) {
        return sendJson(res, 403, { ok: false, error: 'Organization context not found.' });
      }

      if (pathname === '/api/auth/me' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          user: {
            id: session.sub,
            org_id: session.org_id,
            org_name: slice.org.name,
            email: session.email,
            name: session.name,
            role: session.role
          }
        });
      }

      // Full Tenant-Isolated Platform State & Computed Intelligence
      if (pathname === '/api/overview' && method === 'GET') {
        if (!requirePerm('read:dashboard')) return;

        const locationMetrics = computeLocationMetrics({
          org: slice.org,
          locations: slice.locations,
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships
        });

        const opportunities = detectOpportunities({
          org: slice.org,
          locations: slice.locations,
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships
        });

        const funnel = computeConsultationFunnel({
          leads: slice.leads,
          locations: slice.locations
        });

        const roi = computeProvableRoi({
          org: slice.org,
          opportunities,
          workflowTasks: slice.workflow_tasks,
          leads: slice.leads,
          memberships: slice.memberships
        });

        const executiveReport = generateWeeklyExecutiveReport({
          org: slice.org,
          locationMetrics,
          opportunities,
          roi,
          weeklyTrends: slice.weekly_trends
        });

        return sendJson(res, 200, {
          ok: true,
          organization: slice.org,
          current_user: {
            email: session.email,
            name: session.name,
            role: session.role
          },
          llm_status: getLlmStatus(),
          locations: slice.locations,
          location_metrics: locationMetrics,
          opportunities,
          funnel,
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships,
          workflow_tasks: slice.workflow_tasks,
          roi,
          weekly_trends: slice.weekly_trends,
          executive_report: executiveReport,
          integrations: slice.integrations,
          csv_imports: slice.csv_imports,
          team_users: slice.users
        });
      }

      // Add a new clinic location (Tenant-scoped)
      if (pathname === '/api/locations' && method === 'POST') {
        if (!requirePerm('write:locations')) return;
        const body = await parseJsonBody(req);
        const name = sanitizeString(body.name, 100);
        const code = sanitizeString(body.code, 16).toUpperCase();
        const stateCode = sanitizeString(body.state || 'TX', 8).toUpperCase();
        const posSystem = sanitizeString(body.pos_system || 'CSV Export', 80);

        if (!name || !code) {
          return sendJson(res, 400, { ok: false, error: 'Location name and code are required.' });
        }

        const newLoc = {
          id: `loc-${Date.now()}`,
          org_id: session.org_id,
          code,
          name,
          state: stateCode,
          pos_system: posSystem,
          monthly_revenue_target: Math.max(20000, Number(body.monthly_revenue_target) || 140000),
          active_providers: Math.max(1, Number(body.active_providers) || 4),
          is_synthetic: Boolean(slice.org.is_synthetic)
        };
        db.locations.push(newLoc);
        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'LOCATION_CREATED',
          metadata: { code, name }
        });
        return sendJson(res, 201, { ok: true, location: newLoc });
      }

      // Convert an Opportunity into a Workflow Task with Human-Reviewable Draft
      if (pathname === '/api/opportunities/queue-workflow' && method === 'POST') {
        if (!requirePerm('write:workflows')) return;
        const body = await parseJsonBody(req);
        const oppId = sanitizeString(body.opportunity_id, 80);

        const opportunities = detectOpportunities({
          org: slice.org,
          locations: slice.locations,
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships
        });
        const opp = opportunities.find((o) => o.id === oppId);
        if (!opp) {
          return sendJson(res, 404, {
            ok: false,
            error: 'Opportunity not found in your organization.'
          });
        }

        const draft = await draftApprovedCommunication({
          category: opp.category,
          recipientName: sanitizeString(body.recipient_name || 'Valued Guest', 80),
          locationName: opp.location_name,
          orgName: slice.org.name
        });

        const task = {
          id: `wf-${Date.now()}`,
          org_id: session.org_id,
          location_id: opp.location_id,
          category: opp.category,
          title: `[${opp.location_name}] ${opp.module}: ${opp.what_happened.slice(0, 72)}`,
          target_record_id: opp.id,
          recipient_name: sanitizeString(body.recipient_name || 'Eligible Cohort', 80),
          marketing_consent: true,
          opted_out: Boolean(body.opted_out),
          owner_name: session.name,
          approval_status: 'pending_approval',
          lifecycle_stage: 'estimated',
          estimated_value: opp.estimated_recoverable,
          collected_revenue: 0,
          receipt_reference: null,
          draft_message: draft.body,
          draft_source: draft.source,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_synthetic: opp.is_synthetic
        };

        db.workflow_tasks.unshift(task);
        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'WORKFLOW_QUEUED_FOR_APPROVAL',
          metadata: { task_id: task.id, opportunity_id: opp.id }
        });

        return sendJson(res, 201, { ok: true, task });
      }

      // Human Approval Gate for Workflow Communications (Enforces Tenant + RBAC + Opt-Out Check)
      const approveMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/approve$/);
      if (approveMatch && method === 'POST') {
        if (!requirePerm('approve:communications')) return;
        const taskId = decodeURIComponent(approveMatch[1]);
        const task = db.workflow_tasks.find((t) => t.id === taskId);

        if (!task || task.org_id !== session.org_id) {
          store.appendAudit({
            org_id: session.org_id,
            actor_email: session.email,
            actor_role: session.role,
            action: 'CROSS_TENANT_OR_MISSING_WORKFLOW_BLOCKED',
            metadata: { task_id: taskId }
          });
          return sendJson(res, 404, { ok: false, error: 'Workflow task not found.' });
        }

        if (task.opted_out || !task.marketing_consent) {
          return sendJson(res, 400, {
            ok: false,
            error: 'Compliance Block: Contact has opted out or lacks marketing consent. Approval denied.'
          });
        }

        const body = await parseJsonBody(req);
        if (body.edited_message) {
          task.draft_message = sanitizeString(body.edited_message, 1000);
        }

        const now = new Date().toISOString();
        task.approval_status = 'approved';
        task.approved_by = `${session.name} (${session.role})`;
        task.approved_at = now;
        task.action_initiated_at = now;
        if (task.lifecycle_stage === 'estimated' || task.lifecycle_stage === 'identified') {
          task.lifecycle_stage = 'action_initiated';
        }
        task.updated_at = now;

        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'COMMUNICATION_HUMAN_APPROVED',
          metadata: { task_id: task.id, lifecycle_stage: task.lifecycle_stage }
        });

        return sendJson(res, 200, { ok: true, task });
      }

      // Update Workflow Attribution Stage (Requires Receipt Reference for Collected Revenue!)
      const stageMatch = pathname.match(/^\/api\/workflows\/([^/]+)\/stage$/);
      if (stageMatch && method === 'POST') {
        if (!requirePerm('write:workflows')) return;
        const taskId = decodeURIComponent(stageMatch[1]);
        const task = db.workflow_tasks.find((t) => t.id === taskId);

        if (!task || task.org_id !== session.org_id) {
          return sendJson(res, 404, { ok: false, error: 'Workflow task not found.' });
        }

        if (task.approval_status !== 'approved') {
          return sendJson(res, 400, {
            ok: false,
            error: 'Workflow must pass human approval before advancing outcome attribution stages.'
          });
        }

        const body = await parseJsonBody(req);
        const nextStage = sanitizeString(body.lifecycle_stage, 40);
        const allowed = ['action_initiated', 'appointment_booked', 'sale_completed', 'revenue_collected'];
        if (!allowed.includes(nextStage)) {
          return sendJson(res, 400, { ok: false, error: 'Invalid lifecycle_stage.' });
        }

        if (nextStage === 'revenue_collected') {
          const amount = Number(body.collected_revenue);
          const receiptRef = sanitizeString(body.receipt_reference, 120);
          if (!receiptRef || Number.isNaN(amount) || amount <= 0) {
            return sendJson(res, 400, {
              ok: false,
              error: 'Provable ROI Rule: Advancing to revenue_collected requires a positive collected_revenue amount and a verifiable POS receipt_reference.'
            });
          }
          task.collected_revenue = amount;
          task.receipt_reference = receiptRef;
        }

        task.lifecycle_stage = nextStage;
        task.updated_at = new Date().toISOString();
        store.persist();

        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'WORKFLOW_STAGE_UPDATED',
          metadata: {
            task_id: task.id,
            lifecycle_stage: nextStage,
            has_receipt: Boolean(task.receipt_reference)
          }
        });

        return sendJson(res, 200, { ok: true, task });
      }

      // Universal CSV Import Step 1: Validate & Preview (Zero DB mutation)
      if (pathname === '/api/imports/preview' && method === 'POST') {
        if (!requirePerm('write:imports')) return;
        const body = await parseJsonBody(req);
        const entityType = sanitizeString(body.entity_type, 30);
        const csvText = String(body.csv_text || '');

        const existingMap = {
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships
        };

        const preview = validateAndPreviewCsv({
          entityType,
          csvText,
          customMapping: body.custom_mapping || null,
          orgLocations: slice.locations,
          existingRecords: existingMap[entityType] || []
        });

        if (!preview.ok) {
          store.appendAudit({
            org_id: session.org_id,
            actor_email: session.email,
            actor_role: session.role,
            action: preview.complianceBlocked ? 'CSV_PHI_BLOCKED' : 'CSV_PREVIEW_REJECTED',
            metadata: { entity_type: entityType, reason: preview.error }
          });
          return sendJson(res, 400, preview);
        }

        const { allValidRecords, ...clientSafePreview } = preview;
        return sendJson(res, 200, clientSafePreview);
      }

      // Universal CSV Import Step 2: Confirm & Commit Records
      if (pathname === '/api/imports/commit' && method === 'POST') {
        if (!requirePerm('write:imports')) return;
        const body = await parseJsonBody(req);
        const entityType = sanitizeString(body.entity_type, 30);
        const filename = sanitizeString(body.filename || `${entityType}-upload.csv`, 120);
        const csvText = String(body.csv_text || '');

        const existingMap = {
          leads: slice.leads,
          customers: slice.customers,
          memberships: slice.memberships
        };

        const validated = validateAndPreviewCsv({
          entityType,
          csvText,
          customMapping: body.custom_mapping || null,
          orgLocations: slice.locations,
          existingRecords: existingMap[entityType] || []
        });

        if (!validated.ok) {
          return sendJson(res, 400, validated);
        }

        const toInsert = validated.allValidRecords.map((rec, idx) => ({
          id: `${entityType.slice(0, 2)}-imp-${Date.now()}-${idx}`,
          org_id: session.org_id,
          ...rec
        }));

        if (entityType === 'leads') db.leads.unshift(...toInsert);
        if (entityType === 'customers') db.customers.unshift(...toInsert);
        if (entityType === 'memberships') db.memberships.unshift(...toInsert);

        const importEntry = {
          id: `imp-${Date.now()}`,
          org_id: session.org_id,
          entity_type: entityType,
          filename,
          imported_by: `${session.name} (${session.role})`,
          total_rows: validated.summary.totalRows,
          committed_rows: toInsert.length,
          duplicate_rows: validated.summary.duplicateCount,
          invalid_rows: validated.summary.invalidCount,
          created_at: new Date().toISOString()
        };
        db.csv_imports.unshift(importEntry);
        store.persist();

        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'CSV_IMPORT_COMMITTED',
          metadata: {
            entity_type: entityType,
            committed_rows: toInsert.length,
            duplicate_rows: validated.summary.duplicateCount
          }
        });

        return sendJson(res, 201, {
          ok: true,
          import_record: importEntry,
          committed_count: toInsert.length
        });
      }

      // Internal Prospecting Engine (Publicly Verified Multi-Location Aesthetics Groups)
      if (pathname === '/api/prospects' && method === 'GET') {
        if (!requirePerm('read:prospects')) return;
        const ranked = [...db.prospects].sort((a, b) => b.fit_score - a.fit_score);
        return sendJson(res, 200, { ok: true, prospects: ranked });
      }

      if (pathname === '/api/prospects' && method === 'POST') {
        if (!requirePerm('write:prospects')) return;
        const body = await parseJsonBody(req);
        const companyName = sanitizeString(body.company_name, 120);
        const website = sanitizeString(body.website, 180);
        const sourceUrl = sanitizeString(body.source_url, 240);

        if (!companyName || !website || !sourceUrl) {
          return sendJson(res, 400, {
            ok: false,
            error: 'company_name, website, and at least one verifiable source_url are required.'
          });
        }

        const locCount = Math.max(1, Number(body.approx_locations) || 5);
        // Deterministic fit score prioritizing 5–50 location groups with clear buying triggers
        let score = 60;
        if (locCount >= 5 && locCount <= 50) score += 20;
        else if (locCount > 50) score += 10;
        if (body.buying_triggers) score += 10;
        if (body.public_leadership) score += 6;

        const created = {
          id: `pr-${Date.now()}`,
          company_name: companyName,
          website,
          approx_locations: locCount,
          footprint: sanitizeString(body.footprint || 'United States', 160),
          public_leadership: sanitizeString(body.public_leadership || 'Not publicly listed', 200),
          tech_and_ops_signals: sanitizeString(body.tech_and_ops_signals || 'Pending verification', 240),
          expansion_signals: sanitizeString(body.expansion_signals || 'None verified yet', 240),
          hiring_signals: sanitizeString(body.hiring_signals || 'None verified yet', 240),
          buying_triggers: sanitizeString(body.buying_triggers || 'Multi-location standardization', 240),
          source_urls: [sourceUrl],
          date_verified: new Date().toISOString().slice(0, 10),
          confidence: sanitizeString(body.confidence || 'MEDIUM', 20),
          fit_score: Math.min(99, score),
          recommended_angle: sanitizeString(
            body.recommended_angle ||
              'Paid 30-day proof-of-value revenue visibility & lead-recovery pilot using existing POS exports.',
            260
          )
        };

        db.prospects.push(created);
        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'PROSPECT_ADDED',
          metadata: { company_name: companyName, approx_locations: locCount }
        });
        return sendJson(res, 201, { ok: true, prospect: created });
      }

      const prospectDraftMatch = pathname.match(/^\/api\/prospects\/([^/]+)\/draft$/);
      if (prospectDraftMatch && method === 'POST') {
        if (!requirePerm('read:prospects')) return;
        const prId = decodeURIComponent(prospectDraftMatch[1]);
        const pr = db.prospects.find((p) => p.id === prId);
        if (!pr) {
          return sendJson(res, 404, { ok: false, error: 'Prospect not found.' });
        }

        const execFirst =
          pr.public_leadership.match(/^([A-Z][a-z]+)/)?.[1] || 'Team';
        const draft = {
          status: 'DRAFT_REQUIRES_HUMAN_SEND',
          subject: `Cross-clinic conversion & retention visibility across ${pr.company_name}'s ${pr.approx_locations} locations`,
          body: `Hi ${execFirst},\n\nFollowing ${pr.company_name}'s footprint across ${pr.footprint} (${pr.buying_triggers.slice(
            0,
            110
          )}).\n\nAcross 5–50 location aesthetics groups, existing POS systems (Boulevard/Zenoti/Aesthetic Record) handle chairside checkout well, but leave leadership blind to cross-studio inquiry response lag, unbooked consultations, and 110+ day single-visit drop-offs.\n\nWe built Aesthetic Revenue OS as a zero-disruption revenue intelligence layer that ingests standard non-clinical POS/CRM exports in 48 hours—separating raw identified leaks from POS-verified recovered receipts.\n\nOpen to a 12-minute walkthrough using a synthetic 8-clinic benchmark environment this week?\n\nBest,\n[Your Name]\n[Your Physical Mailing Address · Unsubscribe / Opt-out anytime]`
        };
        return sendJson(res, 200, { ok: true, prospect: pr, outreach_draft: draft });
      }

      // Audit Logs (Tenant-isolated)
      if (pathname === '/api/audit-logs' && method === 'GET') {
        if (!requirePerm('read:audit')) return;
        return sendJson(res, 200, { ok: true, audit_logs: slice.audit_logs });
      }

      // Organization Settings update
      if (pathname === '/api/settings' && method === 'PATCH') {
        if (!requirePerm('manage:org')) return;
        const body = await parseJsonBody(req);
        const orgRecord = db.organizations.find((o) => o.id === session.org_id);
        if (body.sla_target_minutes !== undefined) {
          orgRecord.settings.sla_target_minutes = Math.max(1, Number(body.sla_target_minutes) || 15);
        }
        if (body.inactivity_threshold_days !== undefined) {
          orgRecord.settings.inactivity_threshold_days = Math.max(
            30,
            Number(body.inactivity_threshold_days) || 110
          );
        }
        if (body.attribution_window_days !== undefined) {
          orgRecord.settings.attribution_window_days = Math.max(
            7,
            Number(body.attribution_window_days) || 30
          );
        }
        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'ORG_SETTINGS_UPDATED',
          metadata: orgRecord.settings
        });
        return sendJson(res, 200, { ok: true, settings: orgRecord.settings });
      }

      // Data Deletion Procedure: Purge Tenant Imported Data (Owner Only)
      if (pathname === '/api/settings/purge-imported' && method === 'POST') {
        if (!requirePerm('delete:data')) return;
        const beforeCounts = {
          leads: db.leads.length,
          customers: db.customers.length,
          memberships: db.memberships.length
        };

        db.leads = db.leads.filter(
          (r) => !(r.org_id === session.org_id && r.data_source === 'csv_import')
        );
        db.customers = db.customers.filter(
          (r) => !(r.org_id === session.org_id && r.data_source === 'csv_import')
        );
        db.memberships = db.memberships.filter(
          (r) => !(r.org_id === session.org_id && r.data_source === 'csv_import')
        );

        const deletedCount =
          beforeCounts.leads -
          db.leads.length +
          (beforeCounts.customers - db.customers.length) +
          (beforeCounts.memberships - db.memberships.length);

        store.persist();
        store.appendAudit({
          org_id: session.org_id,
          actor_email: session.email,
          actor_role: session.role,
          action: 'TENANT_IMPORTED_DATA_PURGED',
          metadata: { deleted_records: deletedCount }
        });

        return sendJson(res, 200, { ok: true, deleted_records: deletedCount });
      }

      return sendJson(res, 404, { ok: false, error: `API route not found: ${method} ${pathname}` });
    } catch (err) {
      // Log without sensitive payload details
      store.appendAudit({
        org_id: 'system',
        actor_email: 'server',
        actor_role: 'system',
        action: 'SERVER_ERROR',
        metadata: { path: pathname, message: String(err?.message || 'Unknown error').slice(0, 120) }
      });
      return sendJson(res, 500, { ok: false, error: 'Internal server error.' });
    }
  };
}
