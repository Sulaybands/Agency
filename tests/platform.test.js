import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createStore } from '../src/store.js';
import { createAppServer } from '../server.js';

async function withTestServer(fn) {
  const tmpFile = path.join(
    os.tmpdir(),
    `aros-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
  const store = createStore(tmpFile);
  const server = createAppServer(store);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function req(urlPath, { method = 'GET', token = '', body = undefined } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  try {
    await fn({ req, store });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

test('1. Authentication & unauthenticated access protection', async () => {
  await withTestServer(async ({ req }) => {
    const unauth = await req('/api/overview');
    assert.equal(unauth.status, 401);

    const badPass = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'ceo@lumina-demo.example', password: 'WrongPassword!' }
    });
    assert.equal(badPass.status, 401);

    const goodLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'ceo@lumina-demo.example', password: 'DemoOwner2026!' }
    });
    assert.equal(goodLogin.status, 200);
    assert.ok(goodLogin.json.token);
    assert.equal(goodLogin.json.user.role, 'owner');
  });
});

test('2. Strict multi-tenant data isolation between Org A and Org B', async () => {
  await withTestServer(async ({ req }) => {
    const loginA = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const loginB = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@radiance-demo.example', password: 'TenantTwo2026!' }
    });

    const ovA = await req('/api/overview', { token: loginA.json.token });
    const ovB = await req('/api/overview', { token: loginB.json.token });

    assert.equal(ovA.json.locations.length, 8);
    assert.equal(ovB.json.locations.length, 1);
    assert.equal(ovB.json.locations[0].code, 'MIA-BRK');
    assert.ok(
      !ovB.json.leads.some((l) => l.org_id === 'org-lumina-demo'),
      'Tenant B must never see Tenant A leads'
    );

    // Tenant B attempting to approve Tenant A workflow wf-301 must fail 404
    const crossApprove = await req('/api/workflows/wf-301/approve', {
      method: 'POST',
      token: loginB.json.token,
      body: {}
    });
    assert.equal(crossApprove.status, 404);
  });
});

test('3. Server-side RBAC enforcement blocks viewer from mutations, approvals & purges', async () => {
  await withTestServer(async ({ req }) => {
    const viewerLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'viewer' }
    });
    const vToken = viewerLogin.json.token;

    const readRes = await req('/api/overview', { token: vToken });
    assert.equal(readRes.status, 200);

    const approveAttempt = await req('/api/workflows/wf-301/approve', {
      method: 'POST',
      token: vToken,
      body: {}
    });
    assert.equal(approveAttempt.status, 403);

    const importAttempt = await req('/api/imports/preview', {
      method: 'POST',
      token: vToken,
      body: { entity_type: 'leads', csv_text: 'contact_name,location_code\nA,AUS-DOM' }
    });
    assert.equal(importAttempt.status, 403);

    const purgeAttempt = await req('/api/settings/purge-imported', {
      method: 'POST',
      token: vToken
    });
    assert.equal(purgeAttempt.status, 403);
  });
});

test('4. Universal CSV Importer: PHI/clinical column blocker, deduplication, preview, commit & purge', async () => {
  await withTestServer(async ({ req }) => {
    const owner = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const token = owner.json.token;

    // 4a. Block clinical / PHI columns immediately
    const phiRes = await req('/api/imports/preview', {
      method: 'POST',
      token,
      body: {
        entity_type: 'customers',
        csv_text: 'customer_name,location_code,clinical_notes,icd10_diagnosis\nTest,AUS-DOM,Chart,L70'
      }
    });
    assert.equal(phiRes.status, 400);
    assert.equal(phiRes.json.complianceBlocked, true);

    // 4b. Preview valid + duplicate + invalid location rows without mutating DB
    const beforeOv = await req('/api/overview', { token });
    const initialLeadCount = beforeOv.json.leads.length;

    const mixedCsv = [
      'external_id,contact_name,email,location_code,stage,estimated_value,marketing_consent,opted_out',
      'NEW-1,Alice Valid,alice@valid.example,HOU-RIV,new,900,true,false',
      'NEW-2,Bob Valid,bob@valid.example,BLD-PRL,new,1100,true,false',
      'SYN-LD-101,Dup Existing,jordan.avery@synthetic.example,HOU-RIV,new,850,true,false',
      'BAD-1,Unknown Loc,bad@loc.example,NO-SUCH-STUDIO,new,500,true,false'
    ].join('\n');

    const prevRes = await req('/api/imports/preview', {
      method: 'POST',
      token,
      body: { entity_type: 'leads', csv_text: mixedCsv }
    });
    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.json.summary.validCount, 2);
    assert.equal(prevRes.json.summary.duplicateCount, 1);
    assert.equal(prevRes.json.summary.invalidCount, 1);

    // Verify preview did not mutate DB
    const midOv = await req('/api/overview', { token });
    assert.equal(midOv.json.leads.length, initialLeadCount);

    // 4c. Commit inserts exactly 2 valid rows
    const commitRes = await req('/api/imports/commit', {
      method: 'POST',
      token,
      body: { entity_type: 'leads', filename: 'test_batch.csv', csv_text: mixedCsv }
    });
    assert.equal(commitRes.status, 201);
    assert.equal(commitRes.json.committed_count, 2);

    const afterOv = await req('/api/overview', { token });
    assert.equal(afterOv.json.leads.length, initialLeadCount + 2);

    // 4d. Owner data deletion procedure purges imported CSV rows cleanly
    const purgeRes = await req('/api/settings/purge-imported', {
      method: 'POST',
      token
    });
    assert.equal(purgeRes.status, 200);
    assert.equal(purgeRes.json.deleted_records, 2);

    const postPurgeOv = await req('/api/overview', { token });
    assert.equal(postPurgeOv.json.leads.length, initialLeadCount);
  });
});

test('5. Human Approval Gate, Opt-Out Protection & Provable ROI Receipt Rule', async () => {
  await withTestServer(async ({ req }) => {
    const owner = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const token = owner.json.token;

    const initialOv = await req('/api/overview', { token });
    const initialCollected = initialOv.json.roi.stages.revenue_collected_verified_usd;
    const initialIdentified = initialOv.json.roi.stages.identified_opportunity_usd;
    assert.ok(
      initialIdentified > initialCollected,
      'Identified opportunities must never be conflated with collected revenue'
    );

    // Opted-out workflow task must be blocked from approval
    const firstOppId = initialOv.json.opportunities[0].id;
    const optedOutQueue = await req('/api/opportunities/queue-workflow', {
      method: 'POST',
      token,
      body: { opportunity_id: firstOppId, recipient_name: 'Opted Out Guest', opted_out: true }
    });
    assert.equal(optedOutQueue.status, 201);

    const blockedApprove = await req(
      `/api/workflows/${optedOutQueue.json.task.id}/approve`,
      { method: 'POST', token, body: {} }
    );
    assert.equal(blockedApprove.status, 400);

    // Approve valid pending workflow wf-301
    const approveWf = await req('/api/workflows/wf-301/approve', {
      method: 'POST',
      token,
      body: {}
    });
    assert.equal(approveWf.status, 200);
    assert.equal(approveWf.json.task.lifecycle_stage, 'action_initiated');

    // Attempting to mark revenue_collected WITHOUT a POS receipt_reference must fail 400
    const noReceipt = await req('/api/workflows/wf-301/stage', {
      method: 'POST',
      token,
      body: { lifecycle_stage: 'revenue_collected', collected_revenue: 925 }
    });
    assert.equal(noReceipt.status, 400);

    // Supplying verifiable POS receipt_reference succeeds and increments verified ROI
    const withReceipt = await req('/api/workflows/wf-301/stage', {
      method: 'POST',
      token,
      body: {
        lifecycle_stage: 'revenue_collected',
        collected_revenue: 925,
        receipt_reference: 'POS-RCPT-TEST-5510'
      }
    });
    assert.equal(withReceipt.status, 200);

    const finalOv = await req('/api/overview', { token });
    assert.equal(
      finalOv.json.roi.stages.revenue_collected_verified_usd,
      initialCollected + 925
    );
  });
});

test('6. Tenant-isolated Executive Report, Retention/Membership Intelligence & Coordinator Funnel', async () => {
  await withTestServer(async ({ req }) => {
    const loginB = await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@radiance-demo.example', password: 'TenantTwo2026!' }
    });
    const ovB = await req('/api/overview', { token: loginB.json.token });
    assert.equal(ovB.status, 200);

    // Tenant B executive report must NEVER leak Tenant A studio names
    const reportJson = JSON.stringify(ovB.json.executive_report);
    assert.ok(!reportJson.includes('Houston River Oaks'), 'Executive report leaked Tenant A studio');
    assert.ok(!reportJson.includes('Nashville Gulch'), 'Executive report leaked Tenant A studio');
    assert.ok(reportJson.includes('Miami Brickell Flagship'));

    // Tenant A includes location funnel, team performance, retention & membership intelligence
    const loginA = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const ovA = await req('/api/overview', { token: loginA.json.token });
    assert.equal(ovA.json.funnel.by_location.length, 8);
    assert.ok(ovA.json.funnel.team_performance.length >= 4);
    assert.ok(ovA.json.retention_intelligence.total_customers_tracked > 0);
    assert.ok(ovA.json.membership_intelligence.total_mrr_usd > 0);
  });
});

test('7. Configurable Baseline & Attribution Window Enforcement', async () => {
  await withTestServer(async ({ req, store }) => {
    const owner = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const token = owner.json.token;

    const patchRes = await req('/api/settings', {
      method: 'PATCH',
      token,
      body: {
        attribution_window_days: 14,
        baseline_period_label: 'Custom Pilot Baseline',
        baseline_inquiry_to_consult_pct: 25
      }
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.json.settings.attribution_window_days, 14);
    assert.equal(patchRes.json.baseline_period_label, 'Custom Pilot Baseline');

    // Inject an out-of-window settled task (60 days after initiation vs 14d window) and verify exclusion
    const db = store.load();
    db.workflow_tasks.push({
      id: 'wf-stale-window-test',
      org_id: 'org-lumina-demo',
      location_id: 'loc-hou',
      category: 'lead_recovery',
      title: 'Out of window test',
      target_record_id: 'ld-101',
      recipient_name: 'Test',
      marketing_consent: true,
      opted_out: false,
      owner_name: 'Ops',
      approval_status: 'approved',
      action_initiated_at: '2026-08-01T10:00:00Z',
      updated_at: '2026-10-15T10:00:00Z',
      lifecycle_stage: 'revenue_collected',
      estimated_value: 5000,
      collected_revenue: 5000,
      receipt_reference: 'POS-STALE-999',
      draft_message: 'Test',
      is_synthetic: true
    });
    store.persist();

    const ov = await req('/api/overview', { token });
    assert.ok(
      !ov.json.roi.verified_ledger.some((r) => r.receipt_reference === 'POS-STALE-999'),
      'Out-of-window receipt must be excluded from verified ROI'
    );
    assert.ok(
      ov.json.roi.data_warnings.some((w) => w.includes('outside the 14-day attribution window'))
    );
  });
});

test('8. Modular Integration Adapter Readiness & Honest Credential Reporting', async () => {
  await withTestServer(async ({ req }) => {
    const owner = await req('/api/auth/login', {
      method: 'POST',
      body: { demo_persona: 'owner' }
    });
    const token = owner.json.token;

    const csvCheck = await req('/api/integrations/universal_csv/check', { token });
    assert.equal(csvCheck.status, 200);
    assert.equal(csvCheck.json.connection_state, 'ready_live');

    const blvdCheck = await req('/api/integrations/boulevard/check', { token });
    assert.equal(blvdCheck.status, 200);
    assert.equal(blvdCheck.json.connection_state, 'missing_credentials');
    assert.ok(blvdCheck.json.missing_env_vars.includes('BOULEVARD_API_KEY'));
  });
});

