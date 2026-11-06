import { hashPassword } from './security.js';

export function buildSeedState() {
  const demoOwnerHash = hashPassword('DemoOwner2026!');
  const demoOperatorHash = hashPassword('DemoOps2026!');
  const demoViewerHash = hashPassword('DemoViewer2026!');
  const tenant2OwnerHash = hashPassword('TenantTwo2026!');

  const organizations = [
    {
      id: 'org-lumina-demo',
      name: 'Lumina Aesthetics Collective [SYNTHETIC DEMO]',
      slug: 'lumina-demo',
      is_synthetic: true,
      baseline_period_label: 'Q3 2026 Pre-Deployment Baseline (Synthetic)',
      baseline: {
        avg_response_minutes: 214,
        inquiry_to_consult_rate: 0.31,
        consult_to_sale_rate: 0.54,
        repeat_visit_90d_rate: 0.44,
        membership_penetration_rate: 0.118,
        manual_ops_hours_per_week: 38
      },
      settings: {
        attribution_window_days: 30,
        sla_target_minutes: 15,
        inactivity_threshold_days: 110,
        require_human_approval: true
      }
    },
    {
      id: 'org-radiance-isolated',
      name: 'Radiance Regional Aesthetics [SYNTHETIC DEMO - TENANT B]',
      slug: 'radiance-demo',
      is_synthetic: true,
      baseline_period_label: 'Q3 2026 Baseline (Synthetic)',
      baseline: {
        avg_response_minutes: 145,
        inquiry_to_consult_rate: 0.36,
        consult_to_sale_rate: 0.58,
        repeat_visit_90d_rate: 0.49,
        membership_penetration_rate: 0.15,
        manual_ops_hours_per_week: 18
      },
      settings: {
        attribution_window_days: 30,
        sla_target_minutes: 15,
        inactivity_threshold_days: 110,
        require_human_approval: true
      }
    }
  ];

  const users = [
    {
      id: 'usr-lumina-owner',
      org_id: 'org-lumina-demo',
      email: 'ceo@lumina-demo.example',
      name: 'Elena Vance (CEO · Demo)',
      role: 'owner',
      password_hash: demoOwnerHash
    },
    {
      id: 'usr-lumina-ops',
      org_id: 'org-lumina-demo',
      email: 'revops@lumina-demo.example',
      name: 'Marcus Sterling (VP Ops · Demo)',
      role: 'operator',
      password_hash: demoOperatorHash
    },
    {
      id: 'usr-lumina-viewer',
      org_id: 'org-lumina-demo',
      email: 'cfo-readonly@lumina-demo.example',
      name: 'Claire Lin (Board Analyst · Read-Only)',
      role: 'viewer',
      password_hash: demoViewerHash
    },
    {
      id: 'usr-radiance-owner',
      org_id: 'org-radiance-isolated',
      email: 'owner@radiance-demo.example',
      name: 'Devon Brooks (Tenant B Owner)',
      role: 'owner',
      password_hash: tenant2OwnerHash
    }
  ];

  const locations = [
    { id: 'loc-aus', org_id: 'org-lumina-demo', code: 'AUS-DOM', name: 'Austin Domain Studio', state: 'TX', pos_system: 'Boulevard (Simulated Export)', monthly_revenue_target: 165000, active_providers: 6, is_synthetic: true },
    { id: 'loc-dal', org_id: 'org-lumina-demo', code: 'DAL-KNX', name: 'Dallas Knox-Henderson', state: 'TX', pos_system: 'Boulevard (Simulated Export)', monthly_revenue_target: 155000, active_providers: 5, is_synthetic: true },
    { id: 'loc-hou', org_id: 'org-lumina-demo', code: 'HOU-RIV', name: 'Houston River Oaks', state: 'TX', pos_system: 'Zenoti (Simulated Export)', monthly_revenue_target: 170000, active_providers: 6, is_synthetic: true },
    { id: 'loc-den', org_id: 'org-lumina-demo', code: 'DEN-CCK', name: 'Denver Cherry Creek', state: 'CO', pos_system: 'Boulevard (Simulated Export)', monthly_revenue_target: 150000, active_providers: 5, is_synthetic: true },
    { id: 'loc-bld', org_id: 'org-lumina-demo', code: 'BLD-PRL', name: 'Boulder Pearl Street', state: 'CO', pos_system: 'Aesthetic Record CSV (Simulated)', monthly_revenue_target: 125000, active_providers: 4, is_synthetic: true },
    { id: 'loc-sct', org_id: 'org-lumina-demo', code: 'SCT-KRL', name: 'Scottsdale Kierland', state: 'AZ', pos_system: 'Zenoti (Simulated Export)', monthly_revenue_target: 180000, active_providers: 7, is_synthetic: true },
    { id: 'loc-nsh', org_id: 'org-lumina-demo', code: 'NSH-GLC', name: 'Nashville Gulch', state: 'TN', pos_system: 'Aesthetic Record CSV (Simulated)', monthly_revenue_target: 135000, active_providers: 4, is_synthetic: true },
    { id: 'loc-pln', org_id: 'org-lumina-demo', code: 'PLN-LGC', name: 'Plano Legacy West', state: 'TX', pos_system: 'Boulevard (Simulated Export)', monthly_revenue_target: 140000, active_providers: 5, is_synthetic: true },
    // Tenant B isolated location
    { id: 'loc-rad-1', org_id: 'org-radiance-isolated', code: 'MIA-BRK', name: 'Miami Brickell Flagship', state: 'FL', pos_system: 'Zenoti (Simulated)', monthly_revenue_target: 190000, active_providers: 6, is_synthetic: true }
  ];

  // Generate deterministic, realistic synthetic leads across the 8 Lumina locations
  const leads = [
    // Houston River Oaks — Severe response lag & uncontacted lead leak
    { id: 'ld-101', org_id: 'org-lumina-demo', external_id: 'SYN-LD-101', location_id: 'loc-hou', contact_name: ' Jordan Avery [SYNTHETIC]', email: 'jordan.avery@synthetic.example', phone: '555-0101', channel: 'Meta Lead Form', created_at: '2026-11-02T14:10:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 850, marketing_consent: true, opted_out: false, coordinator: 'Front Desk HOU', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-102', org_id: 'org-lumina-demo', external_id: 'SYN-LD-102', location_id: 'loc-hou', contact_name: 'Taylor Morgan [SYNTHETIC]', email: 'taylor.m@synthetic.example', phone: '555-0102', channel: 'Web Consultation Request', created_at: '2026-11-01T19:40:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 1100, marketing_consent: true, opted_out: false, coordinator: 'Front Desk HOU', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-103', org_id: 'org-lumina-demo', external_id: 'SYN-LD-103', location_id: 'loc-hou', contact_name: 'Casey Bennett [SYNTHETIC]', email: 'casey.b@synthetic.example', phone: '555-0103', channel: 'Instagram Inquiry', created_at: '2026-10-30T16:05:00Z', first_response_minutes: 640, followup_touches: 1, stage: 'contacted', estimated_value: 720, marketing_consent: true, opted_out: false, coordinator: 'Front Desk HOU', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-104', org_id: 'org-lumina-demo', external_id: 'SYN-LD-104', location_id: 'loc-hou', contact_name: 'Riley Brooks [SYNTHETIC]', email: 'riley.b@synthetic.example', phone: '555-0104', channel: 'Google Search', created_at: '2026-10-28T11:20:00Z', first_response_minutes: 490, followup_touches: 1, stage: 'consultation_attended', estimated_value: 1450, marketing_consent: true, opted_out: false, coordinator: 'Front Desk HOU', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-105', org_id: 'org-lumina-demo', external_id: 'SYN-LD-105', location_id: 'loc-hou', contact_name: 'Morgan Hayes [SYNTHETIC]', email: 'morgan.h@synthetic.example', phone: '555-0105', channel: 'Referral', created_at: '2026-10-25T10:15:00Z', first_response_minutes: 28, followup_touches: 3, stage: 'converted', collected_amount: 1280, marketing_consent: true, opted_out: false, coordinator: 'Front Desk HOU', is_synthetic: true, data_source: 'synthetic_seed' },

    // Boulder Pearl Street — Uncontacted weekend inquiries + stalled post-consults
    { id: 'ld-106', org_id: 'org-lumina-demo', external_id: 'SYN-LD-106', location_id: 'loc-bld', contact_name: 'Quinn Sullivan [SYNTHETIC]', email: 'quinn.s@synthetic.example', phone: '555-0106', channel: 'Meta Lead Form', created_at: '2026-11-03T01:15:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 920, marketing_consent: true, opted_out: false, coordinator: 'Front Desk BLD', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-107', org_id: 'org-lumina-demo', external_id: 'SYN-LD-107', location_id: 'loc-bld', contact_name: 'Avery Parker [SYNTHETIC]', email: 'avery.p@synthetic.example', phone: '555-0107', channel: 'Google Local', created_at: '2026-11-01T22:10:00Z', first_response_minutes: 780, followup_touches: 1, stage: 'contacted', estimated_value: 680, marketing_consent: true, opted_out: false, coordinator: 'Front Desk BLD', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-108', org_id: 'org-lumina-demo', external_id: 'SYN-LD-108', location_id: 'loc-bld', contact_name: 'Harper Reed [SYNTHETIC]', email: 'harper.r@synthetic.example', phone: '555-0108', channel: 'Web Consultation Request', created_at: '2026-10-27T15:30:00Z', first_response_minutes: 310, followup_touches: 1, stage: 'consultation_attended', estimated_value: 1600, marketing_consent: true, opted_out: false, coordinator: 'Front Desk BLD', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-109', org_id: 'org-lumina-demo', external_id: 'SYN-LD-109', location_id: 'loc-bld', contact_name: 'optout-test@synthetic.example [OPTED OUT]', email: 'optout@synthetic.example', phone: '555-0109', channel: 'Meta Lead Form', created_at: '2026-11-02T12:00:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 750, marketing_consent: false, opted_out: true, coordinator: 'Front Desk BLD', is_synthetic: true, data_source: 'synthetic_seed' },

    // Nashville Gulch — High inquiry volume, weak booking follow-through
    { id: 'ld-110', org_id: 'org-lumina-demo', external_id: 'SYN-LD-110', location_id: 'loc-nsh', contact_name: 'logan.price [SYNTHETIC]', email: 'logan.p@synthetic.example', phone: '555-0110', channel: 'Meta Lead Form', created_at: '2026-11-03T13:00:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 790, marketing_consent: true, opted_out: false, coordinator: 'Front Desk NSH', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-111', org_id: 'org-lumina-demo', external_id: 'SYN-LD-111', location_id: 'loc-nsh', contact_name: 'Cameron Ross [SYNTHETIC]', email: 'cameron.r@synthetic.example', phone: '555-0111', channel: 'Google Search', created_at: '2026-10-29T17:45:00Z', first_response_minutes: 520, followup_touches: 1, stage: 'contacted', estimated_value: 950, marketing_consent: true, opted_out: false, coordinator: 'Front Desk NSH', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-112', org_id: 'org-lumina-demo', external_id: 'SYN-LD-112', location_id: 'loc-nsh', contact_name: 'blake.foster [SYNTHETIC]', email: 'blake.f@synthetic.example', phone: '555-0112', channel: 'Web Form', created_at: '2026-10-24T11:00:00Z', first_response_minutes: 19, followup_touches: 3, stage: 'consultation_booked', estimated_value: 880, marketing_consent: true, opted_out: false, coordinator: 'Front Desk NSH', is_synthetic: true, data_source: 'synthetic_seed' },

    // Austin Domain & Scottsdale Kierland — High-performing benchmark clinics (<15 min SLA)
    { id: 'ld-113', org_id: 'org-lumina-demo', external_id: 'SYN-LD-113', location_id: 'loc-aus', contact_name: 'Sydney Cole [SYNTHETIC]', email: 'sydney.c@synthetic.example', phone: '555-0113', channel: 'Google Search', created_at: '2026-10-26T14:10:00Z', first_response_minutes: 8, followup_touches: 4, stage: 'converted', collected_amount: 1650, marketing_consent: true, opted_out: false, coordinator: 'Concierge AUS', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-114', org_id: 'org-lumina-demo', external_id: 'SYN-LD-114', location_id: 'loc-aus', contact_name: 'Devon Lane [SYNTHETIC]', email: 'devon.l@synthetic.example', phone: '555-0114', channel: 'Meta Lead Form', created_at: '2026-10-27T10:05:00Z', first_response_minutes: 11, followup_touches: 3, stage: 'converted', collected_amount: 1120, marketing_consent: true, opted_out: false, coordinator: 'Concierge AUS', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-115', org_id: 'org-lumina-demo', external_id: 'SYN-LD-115', location_id: 'loc-aus', contact_name: 'kendall.w [SYNTHETIC]', email: 'kendall.w@synthetic.example', phone: '555-0115', channel: 'Referral', created_at: '2026-10-31T15:20:00Z', first_response_minutes: 9, followup_touches: 3, stage: 'consultation_attended', estimated_value: 1350, marketing_consent: true, opted_out: false, coordinator: 'Concierge AUS', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-116', org_id: 'org-lumina-demo', external_id: 'SYN-LD-116', location_id: 'loc-sct', contact_name: 'Peyton Cruz [SYNTHETIC]', email: 'peyton.c@synthetic.example', phone: '555-0116', channel: 'Google Search', created_at: '2026-10-22T12:15:00Z', first_response_minutes: 7, followup_touches: 4, stage: 'converted', collected_amount: 1940, marketing_consent: true, opted_out: false, coordinator: 'Concierge SCT', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-117', org_id: 'org-lumina-demo', external_id: 'SYN-LD-117', location_id: 'loc-sct', contact_name: 'Reese Ellis [SYNTHETIC]', email: 'reese.e@synthetic.example', phone: '555-0117', channel: 'Web Form', created_at: '2026-10-25T16:40:00Z', first_response_minutes: 12, followup_touches: 4, stage: 'converted', collected_amount: 1490, marketing_consent: true, opted_out: false, coordinator: 'Concierge SCT', is_synthetic: true, data_source: 'synthetic_seed' },

    // Dallas, Denver, Plano — Mixed performance
    { id: 'ld-118', org_id: 'org-lumina-demo', external_id: 'SYN-LD-118', location_id: 'loc-dal', contact_name: 'Skyler Grant [SYNTHETIC]', email: 'skyler.g@synthetic.example', phone: '555-0118', channel: 'Meta Lead Form', created_at: '2026-11-01T18:00:00Z', first_response_minutes: 95, followup_touches: 1, stage: 'contacted', estimated_value: 840, marketing_consent: true, opted_out: false, coordinator: 'Front Desk DAL', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-119', org_id: 'org-lumina-demo', external_id: 'SYN-LD-119', location_id: 'loc-dal', contact_name: 'Emerson Shaw [SYNTHETIC]', email: 'emerson.s@synthetic.example', phone: '555-0119', channel: 'Referral', created_at: '2026-10-23T09:30:00Z', first_response_minutes: 14, followup_touches: 3, stage: 'converted', collected_amount: 1320, marketing_consent: true, opted_out: false, coordinator: 'Front Desk DAL', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-120', org_id: 'org-lumina-demo', external_id: 'SYN-LD-120', location_id: 'loc-den', contact_name: 'Finley Porter [SYNTHETIC]', email: 'finley.p@synthetic.example', phone: '555-0120', channel: 'Web Form', created_at: '2026-11-02T20:10:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 980, marketing_consent: true, opted_out: false, coordinator: 'Front Desk DEN', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-121', org_id: 'org-lumina-demo', external_id: 'SYN-LD-121', location_id: 'loc-den', contact_name: 'Rowan Bell [SYNTHETIC]', email: 'rowan.b@synthetic.example', phone: '555-0121', channel: 'Google Search', created_at: '2026-10-26T13:15:00Z', first_response_minutes: 22, followup_touches: 3, stage: 'consultation_booked', estimated_value: 1150, marketing_consent: true, opted_out: false, coordinator: 'Front Desk DEN', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-122', org_id: 'org-lumina-demo', external_id: 'SYN-LD-122', location_id: 'loc-pln', contact_name: 'Hayden West [SYNTHETIC]', email: 'hayden.w@synthetic.example', phone: '555-0122', channel: 'Meta Lead Form', created_at: '2026-10-30T11:50:00Z', first_response_minutes: 210, followup_touches: 1, stage: 'consultation_attended', estimated_value: 1250, marketing_consent: true, opted_out: false, coordinator: 'Front Desk PLN', is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'ld-123', org_id: 'org-lumina-demo', external_id: 'SYN-LD-123', location_id: 'loc-pln', contact_name: 'Tatum Gray [SYNTHETIC]', email: 'tatum.g@synthetic.example', phone: '555-0123', channel: 'Google Local', created_at: '2026-10-21T14:00:00Z', first_response_minutes: 15, followup_touches: 4, stage: 'converted', collected_amount: 1090, marketing_consent: true, opted_out: false, coordinator: 'Front Desk PLN', is_synthetic: true, data_source: 'synthetic_seed' },

    // Tenant B isolated lead
    { id: 'ld-rad-1', org_id: 'org-radiance-isolated', external_id: 'RAD-1', location_id: 'loc-rad-1', contact_name: 'Confidential Tenant B Lead', email: 'vip@radiance.example', phone: '555-9999', channel: 'Web', created_at: '2026-11-03T10:00:00Z', first_response_minutes: null, followup_touches: 0, stage: 'new', estimated_value: 2200, marketing_consent: true, opted_out: false, coordinator: 'MIA', is_synthetic: true, data_source: 'synthetic_seed' }
  ];

  // Non-clinical operational customer visit & spend records (Zero medical/charting info)
  const customers = [
    { id: 'cu-201', org_id: 'org-lumina-demo', external_id: 'SYN-CU-201', location_id: 'loc-hou', customer_name: 'Claire Bennett [SYNTHETIC]', email: 'claire.b@synthetic.example', phone: '555-0201', visit_count: 4, last_visit_date: '2026-05-14', lifetime_spend: 2640, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-202', org_id: 'org-lumina-demo', external_id: 'SYN-CU-202', location_id: 'loc-hou', customer_name: 'Natalie Pierce [SYNTHETIC]', email: 'natalie.p@synthetic.example', phone: '555-0202', visit_count: 1, last_visit_date: '2026-06-02', lifetime_spend: 365, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-203', org_id: 'org-lumina-demo', external_id: 'SYN-CU-203', location_id: 'loc-bld', customer_name: 'Hannah Brooks [SYNTHETIC]', email: 'hannah.b@synthetic.example', phone: '555-0203', visit_count: 3, last_visit_date: '2026-05-29', lifetime_spend: 1890, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-204', org_id: 'org-lumina-demo', external_id: 'SYN-CU-204', location_id: 'loc-bld', customer_name: 'Lauren Kim [SYNTHETIC]', email: 'lauren.k@synthetic.example', phone: '555-0204', visit_count: 1, last_visit_date: '2026-06-18', lifetime_spend: 350, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-205', org_id: 'org-lumina-demo', external_id: 'SYN-CU-205', location_id: 'loc-nsh', customer_name: 'Madison Ward [SYNTHETIC]', email: 'madison.w@synthetic.example', phone: '555-0205', visit_count: 5, last_visit_date: '2026-04-22', lifetime_spend: 3420, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-206', org_id: 'org-lumina-demo', external_id: 'SYN-CU-206', location_id: 'loc-den', customer_name: 'Olivia Hart [SYNTHETIC]', email: 'olivia.h@synthetic.example', phone: '555-0206', visit_count: 3, last_visit_date: '2026-06-10', lifetime_spend: 1740, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-207', org_id: 'org-lumina-demo', external_id: 'SYN-CU-207', location_id: 'loc-dal', customer_name: 'Sophia Reyes [SYNTHETIC]', email: 'sophia.r@synthetic.example', phone: '555-0207', visit_count: 4, last_visit_date: '2026-09-28', lifetime_spend: 2480, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-208', org_id: 'org-lumina-demo', external_id: 'SYN-CU-208', location_id: 'loc-pln', customer_name: 'Chloe Diaz [SYNTHETIC]', email: 'chloe.d@synthetic.example', phone: '555-0208', visit_count: 3, last_visit_date: '2026-10-04', lifetime_spend: 1620, is_member: false, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-209', org_id: 'org-lumina-demo', external_id: 'SYN-CU-209', location_id: 'loc-aus', customer_name: 'Grace Patel [SYNTHETIC]', email: 'grace.p@synthetic.example', phone: '555-0209', visit_count: 7, last_visit_date: '2026-10-18', lifetime_spend: 4890, is_member: true, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' },
    { id: 'cu-210', org_id: 'org-lumina-demo', external_id: 'SYN-CU-210', location_id: 'loc-sct', customer_name: 'Victoria Park [SYNTHETIC]', email: 'victoria.p@synthetic.example', phone: '555-0210', visit_count: 8, last_visit_date: '2026-10-22', lifetime_spend: 5620, is_member: true, marketing_consent: true, opted_out: false, is_synthetic: true, data_source: 'synthetic_seed' }
  ];

  const memberships = [
    { id: 'mem-aus', org_id: 'org-lumina-demo', location_id: 'loc-aus', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 248, new_enrollments_30d: 24, cancellations_30d: 6, eligible_non_members: 95, is_synthetic: true },
    { id: 'mem-sct', org_id: 'org-lumina-demo', location_id: 'loc-sct', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 272, new_enrollments_30d: 29, cancellations_30d: 7, eligible_non_members: 88, is_synthetic: true },
    { id: 'mem-dal', org_id: 'org-lumina-demo', location_id: 'loc-dal', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 184, new_enrollments_30d: 15, cancellations_30d: 8, eligible_non_members: 132, is_synthetic: true },
    { id: 'mem-den', org_id: 'org-lumina-demo', location_id: 'loc-den', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 162, new_enrollments_30d: 14, cancellations_30d: 7, eligible_non_members: 140, is_synthetic: true },
    { id: 'mem-pln', org_id: 'org-lumina-demo', location_id: 'loc-pln', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 138, new_enrollments_30d: 11, cancellations_30d: 6, eligible_non_members: 154, is_synthetic: true },
    { id: 'mem-hou', org_id: 'org-lumina-demo', location_id: 'loc-hou', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 92, new_enrollments_30d: 6, cancellations_30d: 14, eligible_non_members: 235, is_synthetic: true },
    { id: 'mem-bld', org_id: 'org-lumina-demo', location_id: 'loc-bld', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 68, new_enrollments_30d: 4, cancellations_30d: 9, eligible_non_members: 178, is_synthetic: true },
    { id: 'mem-nsh', org_id: 'org-lumina-demo', location_id: 'loc-nsh', plan_name: 'Lumina Glow Bank ($199/mo)', monthly_price: 199, active_members: 74, new_enrollments_30d: 5, cancellations_30d: 11, eligible_non_members: 192, is_synthetic: true }
  ];

  // Pre-seeded workflow tasks showing distinct ROI lifecycle stages (never conflated!)
  const workflow_tasks = [
    {
      id: 'wf-301',
      org_id: 'org-lumina-demo',
      location_id: 'loc-hou',
      category: 'lead_recovery',
      title: 'Uncontacted Inquiry Recovery: Jordan Avery [SYNTHETIC]',
      target_record_id: 'ld-101',
      recipient_name: 'Jordan Avery',
      marketing_consent: true,
      opted_out: false,
      owner_name: 'Marcus Sterling',
      approval_status: 'pending_approval',
      lifecycle_stage: 'estimated',
      estimated_value: 850,
      collected_revenue: 0,
      receipt_reference: null,
      draft_message: 'Hi Jordan, thank you for reaching out to Houston River Oaks. Our concierge wanted to make sure your consultation request was taken care of—we have two consultation windows open Thursday afternoon if you would like to reserve one. Reply STOP anytime to opt out.',
      created_at: '2026-11-04T09:00:00Z',
      updated_at: '2026-11-04T09:00:00Z',
      is_synthetic: true
    },
    {
      id: 'wf-302',
      org_id: 'org-lumina-demo',
      location_id: 'loc-bld',
      category: 'retention_reactivation',
      title: '159-Day Inactive Guest Check-In: Hannah Brooks [SYNTHETIC]',
      target_record_id: 'cu-203',
      recipient_name: 'Hannah Brooks',
      marketing_consent: true,
      opted_out: false,
      owner_name: 'Marcus Sterling',
      approval_status: 'approved',
      approved_by: 'Elena Vance (CEO · Demo)',
      approved_at: '2026-10-28T14:20:00Z',
      action_initiated_at: '2026-10-28T14:25:00Z',
      lifecycle_stage: 'appointment_booked',
      estimated_value: 630,
      collected_revenue: 0,
      receipt_reference: null,
      draft_message: 'Hi Hannah, it has been a few months since we last welcomed you at Boulder Pearl Street. Let us know if you would like priority scheduling for your next visit! Reply STOP anytime to opt out.',
      created_at: '2026-10-28T10:00:00Z',
      updated_at: '2026-10-30T11:15:00Z',
      is_synthetic: true
    },
    {
      id: 'wf-303',
      org_id: 'org-lumina-demo',
      location_id: 'loc-dal',
      category: 'membership_opportunity',
      title: '4-Visit Non-Member Invite: Rachel Kim [SYNTHETIC VERIFIED PILOT CLOSE]',
      target_record_id: 'cu-207',
      recipient_name: 'Sophia Reyes',
      marketing_consent: true,
      opted_out: false,
      owner_name: 'Concierge DAL',
      approval_status: 'approved',
      approved_by: 'Marcus Sterling (VP Ops · Demo)',
      approved_at: '2026-10-19T11:00:00Z',
      action_initiated_at: '2026-10-19T11:05:00Z',
      lifecycle_stage: 'revenue_collected',
      estimated_value: 1194,
      collected_revenue: 785,
      receipt_reference: 'SYN-POS-RCPT-88412 (Verified 2026-10-24 Within 30d Window)',
      draft_message: 'Hi Sophia, since you have visited Dallas Knox-Henderson 4 times, you qualify for banked credits and member savings under our Lumina Glow Bank. Happy to review at checkout! Reply STOP to opt out.',
      created_at: '2026-10-19T09:30:00Z',
      updated_at: '2026-10-24T16:40:00Z',
      is_synthetic: true
    },
    {
      id: 'wf-304',
      org_id: 'org-lumina-demo',
      location_id: 'loc-den',
      category: 'lead_recovery',
      title: 'Recovered Missed Weekend Inquiry: Taylor Brooks [SYNTHETIC VERIFIED CLOSE]',
      target_record_id: 'ld-121',
      recipient_name: 'Rowan Bell',
      marketing_consent: true,
      opted_out: false,
      owner_name: 'Concierge DEN',
      approval_status: 'approved',
      approved_by: 'Elena Vance (CEO · Demo)',
      approved_at: '2026-10-20T09:10:00Z',
      action_initiated_at: '2026-10-20T09:12:00Z',
      lifecycle_stage: 'revenue_collected',
      estimated_value: 1150,
      collected_revenue: 1340,
      receipt_reference: 'SYN-POS-RCPT-88904 (Verified 2026-10-29 Within 30d Window)',
      draft_message: 'Hi Rowan, following up on your Denver Cherry Creek consultation request—we just had a 2:30 PM Thursday slot open up if you would like it. Reply STOP to opt out.',
      created_at: '2026-10-20T08:45:00Z',
      updated_at: '2026-10-29T17:20:00Z',
      is_synthetic: true
    }
  ];

  // Weekly performance series for Executive Command Center (Synthetic Demo Series)
  const weekly_trends = [
    { week: '2026-W40', org_id: 'org-lumina-demo', leads: 112, pct_under_15m: 31, consult_booked_pct: 32, membership_enrollments: 68, verified_recovered_usd: 0 },
    { week: '2026-W41', org_id: 'org-lumina-demo', leads: 119, pct_under_15m: 38, consult_booked_pct: 35, membership_enrollments: 76, verified_recovered_usd: 640 },
    { week: '2026-W42', org_id: 'org-lumina-demo', leads: 124, pct_under_15m: 46, consult_booked_pct: 39, membership_enrollments: 89, verified_recovered_usd: 1120 },
    { week: '2026-W43', org_id: 'org-lumina-demo', leads: 128, pct_under_15m: 54, consult_booked_pct: 42, membership_enrollments: 98, verified_recovered_usd: 1485 },
    { week: '2026-W44', org_id: 'org-lumina-demo', leads: 134, pct_under_15m: 61, consult_booked_pct: 45, membership_enrollments: 108, verified_recovered_usd: 2125 }
  ];

  // Integration catalog — 100% honest status (CSV Live; APIs documented as Planned/Adapter Interface)
  const integrations = [
    {
      id: 'int-csv',
      platform: 'Universal CSV / Excel Export Engine',
      status: 'LIVE_IMPLEMENTED',
      auth_method: 'Authenticated Session (Owner / Operator Role)',
      available_data: 'Leads/Inquiries, Non-Clinical Customer Visit/Spend Summaries, Location Membership Ledgers',
      api_cost: '$0 (Works immediately with exports from any POS/CRM)',
      limitations: 'Batch upload rather than real-time webhook until native API credentials are connected; actively blocks clinical/PHI columns.',
      sync_method: 'Two-step Validated Preview -> Deduplicated Commit + Import History Log'
    },
    {
      id: 'int-boulevard',
      platform: 'Boulevard (Aesthetics Enterprise)',
      status: 'INTERFACE_DOCUMENTED_NOT_CONNECTED',
      auth_method: 'Boulevard Admin API Basic/OAuth Key + Webhook HMAC Secret (Requires Boulevard Enterprise Plan)',
      available_data: 'Appointments, Client Profiles (non-clinical), Memberships, Locations, Staff Schedules',
      api_cost: 'Boulevard Enterprise custom quote required for full Admin API access (base plans $328–$468/mo/location)',
      limitations: 'Standard Essentials/Premier plans restrict Admin API; use CSV Export bridge during Phase 1 Pilot.',
      sync_method: 'Planned: Webhook events (appointment.created, membership.updated) + nightly cursor backfill'
    },
    {
      id: 'int-zenoti',
      platform: 'Zenoti',
      status: 'INTERFACE_DOCUMENTED_NOT_CONNECTED',
      auth_method: 'Zenoti API Key + OAuth Bearer Token per Center ID',
      available_data: 'Centers, Guests, Appointments, Invoices/Collections, Memberships, Opportunity Leads',
      api_cost: 'Included or add-on under Zenoti Enterprise quote ($300–$600+/mo/location)',
      limitations: 'Rate-limited per center; requires Center Admin API scope excluding EMR clinical charting endpoints.',
      sync_method: 'Planned: Polling incremental updated_at window + webhook listener'
    },
    {
      id: 'int-aesthetic-record',
      platform: 'Aesthetic Record',
      status: 'INTERFACE_DOCUMENTED_NOT_CONNECTED',
      auth_method: 'Accelerator/Enterprise CRM Integration / Authorized CSV Business Intelligence Reports',
      available_data: 'Appointment conversion exports, patient visit recency, membership & package balances',
      api_cost: 'Accelerator ($19/user/mo) or Enterprise custom tier',
      limitations: 'Must strictly exclude clinical charting/photo endpoints; ingest only non-clinical business/KPI CSV exports.',
      sync_method: 'CSV Export Adapter Live Today'
    },
    {
      id: 'int-hubspot',
      platform: 'HubSpot CRM',
      status: 'INTERFACE_DOCUMENTED_NOT_CONNECTED',
      auth_method: 'HubSpot Private App Access Token (crm.objects.contacts.read, crm.objects.deals.read)',
      available_data: 'Inbound paid-ad leads, first-response timestamps, lifecycle stages, owner assignment',
      api_cost: 'Free / Starter HubSpot API access included within rate limits',
      limitations: 'Does not hold completed POS checkout receipts unless synced back from clinic POS.',
      sync_method: 'Planned: REST v3 Search incremental sync'
    }
  ];

  // REAL PUBLICLY VERIFIED MULTI-LOCATION AESTHETICS PROSPECTS (Verified 2026-11-05)
  // Zero fabricated names, zero fabricated metrics.
  const prospects = [
    {
      id: 'pr-pmp',
      company_name: 'Princeton Medspa Partners (PMP)',
      website: 'https://princetonmedspapartners.com',
      approx_locations: 11,
      footprint: 'CO (Fort Collins & Loveland via Allura Skin), KS, NY, ND, AL (HQ: Princeton, NJ)',
      public_leadership: 'Matt Slaine (CEO, appointed Jun 2025; ex-60-studio Orangetheory operator), Gary A. Bufalo, Jr. (COO), James A. Waskovich (Chairman)',
      tech_and_ops_signals: 'PE-backed roll-up (Princeton Equity Group + $120M BC Partners growth financing) acquiring founder-led clinics operating disparate legacy POS/booking stacks.',
      expansion_signals: 'Acquired Allura Skin, Laser & Wellness Clinics (2 Northern Denver/CO locations) announced Dec 2025; active 2026 suburban tuck-in pipeline.',
      hiring_signals: 'Corporate operational integration & clinic practice management roles across acquired partner sites.',
      buying_triggers: 'New CEO with multi-unit fitness membership DNA + Colorado tuck-in acquisition needing cross-clinic lead response & membership standardization.',
      source_urls: [
        'https://princetonmedspapartners.com/',
        'https://finance.yahoo.com/news/princeton-medspa-partners-pmp-expands-211400861.html'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 96,
      recommended_angle: 'Local Colorado angle (Allura Fort Collins/Loveland integration) + cross-brand visibility layer on top of acquired clinic POS exports without ripping out clinic software.'
    },
    {
      id: 'pr-alchemy-upkeep',
      company_name: 'Alchemy 43 + Upkeep MedSpa Platform',
      website: 'https://alchemy43.com',
      approx_locations: 16,
      footprint: 'NY, TX, CA & major US metros (16 combined clinics across Alchemy 43 & Upkeep MedSpa)',
      public_leadership: 'Shane Smith (CEO, appointed Apr 2026; founder of Upkeep MedSpa), Lori Wachs (Managing Partner, Penultima Capital)',
      tech_and_ops_signals: 'Operating two distinct consumer aesthetics brands under unified leadership; public mandate on revenue per chair & clinic-level margins.',
      expansion_signals: 'Apr 2026 CEO appointment explicitly focused on clinic-level productivity, standardized clinic operations, and scalable multi-location management.',
      hiring_signals: 'Studio leadership & aesthetic provider roles across TX and NY markets.',
      buying_triggers: 'Brand-new CEO (Apr 2026) publicly tasked by Penultima Capital with standardizing multi-brand clinic conversion and utilization.',
      source_urls: [
        'https://www.freep.com/press-release/story/176298/alchemy-43-appoints-shane-smith-as-ceo-to-drive-operational-performance-and-scalable-growth/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 95,
      recommended_angle: 'Cross-brand Executive Command Center comparing Alchemy 43 and Upkeep studios on speed-to-lead, single-visit return gap, and membership conversion.'
    },
    {
      id: 'pr-md-esthetics',
      company_name: 'MD Esthetics (New Harbor Capital Platform)',
      website: 'https://mdesthetics.com',
      approx_locations: 35,
      footprint: 'MA, NH, VA, PA, VT (Northeast & Mid-Atlantic)',
      public_leadership: 'New Harbor Capital Healthcare Portfolio Leadership (formed May 2025 via Skytale Group advisory)',
      tech_and_ops_signals: 'Tripled from 12 to 35 locations in H1 2026 through 4 rapid add-on acquisitions.',
      expansion_signals: '4 add-on acquisitions in H1 2026 entering Pennsylvania and Vermont.',
      hiring_signals: 'Multi-site integration, regional operations, and front-desk patient coordinator hiring.',
      buying_triggers: 'Jumping 12 -> 35 clinics in 6 months guarantees fragmented CRM/POS exports and uneven inquiry-to-consultation conversion across newly acquired clinics.',
      source_urls: [
        'https://www.privsource.com/acquisitions/activity/add-on/healthcare-services/2026',
        'https://ctacquisitions.com/prepare-your-business-for-sale/medical-spa-exit/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 93,
      recommended_angle: 'Zero-disruption Day-1 post-merger CSV/export intelligence layer to benchmark newly acquired PA/VT clinics against legacy MA/NH clinics.'
    },
    {
      id: 'pr-aviva',
      company_name: 'Aviva Aesthetics',
      website: 'https://avivaaesthetics.com',
      approx_locations: 20,
      footprint: 'MD, TX, AZ, IL, OH (HQ: Chicago, IL)',
      public_leadership: 'DuneGlass Capital Independent Sponsor Platform (anchored with Pura Vida Medspa)',
      tech_and_ops_signals: 'Partner-led MSO model where individual partner clinics retain brand identity while sharing central business intelligence.',
      expansion_signals: '2026 expansion into Texas, Arizona, Illinois, and Ohio reaching 20 partner locations.',
      hiring_signals: 'Partner clinic coordinators and central growth operations.',
      buying_triggers: 'Multi-brand partner MSOs struggle most with unified non-clinical funnel & membership benchmarking across autonomous partner brands.',
      source_urls: [
        'https://prospyrmed.com/blog/post/med-spa-private-equity-platforms'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 91,
      recommended_angle: 'Unified partner benchmark scorecard showing each partner clinic where uncontacted leads and inactive repeat guests sit without forcing an EMR migration.'
    },
    {
      id: 'pr-orangetwist',
      company_name: 'OrangeTwist',
      website: 'https://orangetwist.com',
      approx_locations: 24,
      footprint: '24 medspas across 6 states (CA, TX, WA, NV, etc.)',
      public_leadership: 'Backed by Hildred Capital, Athyrium Capital Management & SBC Medical Group (Jan 2026 minority investment)',
      tech_and_ops_signals: 'High-volume treatment & membership model across 24 retail-style centers.',
      expansion_signals: 'Jan 2026 strategic minority investment from SBC Medical Group supporting next-stage operational performance.',
      hiring_signals: 'Center managers & aesthetic sales/consultation specialists.',
      buying_triggers: 'Institutional investor reporting rigor + high-ticket consultation & membership retention focus across 24 centers.',
      source_urls: [
        'https://ctacquisitions.com/prepare-your-business-for-sale/medical-spa-exit/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 89,
      recommended_angle: 'Consultation-attended-to-converted leakage recovery and 120-day inactive guest reactivation across 24 centers.'
    },
    {
      id: 'pr-alpha',
      company_name: 'Alpha Aesthetics Partners',
      website: 'https://alphaaestheticspartners.com',
      approx_locations: 35,
      footprint: '12 states including CO, CA, MA, NY, VA, NC, OH, FL, NM, DE, KY',
      public_leadership: 'Thurston Group PE Platform Leadership',
      tech_and_ops_signals: 'Multi-brand partner network with Colorado footprint.',
      expansion_signals: 'Closed $93M financing in January 2026 to refinance and fund new clinic acquisitions.',
      hiring_signals: 'Clinic directors, patient concierges, and regional ops support.',
      buying_triggers: 'Fresh $93M Jan 2026 facility creates immediate board pressure for organic same-store EBITDA lift via membership & retention.',
      source_urls: [
        'https://ctacquisitions.com/prepare-your-business-for-sale/medical-spa-exit/',
        'https://prospyrmed.com/blog/post/med-spa-private-equity-platforms'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 88,
      recommended_angle: '3-clinic Colorado regional proof-of-value pilot proving verified repeat-visit & membership revenue before network-wide deployment.'
    },
    {
      id: 'pr-peachy',
      company_name: 'Peachy Studio',
      website: 'https://peachystudio.com',
      approx_locations: 15,
      footprint: '15+ studios across NYC, Chicago, Washington DC, Atlanta, and Austin',
      public_leadership: 'Tech-forward venture-backed leadership team (NYC HQ)',
      tech_and_ops_signals: 'Modern digital booking funnel, transparent flat-rate preventative aesthetics positioning.',
      expansion_signals: 'Scaled past 15 urban studios across 5 major metros.',
      hiring_signals: 'Studio operations leads and patient experience associates.',
      buying_triggers: 'High paid-digital lead volume across 5 metros where sub-15-minute inquiry conversion and 90–120 day repeat cadence drive unit economics.',
      source_urls: [
        'https://colorlib.com/wp/med-spa-website-examples/'
      ],
      date_verified: '2026-11-05',
      confidence: 'MEDIUM-HIGH',
      fit_score: 86,
      recommended_angle: 'Cohort retention & 105-day repeat-visit velocity analytics across NYC/CHI/ATX/ATL/DC.'
    },
    {
      id: 'pr-chapter',
      company_name: 'Chapter Aesthetic Studio',
      website: 'https://mychapter.com',
      approx_locations: 22,
      footprint: '22+ studios across NY (Rochester, Syracuse, Buffalo/Orchard Park, Tonawanda), ND, MN, IA, CT',
      public_leadership: 'Backed by The Aspen Group (TAG / Leonard Green + Ares parent ecosystem)',
      tech_and_ops_signals: 'Structured membership ("Chapter Membership") + free skin assessment consultation funnel.',
      expansion_signals: '22+ studios operating standardized retail-medical aesthetic format.',
      hiring_signals: 'Studio managers and aesthetic advisors (commission/consult conversion roles).',
      buying_triggers: 'Heavy reliance on free assessment -> paid package/membership conversion across regional studios.',
      source_urls: [
        'https://tryglassskin.com/blog/i-checked-chapter-aesthetic-studio-near-me-may-2026',
        'https://ctacquisitions.com/prepare-your-business-for-sale/medical-spa-exit/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 84,
      recommended_angle: 'Free-assessment-to-membership conversion gap intelligence across regional studios.'
    },
    {
      id: 'pr-beautyfix',
      company_name: 'BeautyFix MedSpa',
      website: 'https://www.beautyfixmedspa.com',
      approx_locations: 6,
      footprint: '6 locations across Manhattan, Westchester (NY), West Hartford (CT), and Miami (FL)',
      public_leadership: 'Mark Greenspan (CEO), Maya Benayoun (Co-CEO), Adam Litman (CFO / SVP Operations), Pranjali Galgali (VP Marketing)',
      tech_and_ops_signals: 'E-commerce-style treatment catalog + early adopter of digital consultation simulation tech.',
      expansion_signals: '6 high-volume East Coast + Miami clinics; active marketing & clinic coordinator roles.',
      hiring_signals: 'Marketing leadership & Patient Care Coordinators.',
      buying_triggers: 'Ideal 6-location founder/exec-accessible group where CFO/SVP Ops (Adam Litman) and VP Marketing directly own lead-to-consult ROI.',
      source_urls: [
        'https://colorlib.com/wp/med-spa-website-examples/',
        'https://www.americanmedspa.org/news/beautyfix-medspa-launches-first-ever-medically-accurate-aesthetics-simulation-from-entitymed/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 90,
      recommended_angle: 'Fast $6,500 6-studio pilot connecting e-commerce/paid-social inquiries to verified attended consultations and repeat bookings.'
    },
    {
      id: 'pr-skinspirit',
      company_name: 'SkinSpirit',
      website: 'https://www.skinspirit.com',
      approx_locations: 65,
      footprint: '65+ clinics across CA, NY, AZ, TX, UT, WA, OR, CO (Denver), NJ + 6 Nordstrom in-store clinics',
      public_leadership: 'Lynn Heublein (CEO & Co-Founder), Ann Frossard (COO/CPO), Sarah Osmer (CMO)',
      tech_and_ops_signals: 'KKR + GreyLion backed national leader; opened 60th clinic Dec 2025 and Nordstrom NorthPark Dallas Aug 2026.',
      expansion_signals: '65+ clinics + Nordstrom retail clinic channel (announced Nov 2, 2026 Fortune Best Workplaces).',
      hiring_signals: 'Regional operations directors and clinic managers across 65+ sites.',
      buying_triggers: 'Enterprise expansion tier (approach after winning 1–2 mid-sized 6–20 clinic case studies).',
      source_urls: [
        'https://everything-pr.com/skinspirit-fortune-best-workplaces',
        'https://www.americanmedspa.org/news/skinspirit-opened-its-60th-location-at-the-close-of-2025/'
      ],
      date_verified: '2026-11-05',
      confidence: 'HIGH',
      fit_score: 79,
      recommended_angle: 'Phase-2 Enterprise target: Nordstrom retail-clinic vs. standalone clinic lead-conversion & repeat-visit intelligence.'
    }
  ];

  return {
    organizations,
    users,
    locations,
    leads,
    customers,
    memberships,
    workflow_tasks,
    weekly_trends,
    integrations,
    prospects,
    csv_imports: [
      {
        id: 'imp-seed-01',
        org_id: 'org-lumina-demo',
        entity_type: 'leads',
        filename: 'synthetic_q4_clinic_inquiries.csv',
        imported_by: 'System Seed [SYNTHETIC DEMO]',
        total_rows: 23,
        committed_rows: 23,
        duplicate_rows: 0,
        invalid_rows: 0,
        created_at: '2026-11-01T08:00:00Z'
      }
    ],
    audit_logs: [
      {
        id: 'aud-seed-1',
        org_id: 'org-lumina-demo',
        actor_email: 'system@aros.local',
        actor_role: 'system',
        action: 'SEED_INITIALIZED',
        metadata: { synthetic_demo: true, locations: 8 },
        created_at: '2026-11-01T08:00:00Z'
      }
    ]
  };
}
