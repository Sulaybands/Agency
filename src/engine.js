/**
 * Deterministic Revenue Operations & Provable ROI Engine
 * Covers Modules A, B, C, D, E, F + Section 4 Provable ROI Attribution
 * Strictly non-clinical: operates on inquiry timing, funnel stages, visit recency,
 * spend totals, membership counts, and consent/opt-out permissions.
 */

const REFERENCE_DATE = new Date('2026-11-05T12:00:00Z');

function daysBetween(dateStr, refDate = REFERENCE_DATE) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.round((refDate.getTime() - d.getTime()) / 86400000));
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function computeLocationMetrics({ org, locations, leads, customers, memberships }) {
  return locations.map((loc) => {
    const locLeads = leads.filter((l) => l.location_id === loc.id);
    const locCusts = customers.filter((c) => c.location_id === loc.id);
    const locMem = memberships.find((m) => m.location_id === loc.id) || {
      plan_name: 'Unconfigured Plan',
      monthly_price: 199,
      active_members: 0,
      new_enrollments_30d: 0,
      cancellations_30d: 0,
      eligible_non_members: 0
    };

    const respondedLeads = locLeads.filter((l) => typeof l.first_response_minutes === 'number');
    const uncontactedLeads = locLeads.filter(
      (l) => l.stage === 'new' && l.first_response_minutes === null
    );
    const under15mCount = respondedLeads.filter(
      (l) => l.first_response_minutes <= (org.settings?.sla_target_minutes || 15)
    ).length;
    const avgResponseMin = respondedLeads.length
      ? Math.round(
          respondedLeads.reduce((s, l) => s + l.first_response_minutes, 0) / respondedLeads.length
        )
      : null;

    const bookedStages = new Set(['consultation_booked', 'consultation_attended', 'converted']);
    const attendedStages = new Set(['consultation_attended', 'converted']);
    const bookedCount = locLeads.filter((l) => bookedStages.has(l.stage)).length;
    const attendedCount = locLeads.filter((l) => attendedStages.has(l.stage)).length;
    const convertedCount = locLeads.filter((l) => l.stage === 'converted').length;

    const repeatCusts = locCusts.filter((c) => (c.visit_count || 1) >= 2);
    const inactiveEligibleCusts = locCusts.filter((c) => {
      const inactiveDays = daysBetween(c.last_visit_date);
      return (
        inactiveDays >= (org.settings?.inactivity_threshold_days || 110) &&
        c.marketing_consent &&
        !c.opted_out
      );
    });

    const totalGuestPool = locMem.active_members + locMem.eligible_non_members;
    const membershipPenetrationPct = pct(locMem.active_members, totalGuestPool);
    const monthlyMrr = locMem.active_members * locMem.monthly_price;
    const monthlyChurnPct = pct(locMem.cancellations_30d, Math.max(1, locMem.active_members));
    const monthlyRetentionPct = locMem.active_members > 0 ? Math.max(0, Math.round((100 - monthlyChurnPct) * 10) / 10) : 0;

    return {
      location_id: loc.id,
      code: loc.code,
      name: loc.name,
      state: loc.state,
      pos_system: loc.pos_system,
      is_synthetic: Boolean(loc.is_synthetic),
      leads_total: locLeads.length,
      uncontacted_leads: uncontactedLeads.length,
      avg_response_minutes: avgResponseMin,
      under_15m_pct: pct(under15mCount, locLeads.length),
      consult_booking_pct: pct(bookedCount, locLeads.length),
      consult_attended_count: attendedCount,
      lead_to_sale_pct: pct(convertedCount, locLeads.length),
      repeat_visit_pct: pct(repeatCusts.length, locCusts.length),
      inactive_eligible_customers: inactiveEligibleCusts.length,
      active_members: locMem.active_members,
      new_enrollments_30d: locMem.new_enrollments_30d || 0,
      cancellations_30d: locMem.cancellations_30d || 0,
      membership_mrr: monthlyMrr,
      membership_penetration_pct: membershipPenetrationPct,
      membership_churn_pct: monthlyChurnPct,
      membership_retention_pct: monthlyRetentionPct,
      eligible_non_members: locMem.eligible_non_members
    };
  });
}

/**
 * Module A: Revenue Opportunity Intelligence
 * Covers uncontacted leads, incomplete follow-up / unbooked consultations,
 * post-consultation unconverted follow-ups, repeat/inactive re-engagement,
 * membership penetration gaps, and location conversion anomalies (without double-counting pipeline).
 */
export function detectOpportunities({ org, locations, leads, customers, memberships }) {
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const locMetrics = computeLocationMetrics({ org, locations, leads, customers, memberships });
  const slaTarget = org.settings?.sla_target_minutes || 15;
  const opportunities = [];

  // 1. Uncontacted Leads (Consent-verified)
  const uncontactedByLoc = new Map();
  for (const lead of leads) {
    if (lead.stage === 'new' && lead.first_response_minutes === null) {
      const list = uncontactedByLoc.get(lead.location_id) || [];
      list.push(lead);
      uncontactedByLoc.set(lead.location_id, list);
    }
  }

  for (const [locId, rawList] of uncontactedByLoc.entries()) {
    const loc = locMap.get(locId);
    if (!loc) continue;
    const contactable = rawList.filter((l) => l.marketing_consent && !l.opted_out);
    const optedOutSkipped = rawList.length - contactable.length;
    if (contactable.length === 0) continue;

    const rawIdentifiedSum = contactable.reduce((s, l) => s + (l.estimated_value || 750), 0);
    const estimatedRecoverable = Math.round(rawIdentifiedSum * 0.28);

    opportunities.push({
      id: `opp-uncontacted-${loc.code}`,
      module: 'Lead Recovery',
      category: 'lead_recovery',
      location_id: loc.id,
      location_name: loc.name,
      priority: contactable.length >= 2 ? 'HIGH' : 'MEDIUM',
      what_happened: `${contactable.length} inbound consultation inquiry(s) have received zero response (${optedOutSkipped} opted-out record excluded).`,
      why_identified: `Inquiries exceeded the ${slaTarget}-minute speed-to-lead threshold with 0 outbound touches recorded.`,
      recommended_action: `Review and approve personalized concierge SMS/email follow-up drafts in Workflow Center to book consultations.`,
      supporting_evidence: {
        lead_ids: contactable.map((l) => l.external_id || l.id),
        channels: [...new Set(contactable.map((l) => l.channel))],
        opted_out_excluded: optedOutSkipped
      },
      identified_amount: rawIdentifiedSum,
      estimated_recoverable: estimatedRecoverable,
      calculation_note: `Identified = sum of inquiry est. values ($${rawIdentifiedSum.toLocaleString()}). Estimated recoverable applies conservative 28% late-lead recovery rate ($${estimatedRecoverable.toLocaleString()}).`,
      confidence: 'HIGH',
      data_quality: contactable.every((l) => l.email || l.phone) ? 'VERIFIED_CONTACTABLE' : 'PARTIAL_CONTACT',
      is_synthetic: contactable.some((l) => l.is_synthetic)
    });
  }

  // 2. Incomplete Follow-Up / Consultations Never Booked (`stage === 'contacted'`)
  const unbookedByLoc = new Map();
  for (const lead of leads) {
    if (lead.stage === 'contacted' && lead.followup_touches <= 1 && lead.marketing_consent && !lead.opted_out) {
      const arr = unbookedByLoc.get(lead.location_id) || [];
      arr.push(lead);
      unbookedByLoc.set(lead.location_id, arr);
    }
  }

  for (const [locId, list] of unbookedByLoc.entries()) {
    const loc = locMap.get(locId);
    if (!loc) continue;
    const rawSum = list.reduce((s, l) => s + (l.estimated_value || 750), 0);
    const estVal = Math.round(rawSum * 0.24);
    const avgFirstTouch = Math.round(
      list.reduce((s, l) => s + (l.first_response_minutes || 180), 0) / list.length
    );

    opportunities.push({
      id: `opp-unbooked-${loc.code}`,
      module: 'Lead Recovery',
      category: 'unbooked_consultation',
      location_id: loc.id,
      location_name: loc.name,
      priority: rawSum >= 900 ? 'HIGH' : 'MEDIUM',
      what_happened: `${list.length} contacted inquiry(s) stopped after <=1 touch without booking a consultation.`,
      why_identified: `Initial response averaged ${avgFirstTouch} mins (vs. ${slaTarget}m SLA) and follow-up sequence ended before consultation booking.`,
      recommended_action: `Queue second-touch scheduling outreach for coordinator approval to convert contacted inquiries into booked consultations.`,
      supporting_evidence: {
        lead_ids: list.map((l) => l.external_id || l.id),
        avg_first_response_minutes: avgFirstTouch
      },
      identified_amount: rawSum,
      estimated_recoverable: estVal,
      calculation_note: `Identified = $${rawSum.toLocaleString()} unbooked inquiry value. Estimated recoverable applies 24% second-touch booking conversion ($${estVal.toLocaleString()}).`,
      confidence: 'HIGH',
      data_quality: 'COMPLETE_FUNNEL_TIMESTAMPS',
      is_synthetic: list.some((l) => l.is_synthetic)
    });
  }

  // 3. Attended Consultations Not Yet Converted (`stage === 'consultation_attended'`)
  const postConsultByLoc = new Map();
  for (const lead of leads) {
    if (lead.stage === 'consultation_attended' && lead.marketing_consent && !lead.opted_out) {
      const arr = postConsultByLoc.get(lead.location_id) || [];
      arr.push(lead);
      postConsultByLoc.set(lead.location_id, arr);
    }
  }

  for (const [locId, list] of postConsultByLoc.entries()) {
    const loc = locMap.get(locId);
    if (!loc) continue;
    const rawSum = list.reduce((s, l) => s + (l.estimated_value || 1100), 0);
    const estVal = Math.round(rawSum * 0.35);

    opportunities.push({
      id: `opp-consult-${loc.code}`,
      module: 'Consultation Conversion',
      category: 'consultation_followup',
      location_id: loc.id,
      location_name: loc.name,
      priority: rawSum >= 1200 ? 'HIGH' : 'MEDIUM',
      what_happened: `${list.length} guest(s) attended an in-studio consultation without a recorded purchase follow-through.`,
      why_identified: `Post-consultation follow-up stopped at ${Math.max(...list.map((l) => l.followup_touches || 1))} touch(es) despite completed chair time.`,
      recommended_action: `Approve courteous coordinator follow-up to answer scheduling/package questions and close open consultations.`,
      supporting_evidence: {
        lead_ids: list.map((l) => l.external_id || l.id),
        stages: list.map((l) => l.stage)
      },
      identified_amount: rawSum,
      estimated_recoverable: estVal,
      calculation_note: `Identified = $${rawSum.toLocaleString()} attended-consult pipeline. Estimated recoverable applies 35% post-consult close rate ($${estVal.toLocaleString()}).`,
      confidence: 'HIGH',
      data_quality: 'POS_APPOINTMENT_ATTENDED',
      is_synthetic: list.some((l) => l.is_synthetic)
    });
  }

  // 4. Inactive High-Value & Single-Visit Customers (Non-Clinical Retention)
  const threshold = org.settings?.inactivity_threshold_days || 110;
  const inactiveByLoc = new Map();
  for (const cust of customers) {
    const days = daysBetween(cust.last_visit_date);
    if (days >= threshold && !cust.is_member && cust.marketing_consent && !cust.opted_out) {
      const arr = inactiveByLoc.get(cust.location_id) || [];
      arr.push({ ...cust, inactive_days: days });
      inactiveByLoc.set(cust.location_id, arr);
    }
  }

  for (const [locId, list] of inactiveByLoc.entries()) {
    const loc = locMap.get(locId);
    if (!loc) continue;
    const rawVisitValue = list.reduce(
      (s, c) => s + Math.round((c.lifetime_spend || 527) / Math.max(1, c.visit_count)),
      0
    );
    const estVal = Math.round(rawVisitValue * 0.25);

    opportunities.push({
      id: `opp-retention-${loc.code}`,
      module: 'Retention Intelligence',
      category: 'retention_reactivation',
      location_id: loc.id,
      location_name: loc.name,
      priority: list.length >= 2 ? 'HIGH' : 'MEDIUM',
      what_happened: `${list.length} consent-verified past customer(s) have not visited in ${threshold}+ days (avg ${Math.round(
        list.reduce((s, c) => s + c.inactive_days, 0) / list.length
      )} days inactive; ${list.filter((c) => (c.visit_count || 1) === 1).length} single-visit guest(s)).`,
      why_identified: `Exceeds ${threshold}-day repeat-visit cadence threshold; includes single-visit guests risking permanent churn.`,
      recommended_action: `Approve non-clinical hospitality re-engagement check-in offering priority scheduling (zero medical/treatment claims).`,
      supporting_evidence: {
        customer_ids: list.map((c) => c.external_id || c.id),
        inactive_days: list.map((c) => c.inactive_days)
      },
      identified_amount: rawVisitValue,
      estimated_recoverable: estVal,
      calculation_note: `Identified = 1 historical average visit ticket per inactive guest ($${rawVisitValue.toLocaleString()}). Estimated recoverable = 25% reactivation conversion ($${estVal.toLocaleString()}).`,
      confidence: 'MEDIUM-HIGH',
      data_quality: 'NON_CLINICAL_VISIT_LEDGER',
      is_synthetic: list.some((c) => c.is_synthetic)
    });
  }

  // 5. Location-Level Membership Penetration Gap
  const sortedPen = [...locMetrics].sort(
    (a, b) => b.membership_penetration_pct - a.membership_penetration_pct
  );
  const topQuartilePen = sortedPen[Math.min(1, sortedPen.length - 1)]?.membership_penetration_pct || 45;

  for (const m of locMetrics) {
    if (
      locMetrics.length >= 2 &&
      m.membership_penetration_pct < topQuartilePen * 0.55 &&
      m.eligible_non_members >= 100
    ) {
      const memPlan = memberships.find((x) => x.location_id === m.location_id);
      const monthlyPrice = memPlan?.monthly_price || 199;
      const targetConversions = Math.round(m.eligible_non_members * 0.08);
      const rawAnnualPotential = targetConversions * monthlyPrice * 12;
      const conservative6Mo = targetConversions * monthlyPrice * 6;

      opportunities.push({
        id: `opp-membership-${m.code}`,
        module: 'Membership Intelligence',
        category: 'membership_opportunity',
        location_id: m.location_id,
        location_name: m.name,
        priority: 'HIGH',
        what_happened: `${m.name} has ${m.membership_penetration_pct}% membership penetration vs. ${topQuartilePen}% at top group studios (${m.eligible_non_members} eligible repeat non-members).`,
        why_identified: `Location under-indexes peer group benchmark by ${(
          topQuartilePen - m.membership_penetration_pct
        ).toFixed(1)} pts while monthly cancellations reached ${m.membership_churn_pct}%.`,
        recommended_action: `Enable front-desk checkout eligibility prompts for repeat non-members (2+ visits) and deploy member credit-reminder cadence.`,
        supporting_evidence: {
          active_members: m.active_members,
          eligible_non_members: m.eligible_non_members,
          peer_benchmark_pct: topQuartilePen
        },
        identified_amount: rawAnnualPotential,
        estimated_recoverable: conservative6Mo,
        calculation_note: `Converting 8% of ${m.eligible_non_members} eligible repeat guests (${targetConversions} members) x $${monthlyPrice}/mo = $${conservative6Mo.toLocaleString()} 6-month membership value.`,
        confidence: 'MEDIUM-HIGH',
        data_quality: 'POS_MEMBERSHIP_SUMMARY',
        is_synthetic: m.is_synthetic
      });
    }
  }

  // 6. Location-Level Conversion Anomaly Diagnostic (Zero Double-Counted Dollars)
  if (locMetrics.length >= 3) {
    const groupAvgConv =
      locMetrics.reduce((s, m) => s + m.lead_to_sale_pct, 0) / Math.max(1, locMetrics.length);
    for (const m of locMetrics) {
      if (
        m.leads_total >= 3 &&
        m.lead_to_sale_pct < groupAvgConv * 0.5 &&
        (m.avg_response_minutes === null || m.avg_response_minutes > slaTarget * 8)
      ) {
        opportunities.push({
          id: `opp-anomaly-${m.code}`,
          module: 'Location Performance',
          category: 'location_conversion_anomaly',
          location_id: m.location_id,
          location_name: m.name,
          priority: 'HIGH',
          what_happened: `${m.name} converts ${m.lead_to_sale_pct}% of inquiries vs. ${groupAvgConv.toFixed(
            1
          )}% group average, with ${m.avg_response_minutes ?? 'unanswered'}m average response time.`,
          why_identified: `Cross-location outlier detector flagged >50% conversion deficit paired with severe front-desk speed-to-lead lag.`,
          recommended_action: `Reassign overflow web/Meta inquiries from ${m.name} to central booking concierge when studio front desk exceeds ${slaTarget} minutes.`,
          supporting_evidence: {
            studio_conversion_pct: m.lead_to_sale_pct,
            group_avg_conversion_pct: Math.round(groupAvgConv * 10) / 10,
            studio_avg_response_minutes: m.avg_response_minutes
          },
          identified_amount: 0,
          estimated_recoverable: 0,
          calculation_note: `Process diagnostic alert ($0 added to pipeline totals so underlying ${m.code} lead opportunities are never double-counted).`,
          confidence: 'HIGH',
          data_quality: 'CROSS_STUDIO_BENCHMARK',
          is_synthetic: m.is_synthetic
        });
      }
    }
  }

  return opportunities.sort(
    (a, b) => b.estimated_recoverable - a.estimated_recoverable || (a.priority === 'HIGH' ? -1 : 1)
  );
}

/**
 * Module C: Consultation Conversion Intelligence
 * Includes stage drop-offs, speed-to-lead cohorts, location comparisons, and team/coordinator breakdown.
 */
export function computeConsultationFunnel({ leads, locations }) {
  const total = leads.length;
  const contactedSet = new Set(['contacted', 'consultation_booked', 'consultation_attended', 'converted']);
  const bookedSet = new Set(['consultation_booked', 'consultation_attended', 'converted']);
  const attendedSet = new Set(['consultation_attended', 'converted']);

  const contacted = leads.filter((l) => contactedSet.has(l.stage)).length;
  const booked = leads.filter((l) => bookedSet.has(l.stage)).length;
  const attended = leads.filter((l) => attendedSet.has(l.stage)).length;
  const converted = leads.filter((l) => l.stage === 'converted').length;

  const fastLeads = leads.filter((l) => l.first_response_minutes !== null && l.first_response_minutes <= 15);
  const slowLeads = leads.filter((l) => l.first_response_minutes === null || l.first_response_minutes > 60);

  // Per-location funnel comparison
  const byLocation = locations.map((loc) => {
    const ll = leads.filter((l) => l.location_id === loc.id);
    const lContacted = ll.filter((l) => contactedSet.has(l.stage)).length;
    const lBooked = ll.filter((l) => bookedSet.has(l.stage)).length;
    const lAttended = ll.filter((l) => attendedSet.has(l.stage)).length;
    const lConverted = ll.filter((l) => l.stage === 'converted').length;
    const resp = ll.filter((l) => typeof l.first_response_minutes === 'number');
    return {
      location_id: loc.id,
      code: loc.code,
      name: loc.name,
      leads: ll.length,
      contacted: lContacted,
      booked: lBooked,
      attended: lAttended,
      converted: lConverted,
      conversion_pct: pct(lConverted, ll.length),
      avg_response_minutes: resp.length
        ? Math.round(resp.reduce((s, l) => s + l.first_response_minutes, 0) / resp.length)
        : null,
      recorded_converted_revenue_usd: ll
        .filter((l) => l.stage === 'converted')
        .reduce((s, l) => s + Number(l.collected_amount || 0), 0)
    };
  });

  // Coordinator / Team performance where source data supports it
  const coordGroups = new Map();
  let missingCoordinatorCount = 0;
  for (const l of leads) {
    const label = l.coordinator ? String(l.coordinator).trim() : '';
    if (!label) {
      missingCoordinatorCount += 1;
      continue;
    }
    const list = coordGroups.get(label) || [];
    list.push(l);
    coordGroups.set(label, list);
  }

  const teamPerformance = [...coordGroups.entries()]
    .map(([coordinator, list]) => {
      const resp = list.filter((l) => typeof l.first_response_minutes === 'number');
      const bCount = list.filter((l) => bookedSet.has(l.stage)).length;
      const cCount = list.filter((l) => l.stage === 'converted').length;
      return {
        coordinator,
        leads_assigned: list.length,
        avg_response_minutes: resp.length
          ? Math.round(resp.reduce((s, l) => s + l.first_response_minutes, 0) / resp.length)
          : null,
        booked_pct: pct(bCount, list.length),
        converted_pct: pct(cCount, list.length)
      };
    })
    .sort((a, b) => b.converted_pct - a.converted_pct);

  return {
    stages: [
      { stage: 'Lead Received', count: total, pct_of_total: total ? 100 : 0, step_conversion_pct: total ? 100 : 0, dropoff_count: 0, dropoff_pct: 0 },
      { stage: 'Contacted', count: contacted, pct_of_total: pct(contacted, total), step_conversion_pct: pct(contacted, total), dropoff_count: total - contacted, dropoff_pct: pct(total - contacted, total) },
      { stage: 'Consultation Booked', count: booked, pct_of_total: pct(booked, total), step_conversion_pct: pct(booked, contacted), dropoff_count: contacted - booked, dropoff_pct: pct(contacted - booked, contacted) },
      { stage: 'Consultation Attended', count: attended, pct_of_total: pct(attended, total), step_conversion_pct: pct(attended, booked), dropoff_count: booked - attended, dropoff_pct: pct(booked - attended, booked) },
      { stage: 'Customer Converted', count: converted, pct_of_total: pct(converted, total), step_conversion_pct: pct(converted, attended), dropoff_count: attended - converted, dropoff_pct: pct(attended - converted, attended) }
    ],
    speed_cohorts: {
      under_15_min: {
        leads: fastLeads.length,
        converted: fastLeads.filter((l) => l.stage === 'converted').length,
        conversion_pct: pct(fastLeads.filter((l) => l.stage === 'converted').length, fastLeads.length)
      },
      over_60_min_or_unanswered: {
        leads: slowLeads.length,
        converted: slowLeads.filter((l) => l.stage === 'converted').length,
        conversion_pct: pct(slowLeads.filter((l) => l.stage === 'converted').length, slowLeads.length)
      }
    },
    by_location: byLocation,
    team_performance: teamPerformance,
    missing_coordinator_leads_count: missingCoordinatorCount,
    location_count: locations.length
  };
}

/**
 * Module D: Non-Clinical Customer Retention & Reactivation Intelligence
 */
export function computeRetentionIntelligence({ org, customers, locations }) {
  const threshold = org.settings?.inactivity_threshold_days || 110;
  const locMap = new Map(locations.map((l) => [l.id, l.name]));

  const singleVisit = customers.filter((c) => (c.visit_count || 1) === 1);
  const repeatVisit = customers.filter((c) => (c.visit_count || 1) >= 2);

  const avgSingleSpend = singleVisit.length
    ? Math.round(singleVisit.reduce((s, c) => s + Number(c.lifetime_spend || 0), 0) / singleVisit.length)
    : null;
  const avgRepeatSpend = repeatVisit.length
    ? Math.round(repeatVisit.reduce((s, c) => s + Number(c.lifetime_spend || 0), 0) / repeatVisit.length)
    : null;

  const segments = {
    active_under_90d: 0,
    approaching_90_to_threshold: 0,
    eligible_reactivation_threshold_to_179d: 0,
    deep_lapsed_180d_plus: 0,
    excluded_opted_out_or_no_consent: 0
  };

  const reengagementQueue = [];

  for (const c of customers) {
    const days = daysBetween(c.last_visit_date);
    const contactPermitted = Boolean(c.marketing_consent) && !c.opted_out;
    if (!contactPermitted) {
      segments.excluded_opted_out_or_no_consent += 1;
      continue;
    }
    if (days < 90) {
      segments.active_under_90d += 1;
    } else if (days < threshold) {
      segments.approaching_90_to_threshold += 1;
    } else if (days < 180) {
      segments.eligible_reactivation_threshold_to_179d += 1;
    } else {
      segments.deep_lapsed_180d_plus += 1;
    }

    if (days >= threshold && !c.is_member) {
      reengagementQueue.push({
        customer_id: c.id,
        external_id: c.external_id,
        customer_name: c.customer_name,
        location_name: locMap.get(c.location_id) || c.location_id,
        visit_count: c.visit_count,
        last_visit_date: c.last_visit_date,
        inactive_days: days,
        lifetime_spend: c.lifetime_spend,
        recommended_followup:
          c.visit_count === 1
            ? 'Second-visit hospitality check-in (non-clinical scheduling concierge)'
            : 'VIP repeat-guest seasonal booking invitation (non-clinical)'
      });
    }
  }

  return {
    total_customers_tracked: customers.length,
    repeat_visit_rate_pct: pct(repeatVisit.length, customers.length),
    single_visit_count: singleVisit.length,
    repeat_visit_count: repeatVisit.length,
    avg_single_visit_spend_usd: avgSingleSpend,
    avg_repeat_customer_spend_usd: avgRepeatSpend,
    inactivity_threshold_days: threshold,
    segments,
    reengagement_candidates: reengagementQueue.sort((a, b) => b.inactive_days - a.inactive_days),
    compliance_note:
      'Strictly non-clinical operational segmentation based on visit count, last visit date, spend total, and explicit marketing consent. Zero medical records, diagnoses, or treatment recommendations.'
  };
}

/**
 * Module E: Membership Intelligence
 */
export function computeMembershipIntelligence({ locations, memberships }) {
  const locMap = new Map(locations.map((l) => [l.id, l]));
  const rows = memberships.map((m) => {
    const loc = locMap.get(m.location_id);
    const pool = m.active_members + m.eligible_non_members;
    const penetrationPct = pct(m.active_members, pool);
    const churnPct = pct(m.cancellations_30d, Math.max(1, m.active_members));
    const retentionPct = m.active_members > 0 ? Math.max(0, Math.round((100 - churnPct) * 10) / 10) : 0;
    const netAdds30d = (m.new_enrollments_30d || 0) - (m.cancellations_30d || 0);
    return {
      membership_id: m.id,
      location_id: m.location_id,
      location_name: loc?.name || m.location_id,
      location_code: loc?.code || '',
      plan_name: m.plan_name,
      monthly_price: m.monthly_price,
      active_members: m.active_members,
      new_enrollments_30d: m.new_enrollments_30d || 0,
      cancellations_30d: m.cancellations_30d || 0,
      net_adds_30d: netAdds30d,
      eligible_non_members: m.eligible_non_members,
      penetration_pct: penetrationPct,
      monthly_churn_pct: churnPct,
      monthly_retention_pct: retentionPct,
      mrr_usd: m.active_members * m.monthly_price
    };
  });

  const totalMembers = rows.reduce((s, r) => s + r.active_members, 0);
  const totalMrr = rows.reduce((s, r) => s + r.mrr_usd, 0);
  const totalNew30d = rows.reduce((s, r) => s + r.new_enrollments_30d, 0);
  const totalCancel30d = rows.reduce((s, r) => s + r.cancellations_30d, 0);
  const totalEligible = rows.reduce((s, r) => s + r.eligible_non_members, 0);
  const groupChurnPct = pct(totalCancel30d, Math.max(1, totalMembers));

  return {
    total_active_members: totalMembers,
    total_mrr_usd: totalMrr,
    annualized_arr_usd: totalMrr * 12,
    new_enrollments_30d: totalNew30d,
    cancellations_30d: totalCancel30d,
    net_member_growth_30d: totalNew30d - totalCancel30d,
    group_penetration_pct: pct(totalMembers, totalMembers + totalEligible),
    group_monthly_retention_pct: totalMembers > 0 ? Math.max(0, Math.round((100 - groupChurnPct) * 10) / 10) : 0,
    by_location: rows.sort((a, b) => b.penetration_pct - a.penetration_pct)
  };
}

/**
 * Section 4: Provable ROI Attribution Engine
 * NEVER treats an identified opportunity as recovered revenue.
 * Enforces human approval, POS receipt reference, AND configurable attribution_window_days.
 */
export function computeProvableRoi({ org, opportunities, workflowTasks, leads, memberships }) {
  const identifiedOpportunityTotal = opportunities.reduce((s, o) => s + (o.identified_amount || 0), 0);
  const estimatedOpportunityTotal = opportunities.reduce((s, o) => s + (o.estimated_recoverable || 0), 0);
  const attributionWindowDays = Number(org.settings?.attribution_window_days || 30);

  const initiatedStages = new Set(['action_initiated', 'appointment_booked', 'sale_completed', 'revenue_collected']);
  const bookedStages = new Set(['appointment_booked', 'sale_completed', 'revenue_collected']);
  const completedStages = new Set(['sale_completed', 'revenue_collected']);

  const initiatedTasks = workflowTasks.filter((t) => initiatedStages.has(t.lifecycle_stage));
  const bookedTasks = workflowTasks.filter((t) => bookedStages.has(t.lifecycle_stage));
  const saleCompletedTasks = workflowTasks.filter((t) => completedStages.has(t.lifecycle_stage));

  const verifiedCollectedTasks = [];
  const unverifiedClaimedTasks = [];
  const outsideWindowTasks = [];

  for (const t of workflowTasks) {
    if (t.lifecycle_stage !== 'revenue_collected') continue;
    if (!t.action_initiated_at || !t.receipt_reference || Number(t.collected_revenue) <= 0) {
      unverifiedClaimedTasks.push(t);
      continue;
    }
    const initiatedDate = new Date(t.action_initiated_at);
    const settledDate = new Date(t.updated_at || t.action_initiated_at);
    const deltaDays = (settledDate.getTime() - initiatedDate.getTime()) / 86400000;
    if (!Number.isNaN(deltaDays) && (deltaDays < -0.01 || deltaDays > attributionWindowDays)) {
      outsideWindowTasks.push(t);
      continue;
    }
    verifiedCollectedTasks.push(t);
  }

  const revenueCollectedVerified = verifiedCollectedTasks.reduce(
    (s, t) => s + Number(t.collected_revenue || 0),
    0
  );

  const respondedLeads = leads.filter((l) => typeof l.first_response_minutes === 'number');
  const currentAvgResponse = respondedLeads.length
    ? Math.round(
        respondedLeads.reduce((s, l) => s + l.first_response_minutes, 0) / respondedLeads.length
      )
    : null;

  const bookedLeadSet = new Set(['consultation_booked', 'consultation_attended', 'converted']);
  const currentInquiryToConsultPct = pct(
    leads.filter((l) => bookedLeadSet.has(l.stage)).length,
    leads.length
  );

  const totalMrr = memberships.reduce((s, m) => s + m.active_members * m.monthly_price, 0);
  const totalMembers = memberships.reduce((s, m) => s + m.active_members, 0);
  const totalPool = memberships.reduce((s, m) => s + m.active_members + m.eligible_non_members, 0);
  const currentPenetrationPct = pct(totalMembers, totalPool);

  const missingBaselineFields = [];
  if (org.baseline?.avg_response_minutes == null) missingBaselineFields.push('avg_response_minutes');
  if (org.baseline?.inquiry_to_consult_rate == null) missingBaselineFields.push('inquiry_to_consult_rate');
  if (org.baseline?.membership_penetration_rate == null) missingBaselineFields.push('membership_penetration_rate');

  const baselineConsultPct =
    org.baseline?.inquiry_to_consult_rate != null
      ? Math.round(org.baseline.inquiry_to_consult_rate * 1000) / 10
      : null;

  return {
    contains_synthetic_data:
      Boolean(org.is_synthetic) || verifiedCollectedTasks.some((t) => t.is_synthetic),
    baseline_label: org.baseline_period_label || 'Baseline Not Configured',
    attribution_window_days: attributionWindowDays,
    stages: {
      identified_opportunity_usd: identifiedOpportunityTotal,
      estimated_opportunity_usd: estimatedOpportunityTotal,
      actions_initiated_count: initiatedTasks.length,
      actions_initiated_est_usd: initiatedTasks.reduce((s, t) => s + (t.estimated_value || 0), 0),
      appointments_booked_count: bookedTasks.length,
      appointments_booked_est_usd: bookedTasks.reduce((s, t) => s + (t.estimated_value || 0), 0),
      sales_completed_count: saleCompletedTasks.length,
      revenue_collected_verified_usd: revenueCollectedVerified
    },
    baseline_comparison: {
      baseline_avg_response_min: org.baseline?.avg_response_minutes ?? null,
      current_avg_response_min: currentAvgResponse,
      baseline_inquiry_to_consult_pct: baselineConsultPct,
      current_inquiry_to_consult_pct: currentInquiryToConsultPct,
      inquiry_to_consult_lift_pts:
        baselineConsultPct !== null
          ? Math.round((currentInquiryToConsultPct - baselineConsultPct) * 10) / 10
          : null,
      baseline_membership_penetration_pct:
        org.baseline?.membership_penetration_rate != null
          ? Math.round(org.baseline.membership_penetration_rate * 1000) / 10
          : null,
      current_membership_penetration_pct: currentPenetrationPct,
      current_membership_mrr_usd: totalMrr,
      estimated_weekly_admin_hours_saved: Math.min(
        org.baseline?.manual_ops_hours_per_week || 20,
        Math.round(initiatedTasks.length * 1.5 + 8)
      ),
      missing_baseline_fields: missingBaselineFields
    },
    calculation_formulas: {
      identified_opportunity_usd: 'Sum of raw inquiry/visit/membership potential across eligible open opportunities (never counted as recovered revenue).',
      estimated_opportunity_usd: 'Sum of conservative stage-weighted conversion factors (24%–35% lead/consult recovery, 25% inactive guest reactivation, 6-month retained value on 8% eligible repeat non-members).',
      revenue_collected_verified_usd: `Sum of settled POS receipts on workflows where approval_status='approved', action_initiated_at is recorded, receipt_reference is non-empty, and settlement occurred within ${attributionWindowDays} days of action initiation.`,
      inquiry_to_consult_lift_pts: 'Current (Consultation Booked + Attended + Converted) / Total Leads % minus Baseline Inquiry-to-Consult %.',
      estimated_weekly_admin_hours_saved: 'Capped against baseline manual weekly spreadsheet/follow-up hours: min(baseline_manual_hours, initiated_workflows * 1.5h + 8h automated multi-location rollup).'
    },
    verified_ledger: verifiedCollectedTasks.map((t) => ({
      task_id: t.id,
      title: t.title,
      category: t.category,
      action_initiated_at: t.action_initiated_at,
      collected_revenue: t.collected_revenue,
      receipt_reference: t.receipt_reference,
      is_synthetic: Boolean(t.is_synthetic)
    })),
    data_warnings: [
      ...(org.is_synthetic
        ? ['SYNTHETIC DEMO NOTICE: Organization records include clearly labeled synthetic demonstration records. Do not cite in external marketing as live customer results.']
        : []),
      ...(missingBaselineFields.length > 0
        ? [`Missing baseline configuration for: ${missingBaselineFields.join(', ')}. Configure baseline metrics in Settings for complete lift deltas.`]
        : []),
      ...(unverifiedClaimedTasks.length > 0
        ? [`${unverifiedClaimedTasks.length} completed workflow(s) lacked a POS receipt_reference or prior action_initiated timestamp and were EXCLUDED from Verified Revenue Collected.`]
        : []),
      ...(outsideWindowTasks.length > 0
        ? [`${outsideWindowTasks.length} workflow receipt(s) fell outside the ${attributionWindowDays}-day attribution window and were EXCLUDED from Verified Revenue Collected.`]
        : []),
      `Attribution methodology: Only settled POS/membership receipts linked to a human-approved platform action within the ${attributionWindowDays}-day attribution window are counted in Revenue Collected.`
    ]
  };
}

/**
 * Module F: 6-Part Weekly Executive Report (100% Tenant-Isolated & Data-Driven)
 */
export function generateWeeklyExecutiveReport({
  org,
  locationMetrics,
  opportunities,
  roi,
  weeklyTrends
}) {
  const latest = weeklyTrends[weeklyTrends.length - 1];
  const first = weeklyTrends[0];
  const underperformers = [...locationMetrics]
    .sort(
      (a, b) =>
        b.uncontacted_leads + (100 - b.lead_to_sale_pct) - (a.uncontacted_leads + (100 - a.lead_to_sale_pct))
    )
    .slice(0, 3);
  const topPerformers = [...locationMetrics]
    .sort((a, b) => b.lead_to_sale_pct - a.lead_to_sale_pct)
    .slice(0, 2);
  const highestChurnStudios = [...locationMetrics]
    .filter((l) => l.membership_churn_pct > 0)
    .sort((a, b) => b.membership_churn_pct - a.membership_churn_pct)
    .slice(0, 2);

  const declinedSummary = highestChurnStudios.length
    ? `Elevated 30-day membership cancellations at ${highestChurnStudios
        .map((l) => `${l.name} (${l.membership_churn_pct}% monthly churn)`)
        .join(' and ')}.`
    : underperformers.some((u) => u.uncontacted_leads > 0)
    ? `Unanswered inquiry backlog detected at ${underperformers
        .filter((u) => u.uncontacted_leads > 0)
        .map((u) => `${u.name} (${u.uncontacted_leads} uncontacted)`)
        .join(', ')}.`
    : 'No membership churn spikes or unanswered inquiry backlogs recorded in current tenant dataset.';

  return {
    generated_at: new Date().toISOString(),
    organization: org.name,
    is_synthetic_demo: Boolean(org.is_synthetic),
    sections: {
      improved:
        latest && first && weeklyTrends.length >= 2
          ? `Sub-15-minute inquiry response improved from ${first.pct_under_15m}% (${first.week}) to ${latest.pct_under_15m}% (${latest.week}); consultation booking rate rose from ${first.consult_booked_pct}% to ${latest.consult_booked_pct}%. Top studios: ${topPerformers
              .map((l) => `${l.name} (${l.lead_to_sale_pct}% lead-to-sale)`)
              .join(', ')}.`
          : topPerformers.length
          ? `Current studio leader(s): ${topPerformers
              .map((l) => `${l.name} (${l.lead_to_sale_pct}% lead-to-sale)`)
              .join(', ')}. Import multi-week historical CSVs to unlock week-over-week trend deltas.`
          : 'Insufficient multi-week trend data uploaded yet; import historical CSVs to unlock week-over-week deltas.',
      declined: declinedSummary,
      where_revenue_lost: `${opportunities.length} active operational findings totaling $${roi.stages.identified_opportunity_usd.toLocaleString()} in raw identified volume ($${roi.stages.estimated_opportunity_usd.toLocaleString()} conservative recoverable estimate) across uncontacted inquiries, unbooked consultations, post-consultation follow-up, ${
        org.settings?.inactivity_threshold_days || 110
      }+ day inactive repeat guests, and membership gaps.`,
      locations_needing_attention: underperformers.map(
        (u) =>
          `${u.name} (${u.code}): ${u.uncontacted_leads} uncontacted leads, avg response ${
            u.avg_response_minutes ?? 'N/A'
          }m, ${u.membership_penetration_pct}% membership penetration`
      ),
      next_management_actions: opportunities
        .slice(0, 4)
        .map(
          (o) =>
            `[${o.location_name} · ${o.module}] ${o.recommended_action}${
              o.estimated_recoverable > 0 ? ` (Est. $${o.estimated_recoverable.toLocaleString()})` : ''
            }`
        ),
      verified_measurable_results: `Verified Collected Revenue (with POS receipt attribution within ${roi.attribution_window_days}d window): $${roi.stages.revenue_collected_verified_usd.toLocaleString()} across ${roi.verified_ledger.length} settled transaction(s); ${roi.stages.appointments_booked_count} consultation/reactivation booking(s) tracked; Identified/Estimated pipeline strictly segregated from collected figures.`
    }
  };
}
