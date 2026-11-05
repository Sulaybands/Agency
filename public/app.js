const state = {
  token: localStorage.getItem('aros_token') || '',
  overview: null,
  prospects: [],
  auditLogs: [],
  activeView: 'exec',
  oppFilter: 'ALL',
  lastCsvPreviewOk: false
};

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtUsd(n) {
  return '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({ ok: false, error: 'Non-JSON response' }));
  return { status: res.status, data };
}

async function loginWithPersona(persona) {
  const { data } = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { demo_persona: persona }
  });
  if (data.ok && data.token) {
    state.token = data.token;
    localStorage.setItem('aros_token', data.token);
    await loadAllPlatformData();
    toast(`Signed in as ${data.user.name} [${data.user.role.toUpperCase()}]`);
  } else {
    toast(data.error || 'Login failed');
  }
}

async function loadAllPlatformData() {
  const { status, data } = await apiFetch('/api/overview');
  if (status === 401) {
    await loginWithPersona('owner');
    return;
  }
  if (!data.ok) {
    toast(data.error || 'Failed to load overview');
    return;
  }

  state.overview = data;

  const prRes = await apiFetch('/api/prospects');
  if (prRes.data.ok) state.prospects = prRes.data.prospects;

  const audRes = await apiFetch('/api/audit-logs');
  state.auditLogs = audRes.data.ok ? audRes.data.audit_logs : [];

  renderAll();
}

function renderAll() {
  const ov = state.overview;
  if (!ov) return;

  document.getElementById('sidebarOrgName').textContent = ov.organization.name;
  document.getElementById('sidebarUserRole').textContent = ov.current_user.role.toUpperCase();
  document.getElementById('sidebarUserName').textContent = ov.current_user.name;

  document.getElementById('navLocCount').textContent = String(ov.locations.length);
  document.getElementById('navOppCount').textContent = String(ov.opportunities.length);
  const pendingWf = ov.workflow_tasks.filter((w) => w.approval_status === 'pending_approval').length;
  document.getElementById('navWfCount').textContent = String(pendingWf);

  const synBanner = document.getElementById('syntheticNoticeBanner');
  synBanner.classList.toggle('hidden', !ov.organization.is_synthetic);

  renderExecutiveCenter(ov);
  renderLocations(ov);
  renderOpportunities(ov);
  renderFunnelAndLeads(ov);
  renderRetentionAndMemberships(ov);
  renderWorkflows(ov);
  renderIntegrationsAndCsv(ov);
  renderProspects();
  renderSettingsAndAudit(ov);
}

function renderExecutiveCenter(ov) {
  const totalMrr = ov.memberships.reduce((s, m) => s + m.active_members * m.monthly_price, 0);
  const convStage = ov.funnel.stages[4]?.pct_of_total ?? 0;
  const bookStage = ov.funnel.stages[2]?.pct_of_total ?? 0;

  document.getElementById('execKpiGrid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Active Locations &amp; Inquiries</div>
      <div class="kpi-val">${ov.locations.length} Studios · ${ov.leads.length} Leads</div>
      <div class="kpi-note">Avg Response: ${ov.roi.baseline_comparison.current_avg_response_min ?? 'N/A'}m (Baseline: ${ov.roi.baseline_comparison.baseline_avg_response_min}m)</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Inquiry → Consultation Booked</div>
      <div class="kpi-val">${bookStage}%</div>
      <div class="kpi-note">End-to-End Inquiry → Sale: ${convStage}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Recurring Membership MRR</div>
      <div class="kpi-val">${fmtUsd(totalMrr)}/mo</div>
      <div class="kpi-note">${ov.memberships.reduce((s, m) => s + m.active_members, 0).toLocaleString()} active members across group</div>
    </div>
    <div class="kpi-card" style="border-color:rgba(15,89,68,0.4); background:var(--accent-soft);">
      <div class="kpi-label" style="color:var(--accent); font-weight:700;">POS-Verified Revenue Collected</div>
      <div class="kpi-val" style="color:var(--accent);">${fmtUsd(ov.roi.stages.revenue_collected_verified_usd)}</div>
      <div class="kpi-note" style="color:var(--accent);">${ov.roi.verified_ledger.length} receipt-verified conversion(s)</div>
    </div>
  `;

  document.getElementById('roiBaselineLabel').textContent = ov.roi.baseline_label;
  const st = ov.roi.stages;
  document.getElementById('roiWaterfallStrip').innerHTML = `
    <div class="roi-stage">
      <div class="kpi-label">1. Identified Leak</div>
      <div class="roi-stage-num">${fmtUsd(st.identified_opportunity_usd)}</div>
      <div class="kpi-note">Raw detected volume</div>
    </div>
    <div class="roi-stage">
      <div class="kpi-label">2. Est. Recoverable</div>
      <div class="roi-stage-num">${fmtUsd(st.estimated_opportunity_usd)}</div>
      <div class="kpi-note">Conversion-adjusted</div>
    </div>
    <div class="roi-stage">
      <div class="kpi-label">3. Action Initiated</div>
      <div class="roi-stage-num">${st.actions_initiated_count} Tasks</div>
      <div class="kpi-note">${fmtUsd(st.actions_initiated_est_usd)} pipeline</div>
    </div>
    <div class="roi-stage">
      <div class="kpi-label">4. Consult Booked</div>
      <div class="roi-stage-num">${st.appointments_booked_count} Booked</div>
      <div class="kpi-note">${fmtUsd(st.appointments_booked_est_usd)} est.</div>
    </div>
    <div class="roi-stage">
      <div class="kpi-label">5. Sale Completed</div>
      <div class="roi-stage-num">${st.sales_completed_count} Closed</div>
      <div class="kpi-note">Awaiting/settled POS</div>
    </div>
    <div class="roi-stage verified">
      <div class="kpi-label" style="color:var(--accent); font-weight:700;">6. Revenue Collected</div>
      <div class="roi-stage-num" style="color:var(--accent);">${fmtUsd(st.revenue_collected_verified_usd)}</div>
      <div class="kpi-note" style="color:var(--accent);">Receipt-verified only</div>
    </div>
  `;

  const ledgerRows = ov.roi.verified_ledger
    .map(
      (r) => `
      <tr>
        <td><strong>${esc(r.title)}</strong></td>
        <td class="mono">${esc(r.action_initiated_at?.slice(0, 10))}</td>
        <td class="mono">${esc(r.receipt_reference)}</td>
        <td class="mono" style="font-weight:700; color:var(--accent);">${fmtUsd(r.collected_revenue)}</td>
      </tr>`
    )
    .join('');

  const bc = ov.roi.baseline_comparison || {};
  const formulas = ov.roi.calculation_formulas || {};
  document.getElementById('roiLedgerDetails').innerHTML = `
    <div class="grid-3" style="margin-bottom:10px;">
      <div style="padding:8px 10px; background:var(--surface-subtle); border:1px solid var(--border); border-radius:6px; font-size:12px;">
        <strong>Inquiry→Consult vs. Baseline:</strong>
        <span class="mono">${bc.current_inquiry_to_consult_pct ?? 'N/A'}%</span> vs. <span class="mono">${bc.baseline_inquiry_to_consult_pct ?? 'Missing'}%</span>
        (${bc.inquiry_to_consult_lift_pts !== null && bc.inquiry_to_consult_lift_pts !== undefined ? `${bc.inquiry_to_consult_lift_pts >= 0 ? '+' : ''}${bc.inquiry_to_consult_lift_pts} pts` : 'Configure baseline'})
      </div>
      <div style="padding:8px 10px; background:var(--surface-subtle); border:1px solid var(--border); border-radius:6px; font-size:12px;">
        <strong>Membership Pen. vs. Baseline:</strong>
        <span class="mono">${bc.current_membership_penetration_pct ?? 0}%</span> vs. <span class="mono">${bc.baseline_membership_penetration_pct ?? 'Missing'}%</span>
      </div>
      <div style="padding:8px 10px; background:var(--surface-subtle); border:1px solid var(--border); border-radius:6px; font-size:12px;">
        <strong>Manual Ops Time Reduced:</strong>
        <span class="mono">~${bc.estimated_weekly_admin_hours_saved ?? 0} hrs/wk</span> (${ov.roi.attribution_window_days || 30}d attribution window)
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Verified Workflow Action</th><th>Action Initiated</th><th>POS Receipt Attribution</th><th>Settled Collected</th></tr>
        </thead>
        <tbody>${ledgerRows || '<tr><td colspan="4">No receipt-verified settlements recorded yet.</td></tr>'}</tbody>
      </table>
    </div>
    <div style="margin-top:10px; font-size:11px; color:var(--ink-secondary); background:var(--surface-subtle); padding:8px 10px; border-radius:6px; border:1px solid var(--border);">
      <strong>Calculation Methodology:</strong>
      ${Object.entries(formulas)
        .map(([k, v]) => `<div><span class="mono">${esc(k)}:</span> ${esc(v)}</div>`)
        .join('')}
    </div>
    <div style="margin-top:8px; font-size:11.5px; color:var(--ink-muted);">
      ${ov.roi.data_warnings.map((w) => `• ${esc(w)}`).join('<br/>')}
    </div>
  `;

  const rep = ov.executive_report.sections;
  document.getElementById('execWeeklySummary').innerHTML = `
    <div><strong>1. What Improved:</strong> ${esc(rep.improved)}</div>
    <div><strong>2. What Declined:</strong> ${esc(rep.declined)}</div>
    <div><strong>3. Where Revenue Is Lost:</strong> ${esc(rep.where_revenue_lost)}</div>
    <div><strong>4. Locations Needing Attention:</strong><ul style="padding-left:18px; margin-top:3px;">${rep.locations_needing_attention.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div><strong>5. Priority Actions This Week:</strong><ul style="padding-left:18px; margin-top:3px;">${rep.next_management_actions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div><strong>6. Verified Results Achieved:</strong> ${esc(rep.verified_measurable_results)}</div>
  `;

  document.getElementById('weeklyTrendTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Week</th><th>Leads</th><th>&le;15m SLA</th><th>Booked %</th><th>New Members</th><th>Verified Collected</th></tr>
      </thead>
      <tbody>
        ${ov.weekly_trends
          .map(
            (w) => `
          <tr>
            <td class="mono">${esc(w.week)}</td>
            <td class="mono">${w.leads}</td>
            <td class="mono">${w.pct_under_15m}%</td>
            <td class="mono">${w.consult_booked_pct}%</td>
            <td class="mono">${w.membership_enrollments}</td>
            <td class="mono" style="color:var(--accent); font-weight:600;">${fmtUsd(w.verified_recovered_usd)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderLocations(ov) {
  document.getElementById('locationsTableWrap').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Studio</th>
          <th>Source</th>
          <th>Leads</th>
          <th>Uncontacted</th>
          <th>Avg Resp</th>
          <th>&le;15m %</th>
          <th>Consult %</th>
          <th>Sale %</th>
          <th>110d+ Inactive</th>
          <th>Members (MRR)</th>
          <th>Penetration</th>
        </tr>
      </thead>
      <tbody>
        ${ov.location_metrics
          .map((m) => {
            const respBadge =
              m.avg_response_minutes !== null && m.avg_response_minutes <= 25
                ? 'badge-green'
                : 'badge-red';
            return `
            <tr>
              <td><strong>${esc(m.name)}</strong><br/><span class="mono" style="font-size:11px; color:var(--ink-muted);">${esc(m.code)} · ${esc(m.state)}</span></td>
              <td style="font-size:11.5px;">${esc(m.pos_system)}</td>
              <td class="mono">${m.leads_total}</td>
              <td>${m.uncontacted_leads > 0 ? `<span class="badge badge-red">${m.uncontacted_leads} OPEN</span>` : '<span class="badge badge-green">0</span>'}</td>
              <td><span class="badge ${respBadge}">${m.avg_response_minutes !== null ? `${m.avg_response_minutes}m` : 'Unanswered'}</span></td>
              <td class="mono">${m.under_15m_pct}%</td>
              <td class="mono">${m.consult_booking_pct}%</td>
              <td class="mono"><strong>${m.lead_to_sale_pct}%</strong></td>
              <td class="mono">${m.inactive_eligible_customers}</td>
              <td class="mono">${m.active_members} (${fmtUsd(m.membership_mrr)})</td>
              <td class="mono">${m.membership_penetration_pct}%</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function renderOpportunities(ov) {
  const filtered =
    state.oppFilter === 'ALL'
      ? ov.opportunities
      : ov.opportunities.filter((o) => o.module === state.oppFilter);

  const container = document.getElementById('opportunityListContainer');
  if (!filtered.length) {
    container.innerHTML = `<div class="card">No active opportunities in this filter.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map(
      (o) => `
      <div class="opp-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:6px;">
          <div>
            <span class="badge ${o.priority === 'HIGH' ? 'badge-red' : 'badge-amber'}">${esc(o.priority)}</span>
            <span class="badge badge-blue">${esc(o.module)}</span>
            <span class="badge badge-green">Confidence: ${esc(o.confidence)} · ${esc(o.data_quality)}</span>
            ${o.is_synthetic ? '<span class="badge badge-amber">SYNTHETIC</span>' : ''}
            <h3 style="margin-top:6px; font-size:15px;">${esc(o.location_name)} — ${esc(o.what_happened)}</h3>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:var(--ink-muted);">Est. Recoverable (Not Collected)</div>
            <div class="mono" style="font-size:18px; font-weight:700; color:var(--accent);">${fmtUsd(o.estimated_recoverable)}</div>
            <button class="btn btn-primary btn-sm queue-opp-btn" data-opp-id="${esc(o.id)}" style="margin-top:6px;">
              Queue Draft for Human Approval →
            </button>
          </div>
        </div>
        <div style="font-size:12.5px; color:var(--ink-secondary); margin-bottom:6px;">
          <strong>Why Identified:</strong> ${esc(o.why_identified)}<br/>
          <strong>Recommended Action:</strong> ${esc(o.recommended_action)}
        </div>
        <div class="mono" style="font-size:11px; color:var(--ink-muted); background:var(--surface-subtle); padding:8px; border-radius:4px;">
          Formula: ${esc(o.calculation_note)} | Supporting Evidence: ${esc(JSON.stringify(o.supporting_evidence))}
        </div>
      </div>`
    )
    .join('');

  container.querySelectorAll('.queue-opp-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { status, data } = await apiFetch('/api/opportunities/queue-workflow', {
        method: 'POST',
        body: { opportunity_id: btn.dataset.oppId }
      });
      if (status === 403) {
        toast(data.error);
        return;
      }
      if (data.ok) {
        await loadAllPlatformData();
        switchView('workflows');
        toast('Queued human-reviewable workflow draft');
      } else {
        toast(data.error || 'Could not queue workflow');
      }
    });
  });
}

function renderFunnelAndLeads(ov) {
  document.getElementById('funnelStagesContainer').innerHTML = ov.funnel.stages
    .map(
      (s) => `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:12.5px;">
          <strong>${esc(s.stage)}</strong>
          <span class="mono">${s.count} (${s.pct_of_total}% total · ${s.step_conversion_pct}% step${s.dropoff_count ? ` · -${s.dropoff_count} drop-off` : ''})</span>
        </div>
        <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width:${s.pct_of_total}%;"></div></div>
      </div>`
    )
    .join('');

  const fast = ov.funnel.speed_cohorts.under_15_min;
  const slow = ov.funnel.speed_cohorts.over_60_min_or_unanswered;
  document.getElementById('speedCohortContainer').innerHTML = `
    <div class="grid-2" style="margin-bottom:8px;">
      <div class="kpi-card" style="background:var(--accent-soft);">
        <div class="kpi-label">Answered &le; 15 Minutes</div>
        <div class="kpi-val" style="color:var(--accent);">${fast.conversion_pct}% Sale Rate</div>
        <div class="kpi-note">${fast.converted} converted / ${fast.leads} inquiries</div>
      </div>
      <div class="kpi-card" style="background:var(--danger-soft);">
        <div class="kpi-label">&gt; 60 Min or Unanswered</div>
        <div class="kpi-val" style="color:var(--danger);">${slow.conversion_pct}% Sale Rate</div>
        <div class="kpi-note">${slow.converted} converted / ${slow.leads} inquiries</div>
      </div>
    </div>
    <p style="font-size:12px; color:var(--ink-secondary);">
      Directly reflects actual tenant lead records. Sub-15-minute response consistently drives multi-fold higher consultation attendance and conversion.
    </p>
  `;

  document.getElementById('funnelByLocationWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Studio</th><th>Leads</th><th>Booked</th><th>Attended</th><th>Converted</th><th>Conv %</th><th>Avg Resp</th></tr>
      </thead>
      <tbody>
        ${(ov.funnel.by_location || [])
          .map(
            (r) => `
          <tr>
            <td><strong>${esc(r.name)}</strong></td>
            <td class="mono">${r.leads}</td>
            <td class="mono">${r.booked}</td>
            <td class="mono">${r.attended}</td>
            <td class="mono">${r.converted}</td>
            <td class="mono" style="font-weight:700;">${r.conversion_pct}%</td>
            <td class="mono">${r.avg_response_minutes === null ? 'Unanswered' : `${r.avg_response_minutes}m`}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.getElementById('teamPerfTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Coordinator / Pod</th><th>Assigned</th><th>Avg Resp</th><th>Booked %</th><th>Sale %</th></tr>
      </thead>
      <tbody>
        ${(ov.funnel.team_performance || [])
          .map(
            (t) => `
          <tr>
            <td><strong>${esc(t.coordinator)}</strong></td>
            <td class="mono">${t.leads_assigned}</td>
            <td class="mono">${t.avg_response_minutes === null ? 'Unanswered' : `${t.avg_response_minutes}m`}</td>
            <td class="mono">${t.booked_pct}%</td>
            <td class="mono" style="font-weight:700;">${t.converted_pct}%</td>
          </tr>`
          )
          .join('') || '<tr><td colspan="5">No coordinator assignments in source dataset.</td></tr>'}
      </tbody>
    </table>
    ${
      ov.funnel.missing_coordinator_leads_count > 0
        ? `<div style="font-size:11px; color:var(--ink-muted); margin-top:6px;">Data completeness note: ${ov.funnel.missing_coordinator_leads_count} lead(s) omitted coordinator assignment in source export and are excluded from staff rankings.</div>`
        : ''
    }
  `;

  const locMap = new Map(ov.locations.map((l) => [l.id, l.name]));
  document.getElementById('leadsTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>External ID</th><th>Guest</th><th>Studio</th><th>Channel</th><th>Resp Time</th><th>Stage</th><th>Est. Value</th><th>Consent / Opt-Out</th></tr>
      </thead>
      <tbody>
        ${ov.leads
          .map(
            (l) => `
          <tr>
            <td class="mono">${esc(l.external_id)}</td>
            <td><strong>${esc(l.contact_name)}</strong></td>
            <td>${esc(locMap.get(l.location_id) || l.location_id)}</td>
            <td>${esc(l.channel)}</td>
            <td class="mono">${l.first_response_minutes === null ? '<span class="badge badge-red">UNCONTACTED</span>' : `${l.first_response_minutes}m`}</td>
            <td><span class="badge badge-blue">${esc(l.stage)}</span></td>
            <td class="mono">${fmtUsd(l.estimated_value || l.collected_amount || 0)}</td>
            <td>${l.opted_out ? '<span class="badge badge-red">OPTED OUT · BLOCKED</span>' : l.marketing_consent ? '<span class="badge badge-green">CONSENT VERIFIED</span>' : '<span class="badge badge-amber">NO CONSENT</span>'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderRetentionAndMemberships(ov) {
  const locMap = new Map(ov.locations.map((l) => [l.id, l.name]));
  const ret = ov.retention_intelligence || {};
  const mem = ov.membership_intelligence || {};
  const seg = ret.segments || {};

  document.getElementById('retentionKpiStrip').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">Repeat-Visit Guest Share</div>
      <div class="kpi-val">${ret.repeat_visit_rate_pct ?? 0}%</div>
      <div class="kpi-note">${ret.repeat_visit_count ?? 0} repeat vs. ${ret.single_visit_count ?? 0} single-visit</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Single vs. Repeat Avg Spend</div>
      <div class="kpi-val">${ret.avg_single_visit_spend_usd != null ? fmtUsd(ret.avg_single_visit_spend_usd) : 'N/A'} → ${ret.avg_repeat_customer_spend_usd != null ? fmtUsd(ret.avg_repeat_customer_spend_usd) : 'N/A'}</div>
      <div class="kpi-note">Non-clinical historical spend ledger</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Eligible Inactive (${ret.inactivity_threshold_days || 110}d+)</div>
      <div class="kpi-val">${(seg.eligible_reactivation_threshold_to_179d || 0) + (seg.deep_lapsed_180d_plus || 0)} Guests</div>
      <div class="kpi-note">${seg.excluded_opted_out_or_no_consent || 0} opted-out/no-consent excluded</div>
    </div>
    <div class="kpi-card" style="background:var(--accent-soft);">
      <div class="kpi-label">30d Membership Retention</div>
      <div class="kpi-val" style="color:var(--accent);">${mem.group_monthly_retention_pct ?? 0}%</div>
      <div class="kpi-note">Net 30d growth: ${(mem.net_member_growth_30d || 0) >= 0 ? '+' : ''}${mem.net_member_growth_30d || 0} members (${mem.group_penetration_pct ?? 0}% pen.)</div>
    </div>
  `;

  document.getElementById('membershipTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Studio</th><th>Plan</th><th>Price</th><th>Active Members</th><th>Penetration</th><th>30d Retention</th><th>MRR</th><th>30d New / Cancel</th><th>Eligible Non-Members</th></tr>
      </thead>
      <tbody>
        ${(mem.by_location || ov.memberships)
          .map(
            (m) => `
          <tr>
            <td><strong>${esc(m.location_name || locMap.get(m.location_id) || m.location_id)}</strong></td>
            <td>${esc(m.plan_name)}</td>
            <td class="mono">${fmtUsd(m.monthly_price)}</td>
            <td class="mono">${m.active_members}</td>
            <td class="mono">${m.penetration_pct ?? 0}%</td>
            <td class="mono">${m.monthly_retention_pct ?? 0}%</td>
            <td class="mono" style="font-weight:700;">${fmtUsd(m.mrr_usd ?? m.active_members * m.monthly_price)}</td>
            <td class="mono"><span style="color:var(--accent);">+${m.new_enrollments_30d}</span> / <span style="color:var(--danger);">-${m.cancellations_30d}</span></td>
            <td class="mono">${m.eligible_non_members}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.getElementById('customersTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Customer</th><th>Studio</th><th>Visits</th><th>Last Visit</th><th>Lifetime Spend</th><th>Member?</th><th>Consent</th></tr>
      </thead>
      <tbody>
        ${ov.customers
          .map(
            (c) => `
          <tr>
            <td><strong>${esc(c.customer_name)}</strong></td>
            <td>${esc(locMap.get(c.location_id) || c.location_id)}</td>
            <td class="mono">${c.visit_count}</td>
            <td class="mono">${esc(c.last_visit_date)}</td>
            <td class="mono">${fmtUsd(c.lifetime_spend)}</td>
            <td>${c.is_member ? '<span class="badge badge-green">MEMBER</span>' : '<span class="badge badge-amber">NON-MEMBER</span>'}</td>
            <td>${c.marketing_consent && !c.opted_out ? '<span class="badge badge-green">ELIGIBLE</span>' : '<span class="badge badge-red">DO NOT MESSAGE</span>'}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderWorkflows(ov) {
  const container = document.getElementById('workflowTasksContainer');
  container.innerHTML = ov.workflow_tasks
    .map((w) => {
      const isPending = w.approval_status === 'pending_approval';
      return `
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
            <div>
              <span class="badge ${isPending ? 'badge-amber' : 'badge-green'}">${esc(w.approval_status.toUpperCase())}</span>
              <span class="badge badge-blue">Stage: ${esc(w.lifecycle_stage)}</span>
              ${w.is_synthetic ? '<span class="badge badge-amber">SYNTHETIC</span>' : ''}
              <h3 style="margin-top:6px;">${esc(w.title)}</h3>
              <div style="font-size:12px; color:var(--ink-muted);">Owner: ${esc(w.owner_name)} · Est. Value: ${fmtUsd(w.estimated_value)} ${w.receipt_reference ? `· Verified Receipt: ${esc(w.receipt_reference)} (${fmtUsd(w.collected_revenue)})` : ''}</div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${
                isPending
                  ? `<button class="btn btn-primary btn-sm wf-approve-btn" data-id="${esc(w.id)}">✓ Human Approve &amp; Initiate</button>`
                  : `
                    <button class="btn btn-sm wf-stage-btn" data-id="${esc(w.id)}" data-stage="appointment_booked">Mark Consult Booked</button>
                    <button class="btn btn-sm wf-stage-btn" data-id="${esc(w.id)}" data-stage="sale_completed">Mark Sale Completed</button>
                    <button class="btn btn-dark btn-sm wf-collect-btn" data-id="${esc(w.id)}" data-est="${w.estimated_value}">Verify POS Receipt ($)</button>
                  `
              }
            </div>
          </div>
          <textarea class="mono wf-draft-box" data-id="${esc(w.id)}" rows="2" style="font-size:12px;" ${isPending ? '' : 'readonly'}>${esc(w.draft_message)}</textarea>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('.wf-approve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const box = container.querySelector(`.wf-draft-box[data-id="${id}"]`);
      const { data } = await apiFetch(`/api/workflows/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        body: { edited_message: box?.value }
      });
      if (data.ok) {
        await loadAllPlatformData();
        toast('Communication human-approved & logged to Audit Trail');
      } else {
        toast(data.error || 'Approval rejected');
      }
    });
  });

  container.querySelectorAll('.wf-stage-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data } = await apiFetch(`/api/workflows/${encodeURIComponent(btn.dataset.id)}/stage`, {
        method: 'POST',
        body: { lifecycle_stage: btn.dataset.stage }
      });
      if (data.ok) {
        await loadAllPlatformData();
        toast(`Updated stage to ${btn.dataset.stage}`);
      } else {
        toast(data.error || 'Update failed');
      }
    });
  });

  container.querySelectorAll('.wf-collect-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const receipt = prompt(
        'Enter verifiable POS Receipt ID to record Collected Revenue:',
        `POS-RCPT-${Math.floor(10000 + Math.random() * 89999)}`
      );
      if (!receipt) return;
      const amtStr = prompt('Enter settled dollar amount ($):', btn.dataset.est || '750');
      const amount = Number(amtStr);
      const { data } = await apiFetch(`/api/workflows/${encodeURIComponent(btn.dataset.id)}/stage`, {
        method: 'POST',
        body: {
          lifecycle_stage: 'revenue_collected',
          receipt_reference: receipt,
          collected_revenue: amount
        }
      });
      if (data.ok) {
        await loadAllPlatformData();
        toast(`Verified ${fmtUsd(amount)} added to Provable ROI Ledger`);
      } else {
        toast(data.error || 'Receipt verification failed');
      }
    });
  });
}

function renderIntegrationsAndCsv(ov) {
  document.getElementById('csvHistoryTableWrap').innerHTML = `
    <table>
      <thead>
        <tr><th>Timestamp</th><th>Type</th><th>File</th><th>Committed</th><th>Duplicates</th><th>Invalid</th></tr>
      </thead>
      <tbody>
        ${ov.csv_imports
          .map(
            (i) => `
          <tr>
            <td class="mono">${esc(i.created_at.slice(0, 16).replace('T', ' '))}</td>
            <td><span class="badge badge-blue">${esc(i.entity_type)}</span></td>
            <td>${esc(i.filename)}</td>
            <td class="mono" style="color:var(--accent); font-weight:700;">${i.committed_rows}</td>
            <td class="mono">${i.duplicate_rows}</td>
            <td class="mono">${i.invalid_rows}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.getElementById('integrationsCatalogWrap').innerHTML = ov.integrations
    .map(
      (intg) => `
      <div style="border-bottom:1px solid var(--border); padding:10px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <strong>${esc(intg.name)}</strong>
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="badge ${intg.is_live ? 'badge-green' : 'badge-amber'}">${esc(intg.status)}</span>
            <button class="btn btn-sm intg-check-btn" data-id="${esc(intg.id)}">Check Adapter</button>
          </div>
        </div>
        <div style="font-size:11.5px; color:var(--ink-secondary); margin-top:4px; line-height:1.45;">
          <strong>Auth &amp; Permissions:</strong> ${esc(intg.auth_requirements)} (${esc(intg.required_permissions)})<br/>
          <strong>Available Data:</strong> ${esc(intg.available_data)}<br/>
          <strong>API Cost / Tier:</strong> ${esc(intg.api_costs_and_tier)}<br/>
          <strong>Sync &amp; Failure Handling:</strong> ${esc(intg.sync_method)} · ${esc(intg.failure_handling)}<br/>
          <strong>Limitations:</strong> ${esc(intg.data_limitations)}
        </div>
      </div>`
    )
    .join('');

  document.querySelectorAll('.intg-check-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data } = await apiFetch(`/api/integrations/${encodeURIComponent(btn.dataset.id)}/check`);
      toast(data.message || data.error || 'Checked adapter status');
    });
  });
}

function renderProspects() {
  document.getElementById('prospectsTableWrap').innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Fit</th>
          <th>Group &amp; Footprint</th>
          <th>Locations</th>
          <th>Public Leadership</th>
          <th>Buying Triggers &amp; Verified Sources</th>
          <th>Outreach</th>
        </tr>
      </thead>
      <tbody>
        ${state.prospects
          .map(
            (p) => `
          <tr>
            <td><span class="badge badge-green">${p.fit_score}/100</span><br/><span class="mono" style="font-size:10px; color:var(--ink-muted);">${esc(p.confidence)}</span></td>
            <td>
              <strong><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.company_name)}</a></strong><br/>
              <span style="font-size:11.5px; color:var(--ink-secondary);">${esc(p.footprint)}</span>
            </td>
            <td class="mono"><strong>~${p.approx_locations}</strong></td>
            <td style="font-size:11.5px;">${esc(p.public_leadership)}</td>
            <td style="font-size:11.5px;">
              ${esc(p.buying_triggers)}<br/>
              <span class="mono" style="font-size:10.5px; color:var(--ink-muted);">
                Verified ${esc(p.date_verified)} ·
                ${(p.source_urls || [])
                  .map((u, idx) => `<a href="${esc(u)}" target="_blank" rel="noopener">[Source ${idx + 1}]</a>`)
                  .join(' ')}
              </span>
            </td>
            <td>
              <button class="btn btn-primary btn-sm gen-pr-draft-btn" data-id="${esc(p.id)}">Draft Email</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.querySelectorAll('.gen-pr-draft-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data } = await apiFetch(`/api/prospects/${encodeURIComponent(btn.dataset.id)}/draft`, {
        method: 'POST'
      });
      if (data.ok) {
        const modal = document.getElementById('prospectDraftModal');
        document.getElementById('draftModalTitle').textContent = `Outreach Draft: ${data.prospect.company_name} (Requires Manual Review & Send)`;
        document.getElementById('draftModalContent').textContent = `Subject: ${data.outreach_draft.subject}\n\n${data.outreach_draft.body}`;
        modal.classList.remove('hidden');
        modal.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

function renderSettingsAndAudit(ov) {
  document.getElementById('setSlaMin').value = ov.organization.settings?.sla_target_minutes ?? 15;
  document.getElementById('setInactiveDays').value = ov.organization.settings?.inactivity_threshold_days ?? 110;
  document.getElementById('setAttrDays').value = ov.organization.settings?.attribution_window_days ?? 30;
  document.getElementById('setBaselineLabel').value = ov.organization.baseline_period_label || '';
  document.getElementById('setBaseResp').value = ov.organization.baseline?.avg_response_minutes ?? 214;
  document.getElementById('setBaseConsultPct').value =
    ov.organization.baseline?.inquiry_to_consult_rate != null
      ? Math.round(ov.organization.baseline.inquiry_to_consult_rate * 1000) / 10
      : 31;
  document.getElementById('setBaseMemPct').value =
    ov.organization.baseline?.membership_penetration_rate != null
      ? Math.round(ov.organization.baseline.membership_penetration_rate * 1000) / 10
      : 11.8;
  document.getElementById('setBaseManualHrs').value = ov.organization.baseline?.manual_ops_hours_per_week ?? 38;
  document.getElementById('llmStatusText').textContent = `${ov.llm_status.provider} (${ov.llm_status.model}) — Core KPIs & ROI 100% deterministic`;

  document.getElementById('teamUsersTableWrap').innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>RBAC Role</th></tr></thead>
      <tbody>
        ${ov.team_users
          .map(
            (u) => `
          <tr>
            <td><strong>${esc(u.name)}</strong></td>
            <td class="mono">${esc(u.email)}</td>
            <td><span class="badge badge-blue">${esc(u.role.toUpperCase())}</span></td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  document.getElementById('auditLogTableWrap').innerHTML = `
    <table>
      <thead><tr><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Sanitized Metadata</th></tr></thead>
      <tbody>
        ${state.auditLogs
          .slice(0, 35)
          .map(
            (a) => `
          <tr>
            <td class="mono">${esc(a.created_at.slice(0, 19).replace('T', ' '))}</td>
            <td class="mono">${esc(a.actor_email)}</td>
            <td><span class="badge badge-blue">${esc(a.actor_role)}</span></td>
            <td><strong>${esc(a.action)}</strong></td>
            <td class="mono" style="font-size:11px;">${esc(JSON.stringify(a.metadata))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function switchView(viewId) {
  state.activeView = viewId;
  document.querySelectorAll('.side-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === viewId);
  });
  document.querySelectorAll('.app-view').forEach((sec) => {
    sec.classList.toggle('hidden', sec.id !== `view-${viewId}`);
  });
}

function showSurface(surface) {
  const isMkt = surface === 'marketing';
  document.getElementById('marketingSurface').classList.toggle('hidden', !isMkt);
  document.getElementById('platformSurface').classList.toggle('hidden', isMkt);
}

function updateCommercialRoiCalculator() {
  const locs = Number(document.getElementById('mLocInput').value);
  const leadsPerLoc = Number(document.getElementById('mLeadsInput').value);
  const slowPct = Number(document.getElementById('mSlowInput').value) / 100;
  const inactivePerLoc = Number(document.getElementById('mInactiveInput').value);

  document.getElementById('mLocVal').textContent = String(locs);
  document.getElementById('mLeadsVal').textContent = String(leadsPerLoc);
  document.getElementById('mSlowVal').textContent = `${Math.round(slowPct * 100)}%`;
  document.getElementById('mInactiveVal').textContent = String(inactivePerLoc);

  // Grounded in AmSpa $527 avg ticket; conservative 10%–18% incremental conversion on slow leads + 8%–14% annual reactivation on inactive guests
  const annualSlowLeads = locs * leadsPerLoc * 12 * slowPct;
  const lowLeadRecovery = annualSlowLeads * 0.10 * 527;
  const highLeadRecovery = annualSlowLeads * 0.18 * 527;

  const totalInactive = locs * inactivePerLoc;
  const lowRetention = totalInactive * 0.08 * 527;
  const highRetention = totalInactive * 0.14 * 527;

  const lowTotal = Math.round((lowLeadRecovery + lowRetention) / 1000) * 1000;
  const highTotal = Math.round((highLeadRecovery + highRetention) / 1000) * 1000;

  document.getElementById('mEstRange').textContent = `${fmtUsd(lowTotal)} – ${fmtUsd(highTotal)} / yr`;
  document.getElementById('mFormulaExplain').textContent = `Formula: (${Math.round(annualSlowLeads).toLocaleString()} slow/unanswered annual inquiries × 10–18% recovery + ${totalInactive.toLocaleString()} inactive guests × 8–14% re-engagement) × $527 AmSpa benchmark visit value. Strictly an initial sizing model—actual pilot only counts POS-settled receipts.`;

  let tier = 'Paid Proof-of-Value Pilot: $6,500 Setup + $2,000/mo (3–5 Studios)';
  let note = 'Recommended 30–45 day baseline & CSV export validation before full group rollout.';
  if (locs >= 8 && locs <= 20) {
    tier = `Pilot ($7,500) → Multi-Location Group Deployment: $18,000–$28,000 Setup + $3,500/mo (${locs} Studios)`;
    note = 'Start with 3–4 studios for 30 days; expand across all studios upon verified POS payback.';
  } else if (locs > 20) {
    tier = `Enterprise / PE Platform Rollout: $40,000–$75,000 Setup + $6,500–$9,500/mo (${locs} Studios)`;
    note = 'Begin with a $9,500 5-clinic regional benchmark sprint to prove unit-level lift.';
  }
  document.getElementById('mRecommendedTier').textContent = tier;
  document.getElementById('mTierNote').textContent = note;
}

async function init() {
  updateCommercialRoiCalculator();

  // Wire navigation & surface toggles
  document.getElementById('toggleMarketingBtn').addEventListener('click', () => showSurface('marketing'));
  document.getElementById('enterPlatformBtn').addEventListener('click', () => showSurface('platform'));
  document.getElementById('heroLaunchDemoBtn').addEventListener('click', () => showSurface('platform'));

  document.querySelectorAll('.side-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('personaSwitcher').addEventListener('change', (e) => {
    showSurface('platform');
    loginWithPersona(e.target.value);
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
      }
    });
    if (data.ok) {
      state.token = data.token;
      localStorage.setItem('aros_token', data.token);
      showSurface('platform');
      await loadAllPlatformData();
      toast(`Authenticated as ${data.user.email}`);
    } else {
      toast(data.error || 'Invalid credentials');
    }
  });

  ['mLocInput', 'mLeadsInput', 'mSlowInput', 'mInactiveInput'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCommercialRoiCalculator);
  });

  document.getElementById('oppModuleFilter').addEventListener('change', (e) => {
    state.oppFilter = e.target.value;
    if (state.overview) renderOpportunities(state.overview);
  });

  // Add Location
  document.getElementById('addLocationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data } = await apiFetch('/api/locations', {
      method: 'POST',
      body: {
        code: document.getElementById('locCode').value,
        name: document.getElementById('locName').value,
        state: document.getElementById('locState').value
      }
    });
    if (data.ok) {
      e.target.reset();
      await loadAllPlatformData();
      toast(`Added studio ${data.location.name}`);
    } else {
      toast(data.error || 'Could not add location');
    }
  });

  // CSV Sample Loaders, Upload, Preview & Commit
  document.getElementById('loadSampleLeadsCsvBtn').addEventListener('click', () => {
    document.getElementById('csvEntityType').value = 'leads';
    document.getElementById('csvFilenameInput').value = 'november_boulevard_inquiries.csv';
    document.getElementById('csvTextarea').value = [
      'external_id,contact_name,email,phone,location_code,channel,first_response_minutes,stage,estimated_value,marketing_consent,opted_out',
      'CSV-901,brooke.anderson,brooke.a@example.org,555-0901,HOU-RIV,Meta Lead Form,,new,950,true,false',
      'CSV-902,Sloane Mercer,sloane.m@example.org,555-0902,BLD-PRL,Web Consultation,,new,1200,true,false',
      'SYN-LD-101,Duplicate Existing Row,jordan.avery@synthetic.example,555-0101,HOU-RIV,Meta,,new,850,true,false',
      'CSV-BAD-LOC,Missing Studio Row,bad@example.org,555-0999,UNKNOWN-LOC,Web,10,new,500,true,false'
    ].join('\n');
    document.getElementById('commitCsvBtn').classList.add('hidden');
    toast('Loaded sample CSV (2 valid new leads, 1 duplicate, 1 invalid studio)');
  });

  document.getElementById('loadPhiBlockedCsvBtn').addEventListener('click', () => {
    document.getElementById('csvEntityType').value = 'customers';
    document.getElementById('csvTextarea').value = [
      'customer_name,email,location_code,visit_count,clinical_notes,icd10_diagnosis',
      'Jane Sample,jane@example.org,AUS-DOM,2,Patient chart note,L70.0'
    ].join('\n');
    document.getElementById('commitCsvBtn').classList.add('hidden');
    toast('Loaded sample clinical/PHI CSV — click Validate to test compliance block');
  });

  document.getElementById('csvFileInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    document.getElementById('csvFilenameInput').value = file.name;
    document.getElementById('csvTextarea').value = await file.text();
  });

  document.getElementById('previewCsvBtn').addEventListener('click', async () => {
    const entityType = document.getElementById('csvEntityType').value;
    const csvText = document.getElementById('csvTextarea').value;
    const { data } = await apiFetch('/api/imports/preview', {
      method: 'POST',
      body: { entity_type: entityType, csv_text: csvText }
    });
    const out = document.getElementById('csvPreviewResult');
    if (!data.ok) {
      document.getElementById('commitCsvBtn').classList.add('hidden');
      out.innerHTML = `<div class="notice-banner" style="background:var(--danger-soft); border-color:#f2b8b5; color:var(--danger);"><strong>Import Blocked:</strong> ${esc(data.error)}</div>`;
      return;
    }

    document.getElementById('commitCsvBtn').classList.toggle('hidden', data.summary.validCount === 0);
    out.innerHTML = `
      <div style="background:var(--surface-subtle); border:1px solid var(--border); padding:12px; border-radius:6px;">
        <strong>Validation Summary:</strong>
        <span class="badge badge-green">${data.summary.validCount} Valid Ready</span>
        <span class="badge badge-amber">${data.summary.duplicateCount} Duplicates Skipped</span>
        <span class="badge badge-red">${data.summary.invalidCount} Invalid Rows Rejected</span>
        <div class="mono" style="font-size:11px; margin-top:6px; color:var(--ink-secondary);">
          Auto-Mapped Fields: ${esc(JSON.stringify(data.detectedMapping))}
        </div>
        ${
          data.duplicateRows.length
            ? `<div style="font-size:11.5px; margin-top:6px;"><strong>Duplicates:</strong> ${data.duplicateRows.map((d) => `Line ${d.line} (${esc(d.identifier)}: ${esc(d.reason)})`).join(' · ')}</div>`
            : ''
        }
        ${
          data.invalidRows.length
            ? `<div style="font-size:11.5px; margin-top:4px; color:var(--danger);"><strong>Invalid:</strong> ${data.invalidRows.map((r) => `Line ${r.line}: ${esc(r.reason)}`).join(' · ')}</div>`
            : ''
        }
      </div>
    `;
  });

  document.getElementById('commitCsvBtn').addEventListener('click', async () => {
    const { data } = await apiFetch('/api/imports/commit', {
      method: 'POST',
      body: {
        entity_type: document.getElementById('csvEntityType').value,
        filename: document.getElementById('csvFilenameInput').value,
        csv_text: document.getElementById('csvTextarea').value
      }
    });
    if (data.ok) {
      document.getElementById('commitCsvBtn').classList.add('hidden');
      await loadAllPlatformData();
      toast(`Committed ${data.committed_count} validated record(s) & refreshed opportunities`);
    } else {
      toast(data.error || 'Import commit failed');
    }
  });

  // Prospecting modal & add prospect
  document.getElementById('closeDraftModalBtn').addEventListener('click', () => {
    document.getElementById('prospectDraftModal').classList.add('hidden');
  });

  document.getElementById('copyProspectDraftBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('draftModalContent').textContent);
    toast('Copied draft for manual review');
  });

  document.getElementById('addProspectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data } = await apiFetch('/api/prospects', {
      method: 'POST',
      body: {
        company_name: document.getElementById('prName').value,
        website: document.getElementById('prWeb').value,
        approx_locations: Number(document.getElementById('prLocs').value),
        footprint: document.getElementById('prFootprint').value,
        public_leadership: document.getElementById('prLead').value,
        source_url: document.getElementById('prSource').value,
        buying_triggers: document.getElementById('prTriggers').value
      }
    });
    if (data.ok) {
      e.target.reset();
      await loadAllPlatformData();
      toast(`Added ${data.prospect.company_name} (Fit Score: ${data.prospect.fit_score})`);
    } else {
      toast(data.error || 'Failed to add prospect');
    }
  });

  // Settings, Baseline, Purge & Audit
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { data } = await apiFetch('/api/settings', {
      method: 'PATCH',
      body: {
        sla_target_minutes: Number(document.getElementById('setSlaMin').value),
        inactivity_threshold_days: Number(document.getElementById('setInactiveDays').value),
        attribution_window_days: Number(document.getElementById('setAttrDays').value),
        baseline_period_label: document.getElementById('setBaselineLabel').value,
        baseline_avg_response_min: Number(document.getElementById('setBaseResp').value),
        baseline_inquiry_to_consult_pct: Number(document.getElementById('setBaseConsultPct').value),
        baseline_membership_penetration_pct: Number(document.getElementById('setBaseMemPct').value),
        baseline_manual_ops_hours: Number(document.getElementById('setBaseManualHrs').value)
      }
    });
    if (data.ok) {
      await loadAllPlatformData();
      toast('Saved organization thresholds & baseline comparison');
    } else {
      toast(data.error || 'Permission denied');
    }
  });

  document.querySelectorAll('.demo-step-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.target));
  });

  document.getElementById('downloadRoiCsvBtn').addEventListener('click', () => {
    if (!state.overview) return;
    const roi = state.overview.roi;
    const lines = [
      'stage_or_record,category,action_initiated_at,receipt_reference,amount_usd,notes',
      `STAGE_1_IDENTIFIED_OPPORTUNITY,pipeline,,,${roi.stages.identified_opportunity_usd},"Raw identified leaks (EXCLUDED from collected ROI)"`,
      `STAGE_2_ESTIMATED_RECOVERABLE,pipeline,,,${roi.stages.estimated_opportunity_usd},"Conservative conversion-weighted estimate"`,
      `STAGE_3_ACTIONS_INITIATED,workflow,,,${roi.stages.actions_initiated_est_usd},"${roi.stages.actions_initiated_count} human-approved workflow(s)"`,
      `STAGE_4_APPOINTMENTS_BOOKED,workflow,,,${roi.stages.appointments_booked_est_usd},"${roi.stages.appointments_booked_count} booked consultation(s)"`,
      `STAGE_6_REVENUE_COLLECTED_VERIFIED,settled_pos,,,${roi.stages.revenue_collected_verified_usd},"Verified POS receipts within ${roi.attribution_window_days}d window"`,
      ...roi.verified_ledger.map(
        (r) =>
          `"${String(r.title).replace(/"/g, '""')}",${r.category},${r.action_initiated_at || ''},${r.receipt_reference},${r.collected_revenue},"${r.is_synthetic ? 'SYNTHETIC_DEMO' : 'VERIFIED'}"`
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'provable-roi-attribution-ledger.csv';
    a.click();
    toast('Downloaded Provable ROI Ledger (.csv)');
  });

  document.getElementById('purgeImportedBtn').addEventListener('click', async () => {
    const { data } = await apiFetch('/api/settings/purge-imported', { method: 'POST' });
    if (data.ok) {
      await loadAllPlatformData();
      toast(`Purged ${data.deleted_records} imported record(s) for this tenant`);
    } else {
      toast(data.error || 'Delete denied by RBAC');
    }
  });

  document.getElementById('refreshAuditBtn').addEventListener('click', () => loadAllPlatformData());

  // Download Executive Report (.md)
  document.getElementById('downloadExecReportBtn').addEventListener('click', () => {
    if (!state.overview) return;
    const rep = state.overview.executive_report;
    const s = rep.sections;
    const md = [
      `# Weekly Executive Revenue Operations Report`,
      `**Organization:** ${rep.organization}`,
      `**Generated:** ${rep.generated_at}`,
      rep.is_synthetic_demo ? `> **[SYNTHETIC DEMO DATA]** For demonstration only.` : '',
      `\n## 1. What Improved\n${s.improved}`,
      `\n## 2. What Declined\n${s.declined}`,
      `\n## 3. Where Revenue Is Being Lost\n${s.where_revenue_lost}`,
      `\n## 4. Locations Needing Attention\n${s.locations_needing_attention.map((x) => `- ${x}`).join('\n')}`,
      `\n## 5. Recommended Management Actions\n${s.next_management_actions.map((x) => `- ${x}`).join('\n')}`,
      `\n## 6. Verified Measurable Results\n${s.verified_measurable_results}\n`
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'weekly-executive-revenue-report.md';
    a.click();
    toast('Downloaded Weekly Executive Report (.md)');
  });

  // Boot into authenticated synthetic demo immediately
  await loadAllPlatformData();
}

init();
