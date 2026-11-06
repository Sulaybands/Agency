# Security, Privacy, RBAC & Compliance Documentation

## 1. Strict Non-Clinical & Healthcare Compliance Boundary
- **No Protected Health Information (PHI) / No Clinical Records:** Aesthetic Revenue OS is engineered strictly for **non-clinical commercial and operational metrics** (inquiry timestamps, marketing channels, consultation funnel status, aggregate visit counts, visit recency dates, non-clinical spend totals, and membership counts).
- **Automated Clinical Column Blocker:** `src/security.js` (`detectProhibitedColumns`) and `src/csvImporter.js` inspect every CSV header prior to preview or storage and **hard-block** uploads containing clinical or sensitive identifiers (`diagnosis`, `icd10`, `clinical_notes`, `chart_note`, `medical_history`, `prescription`, `rx_lot`, `allergies`, `ssn`, `patient_chart`).
- **HIPAA Legal Caution:** Do **not** assume a medspa or aesthetics group is exempt from HIPAA. Many multi-location aesthetics groups operate under physician/NP/PA supervision (MSO-PC structures) or hybrid dermatology/plastic surgery entities that are HIPAA Covered Entities. **Before ingesting any real customer/patient-identifiable records in a commercial pilot, engage qualified healthcare legal counsel to determine HIPAA applicability, execute Business Associate Agreements (BAAs) with the client and infrastructure vendors (e.g., Supabase HIPAA tier + BAA, Vercel Enterprise/HIPAA or compliant hosting), or restrict pilot exports strictly to de-identified external IDs.**

## 2. Multi-Tenant Isolation & Role-Based Access Control (RBAC)
- **Application-Layer Isolation:** Every domain entity (`locations`, `leads`, `customers`, `memberships`, `workflow_tasks`, `csv_imports`, `audit_logs`) carries a mandatory `org_id`. `src/store.js` (`getTenantSlice`) and `src/router.js` scope every read and write exclusively to `session.org_id` extracted from the cryptographically signed session token—never from client-supplied query/body parameters.
- **Database-Layer Isolation:** `supabase/schema.sql` enforces PostgreSQL Row-Level Security (`RLS`) across all tables via `public.user_has_org_role(org_id, allowed_roles)`.
- **RBAC Permission Matrix (`src/security.js`):**

| Capability | `owner` | `operator` | `viewer` |
| :--- | :---: | :---: | :---: |
| View Executive Dashboard, Funnels, Locations & ROI | Yes | Yes | Yes |
| Queue Workflow Drafts & Update Outcome Stages | Yes | Yes | **Denied (403)** |
| Human-Approve Outbound Communications | Yes | Yes | **Denied (403)** |
| Preview & Commit CSV Data Imports | Yes | Yes | **Denied (403)** |
| Add Locations & Verified Prospects | Yes | Yes | **Denied (403)** |
| View Security Audit Logs | Yes | Yes | **Denied (403)** |
| Modify Org SLA/Attribution Rules & Purge Tenant Data | Yes | **Denied (403)** | **Denied (403)** |

## 3. Human-in-the-Loop & Messaging Safety Controls
- **Zero Autonomous External Actions:** The platform never automatically sends SMS/emails, modifies appointments, issues refunds, or overwrites POS records.
- **Consent & Opt-Out Gate:** Both Opportunity Detection (`src/engine.js`) and the Workflow Approval endpoint (`POST /api/workflows/:id/approve`) check `marketing_consent === true && opted_out === false`. Attempts to approve outreach for an opted-out contact return HTTP `400 Compliance Block`.

## 4. Secret Management, Audit Logging, Deletion & Recovery
- **Secrets:** Stored solely in environment variables (`SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`). `.gitignore` excludes `.env` and `.env.*` (except `.env.example`).
- **Sanitized Audit Logs:** `src/security.js` (`scrubAuditMetadata`) strips passwords, tokens, keys, emails, and phone numbers from audit metadata while recording logins, failed logins, RBAC denials, CSV blocks/commits, human approvals, receipt verifications, and data purges.
- **Data Deletion Procedure:** Owners can invoke `POST /api/settings/purge-imported` (UI: *Settings → Purge All Imported CSV Records*) to permanently remove imported tenant records and write a `TENANT_IMPORTED_DATA_PURGED` audit entry. In PostgreSQL (`supabase/schema.sql`), `ON DELETE CASCADE` on `organizations(id)` ensures complete tenant erasure upon contract termination.
- **Backup & Recovery:** In production on Supabase Pro, enable daily automated backups and Point-in-Time Recovery (PITR) with encrypted storage at rest (AES-256).

## 5. Honest Current Security Limitations (Pre-Production Checklist)
1. **Default Dev Secret:** `src/security.js` includes a fallback HMAC secret so the zero-config synthetic demo runs out of the box; **you must set a strong 32-byte random `SESSION_SECRET` in Vercel before external use.**
2. **Local File Persistence in Demo Mode:** Until Supabase Postgres credentials are connected, runtime changes write to gitignored `data/aros-runtime.json` (ephemeral on serverless cold starts).
3. **Rate Limiting & MFA:** Before onboarding live commercial tenants, enable Supabase Auth MFA (TOTP) and Vercel WAF / Upstash rate limiting on `/api/auth/login`.
