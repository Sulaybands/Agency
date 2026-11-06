/**
 * Modular POS / CRM Integration Adapter Registry (Section 5)
 * Honest implementation status:
 * - Universal CSV / Excel Importer: LIVE & TESTED
 * - Google Sheets CSV Export Bridge: LIVE & TESTED via CSV Importer
 * - Boulevard, Zenoti, Aesthetic Record, Nextech, HubSpot, Salesforce:
 *   Standardized adapter interface + complete technical/auth/cost/failure specification.
 *   Never claims a live vendor API sync exists until tenant credentials are configured.
 */

const ADAPTER_SPECS = [
  {
    id: 'universal_csv',
    name: 'Universal POS / CRM CSV & Excel Export Importer',
    category: 'Universal File Ingestion',
    status: 'LIVE',
    is_live: true,
    required_env: [],
    auth_requirements: 'Authenticated Aesthetic Revenue OS session (`owner` or `operator` RBAC role).',
    available_data: 'Non-clinical Leads/Inquiries, Customer Visit Recency & Spend Totals, Location Membership Summaries.',
    required_permissions: 'import:csv',
    api_costs_and_tier: '$0 / Included across all POS & CRM exports.',
    data_limitations: 'Point-in-time batch snapshot; real-time webhook events require native POS API tier. Automatically hard-blocks clinical/PHI columns (`diagnosis`, `icd10`, `clinical_notes`, `prescription`, `ssn`).',
    sync_method: 'Two-step validated upload: RFC-4180 parse -> auto-column map & deduplicate preview -> human confirmation commit -> audit log.',
    failure_handling: 'Zero partial-corruption commits: malformed rows and duplicate external IDs/emails are isolated with line numbers before any database write occurs.'
  },
  {
    id: 'boulevard',
    name: 'Boulevard Practice Management',
    category: 'Medspa POS / Scheduling',
    status: 'ADAPTER_INTERFACE_READY',
    is_live: false,
    required_env: ['BOULEVARD_API_KEY', 'BOULEVARD_BUSINESS_ID', 'BOULEVARD_WEBHOOK_SECRET'],
    auth_requirements: 'HTTP Basic / HMAC Admin API Key + Business ID + signed Webhook secret.',
    available_data: 'Locations, Appointments (booked/attended/cancelled), Non-Clinical Client Profiles, Memberships, Gross Receipts.',
    required_permissions: 'Boulevard Admin API read scopes (`locations:read`, `appointments:read`, `clients:read`, `memberships:read`). Never request clinical chart/SOAP scopes.',
    api_costs_and_tier: 'Requires Boulevard Enterprise / Custom tier ($364–$520+/location/mo bundle or custom Admin API add-on; standard Premier plans restrict full Admin GraphQL access).',
    data_limitations: 'Top-of-funnel ad inquiries prior to booking often live in Meta/HubSpot rather than Boulevard; pair with CRM or Lead CSV export.',
    sync_method: 'Planned: Webhook listener (`appointment.created`, `appointment.completed`) + nightly GraphQL cursor reconciliation.',
    failure_handling: 'HMAC signature verification, idempotent event deduplication, and exponential backoff (1s, 4s, 16s) on HTTP 429/5xx.'
  },
  {
    id: 'zenoti',
    name: 'Zenoti Enterprise Medspa Cloud',
    category: 'Enterprise Medspa POS',
    status: 'ADAPTER_INTERFACE_READY',
    is_live: false,
    required_env: ['ZENOTI_API_URL', 'ZENOTI_API_KEY', 'ZENOTI_APPLICATION_ID'],
    auth_requirements: 'Zenoti API Key + OAuth2 Bearer Token scoped per Center ID.',
    available_data: 'Centers, Opportunities/Leads, Appointments, Guest Non-Clinical Ledger, Recurring Memberships, Collections/Invoice Receipts.',
    required_permissions: 'Read-only operational scopes (`v1/centers`, `v1/appointments`, `v1/invoices`, `v1/guests` non-EMR fields).',
    api_costs_and_tier: 'Custom Enterprise licensing (~$300–$650/location/mo + $5,000–$15,000 vendor onboarding; API rate quotas vary by tier).',
    data_limitations: 'Strict per-center rate limits (~60 req/min default) and complex historical invoice pagination across newly acquired centers.',
    sync_method: 'Planned: Per-center incremental watermark polling every 15 minutes + nightly invoice receipt reconciliation.',
    failure_handling: 'Per-center token refresh queue, `Retry-After` header compliance, and dead-letter audit logging per Center ID.'
  },
  {
    id: 'aesthetic_record',
    name: 'Aesthetic Record',
    category: 'Clinic Practice & BI Export',
    status: 'EXPORT_BRIDGE_SUPPORTED',
    is_live: false,
    required_env: ['AESTHETIC_RECORD_EXPORT_TOKEN'],
    auth_requirements: 'Business Intelligence CSV Export via `owner`/`admin` clinic role (no public self-serve REST API on base tiers).',
    available_data: 'Appointment status exports, patient visit counts/dates, non-clinical sales totals, membership status.',
    required_permissions: 'Business Reports export permission only — NEVER export clinical charting, photos, or lot/injection logs.',
    api_costs_and_tier: '$15–$19/user/mo base clinic plan; CSV export bridge requires $0 extra vendor fees.',
    data_limitations: 'Native multi-location rollup reporting breaks down past 5–8 clinics; exports must include `location_code` per clinic.',
    sync_method: 'Weekly or daily scheduled BI CSV export uploaded into Universal CSV Importer.',
    failure_handling: 'Anti-PHI column scanner automatically blocks accidental clinical report exports before preview.'
  },
  {
    id: 'nextech',
    name: 'Nextech Dermatology & Plastic Surgery',
    category: 'Specialty Practice Management',
    status: 'PLANNED_ENTERPRISE',
    is_live: false,
    required_env: ['NEXTECH_CLIENT_ID', 'NEXTECH_CLIENT_SECRET', 'NEXTECH_PRACTICE_ID'],
    auth_requirements: 'Nextech Partner OAuth 2.0 Client Credentials + Practice Tenant ID.',
    available_data: 'Cosmetic consultation schedules, referral/lead sources, non-clinical cosmetic fee-for-service receipts.',
    required_permissions: 'Operational scheduling & cosmetic billing summary scopes only (strictly exclude clinical EMR/HL7/FHIR medical charts unless HIPAA BAA + legal sign-off are completed).',
    api_costs_and_tier: 'Paid Nextech Partner API gateway fee; recommended only for 20+ location surgical/derm platforms.',
    data_limitations: 'Hybrid medical/cosmetic practices mix insurance visits with cash-pay aesthetics; requires cosmetic appointment-type filtering.',
    sync_method: 'Planned: Nightly cosmetic schedule & receipt delta sync; use non-clinical CSV export during pilot.',
    failure_handling: 'OAuth token auto-renewal + strict appointment-category allowlist filtering.'
  },
  {
    id: 'hubspot',
    name: 'HubSpot CRM',
    category: 'Lead & Marketing CRM',
    status: 'ADAPTER_INTERFACE_READY',
    is_live: false,
    required_env: ['HUBSPOT_PRIVATE_APP_TOKEN'],
    auth_requirements: 'HubSpot Private App Access Token (`pat-na1-...`).',
    available_data: 'Inbound web/Meta/Google leads, `createdate`, first-contact timestamps, lifecycle stage, marketing opt-in/opt-out status.',
    required_permissions: '`crm.objects.contacts.read`, `crm.objects.deals.read`, `communication_preferences.read`.',
    api_costs_and_tier: 'Included in HubSpot Free/Starter/Pro Private Apps ($0 extra API surcharge within 100 req/10s burst limit).',
    data_limitations: 'HubSpot tracks inquiry & speed-to-lead accurately, but lacks settled chairside POS receipt IDs unless reconciled with POS checkout exports.',
    sync_method: 'Planned: `/crm/v3/objects/contacts/search` incremental `lastmodifieddate` cursor sync.',
    failure_handling: '10-second sliding-window rate limiter + cursor checkpoint persistence.'
  },
  {
    id: 'salesforce',
    name: 'Salesforce Sales / Health Cloud (Non-Clinical CRM)',
    category: 'Enterprise CRM',
    status: 'PLANNED_ENTERPRISE',
    is_live: false,
    required_env: ['SFDC_INSTANCE_URL', 'SFDC_CLIENT_ID', 'SFDC_CLIENT_SECRET'],
    auth_requirements: 'Salesforce Connected App OAuth 2.0 JWT Bearer Flow.',
    available_data: 'Lead, CampaignMember, Opportunity, Task response timestamps across PE call-center pods.',
    required_permissions: 'Minimum-privilege Integration User profile (`API Enabled`, Read on `Lead`, `CampaignMember`, `Task`).',
    api_costs_and_tier: 'Requires Salesforce Enterprise Edition+ or API add-on (24-hour rolling API request governor limits).',
    data_limitations: 'Custom studio lookup fields vary per MSO; requires field-mapping config per deployment.',
    sync_method: 'Planned: SOQL `SystemModstamp` incremental delta poll or Bulk API 2.0.',
    failure_handling: '`Sforce-Limit-Info` governor header monitoring—auto-pauses background sync if tenant exceeds 80% daily API quota.'
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets Lead & Call Tracker Bridge',
    category: 'Spreadsheet Bridge',
    status: 'LIVE_VIA_CSV',
    is_live: true,
    required_env: [],
    auth_requirements: '`File -> Download -> Comma Separated Values (.csv)` uploaded via Universal CSV Importer (or future Service Account read scope).',
    available_data: 'Agency lead trackers, call-center speed-to-lead logs, studio membership counts.',
    required_permissions: '`import:csv` inside Aesthetic Revenue OS.',
    api_costs_and_tier: '$0.',
    data_limitations: 'Manual column renames by marketing agencies are caught by our column auto-mapper and row validator.',
    sync_method: 'Direct `.csv` upload with duplicate suppression.',
    failure_handling: 'Row-level validation preview blocks malformed dates, negative values, or unknown studio codes.'
  }
];

export function listIntegrationAdapters(env = process.env) {
  return ADAPTER_SPECS.map((spec) => {
    const missingEnv = spec.required_env.filter((k) => !env[k]);
    const credentialsConfigured = spec.required_env.length > 0 && missingEnv.length === 0;
    return {
      ...spec,
      credentials_configured: spec.is_live ? true : credentialsConfigured,
      missing_env_vars: missingEnv
    };
  });
}

export function checkIntegrationReadiness(adapterId, env = process.env) {
  const spec = ADAPTER_SPECS.find((a) => a.id === adapterId);
  if (!spec) {
    return { ok: false, status: 'unknown_adapter', error: `Unknown integration adapter: ${adapterId}` };
  }
  if (spec.is_live) {
    return {
      ok: true,
      adapter_id: spec.id,
      name: spec.name,
      connection_state: 'ready_live',
      message: `${spec.name} is active and ready for validated tenant imports ($0 external API cost).`
    };
  }
  const missingEnv = spec.required_env.filter((k) => !env[k]);
  if (missingEnv.length > 0) {
    return {
      ok: true,
      adapter_id: spec.id,
      name: spec.name,
      connection_state: 'missing_credentials',
      missing_env_vars: missingEnv,
      message: `Adapter interface defined, not live-connected. Missing vendor credentials: ${missingEnv.join(', ')}. Use the Universal CSV Importer until vendor API access is authorized.`
    };
  }
  return {
    ok: true,
    adapter_id: spec.id,
    name: spec.name,
    connection_state: 'credentials_present_sandbox_unverified',
    missing_env_vars: [],
    message: `Environment variables present for ${spec.name}; live external polling remains disabled until tenant BAA/authorization sign-off.`
  };
}
