# Repository Audit, Product Strategy & System Architecture

## 1. Phase 1 Repository Audit (Pre-Upgrade State)
Before implementing **Aesthetic Revenue OS**, the existing repository (`Sulaybands/desktop-tutorial`, branch `arena/fe043c8b-desktop-tutorial`) was audited across all 10 criteria:

1. **Previously built:** Commit `cceb5b4` was a GitHub Desktop starter `README.md`. Uncommitted working files contained a single-tenant outbound agency demo (`Fieldline Systems`).
2. **Framework & runtime:** Zero-dependency Node.js 22 ESM HTTP server (`server.js`) + Vercel Serverless rewrite (`vercel.json`) + vanilla ES module SPA (`public/`).
3. **Working features:** Static SPA hosting on `0.0.0.0:3000`, `/api/leads` and `/api/events` JSON persistence.
4. **Incomplete/mocked relative to Aesthetic Revenue OS:** Lacked authentication, tenant isolation, RBAC, CSV import engine, multi-location aesthetics schema, deterministic opportunity engine, 6-stage provable ROI attribution, and verified medspa prospect database.
5. **Installed dependencies:** `0` external npm packages (`package.json`).
6. **Existing integrations:** Optional `fetch` calls to Supabase REST; no POS/CRM export parser.
7. **Database:** Local JSON file + two-table starter `supabase/schema.sql`.
8. **Deployment config:** `vercel.json` present.
9. **Security issues identified & remediated:**
   - **No authentication or RBAC** on `/api/*` → *Fixed:* Added `scrypt` password hashing, HMAC-SHA256 signed session tokens, and server-side RBAC enforcement (`owner`, `operator`, `viewer`).
   - **Permissive `using (true)` RLS policy** in `supabase/schema.sql` → *Fixed:* Replaced with `org_memberships` + `public.user_has_org_role(...)` tenant-isolated RLS policies.
   - **Permissive wildcard CORS & unvalidated inputs** → *Fixed:* Removed wildcard credential exposure, sanitized inputs, scrubbed audit metadata, and added a clinical/PHI column blocker on CSV imports.
10. **Reused vs. upgraded:** Reused the zero-dependency Node 22 ESM + Vercel serverless foundation (`server.js`, `vercel.json`, `public/`, `supabase/`) so operating cost remains **$0** during build/validation with zero npm supply-chain bloat.

---

## 2. Evaluation of Reference GitHub Repositories Provided
Per Section 6 ("Do not build a complicated multi-agent architecture just because it sounds impressive"), each linked repository was inspected via the GitHub API:
- **`affaan-m/ECC`** (Agent harness skills/security/research discipline): Adopted its research-first and security-verification discipline inside `CLAUDE.md` and `tests/platform.test.js`, without adding runtime overhead.
- **`Haseebi-khan/leadforge-sprint`** (Lead research → verified findings → scoring → human-reviewed outreach draft): Directly informed our **Section 10 Internal Prospecting Engine** (`GET/POST /api/prospects` + deterministic fit scoring + human-only outreach draft generation).
- **`NousResearch/hermes-agent`** & **`msitarzewski/agency-agents`**: Multi-persona agent frameworks. *Excluded from product runtime*—deterministic TypeScript/JavaScript math is faster, cheaper ($0), auditable, and hallucination-free for financial KPIs and ROI attribution.
- **`every-app/open-seo`** & **`firecrawl/firecrawl-mcp-server`**: Useful externally during manual prospect research, not embedded into the core SaaS runtime (Firecrawl requires paid API credits beyond free tier).

---

## 3. Market Landscape & Defensible Wedge (2026 Research)
- **Empirical Industry Pain:** The August 2026 American Med Spa Association / CorralData benchmark across **100+ aesthetics brands (~500 locations)** found median revenue grew **19.2% YoY** while new-patient growth was **1.2%**. Single-visit guests spent **$355** in H1 vs. **$1,681** for repeat guests; members spent **2.5x** non-members and retained **+35 percentage points** higher; and clinics answering inquiries in **<15 minutes** consistently landed in the top growth half vs. 4-hour to 24-day laggards.
- **Incumbent Landscape:**
  - **Boulevard** ($158–$468/mo per location) excels at luxury single-studio front-desk checkout, but cross-location conversion & attribution reporting are limited and Admin API access requires Enterprise custom pricing.
  - **Zenoti** (~$300–$600+/mo per location + $5k+ setup) handles large chains, yet operators report complex reporting consolidation, and PE roll-ups acquiring clinics on Aesthetic Record / Boulevard / PatientNow face immediate multi-system fragmentation.
  - **RepeatMD** (~$200–$799/mo per location) sells consumer membership apps, not cross-location operational lead-recovery or executive ROI attribution.
- **Our Wedge:** A **POS-agnostic Cross-Location Revenue Intelligence & Execution Layer** that onboards in 48 hours via **Universal Non-Clinical CSV Exports** first, requiring zero EMR migration and zero disruption to clinical staff.

---

## 4. Integration Technical Specifications (Honest Status)

| System | Current Status | Auth Requirements | Available Operational Data | API / Tier Cost | Limitations & Failure Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Universal CSV / Excel Importer** | **LIVE & TESTED** | Authenticated `owner` or `operator` session | Leads, Non-Clinical Customer Visit/Spend, Location Memberships | **$0** | Batch upload; actively rejects prohibited clinical/PHI columns; reports line-level errors & skips duplicates before commit. |
| **Boulevard** | Interface Documented (Not Connected) | Boulevard Admin API Key + Webhook HMAC Secret | Locations, Appointments, Non-Clinical Client Profiles, Memberships | Requires Boulevard Enterprise custom tier | Standard Essentials/Premier plans restrict Admin API; use CSV Export bridge during Paid Pilot. |
| **Zenoti** | Interface Documented (Not Connected) | API Key + OAuth Bearer Token per Center ID | Centers, Guests, Appointments, Collections, Memberships, Leads | Enterprise custom quote | Rate limits per center; must scope strictly to non-EMR operational endpoints with exponential backoff retry. |
| **Aesthetic Record** | Interface Documented (Not Connected) | Business Intelligence CSV Export / Accelerator Tier | Appointment funnel, visit recency, membership balances | $19/user/mo+ | Clinical charting platform—never connect charting/photo endpoints; ingest business KPI CSV exports only. |
| **Nextech** | Planned Enterprise Adapter | Nextech Partner OAuth2 API | Practice schedules, lead source conversion | Paid Partner API fee | High vendor partner gating; use scheduled CSV export for <30 location groups. |
| **HubSpot / Salesforce** | Interface Documented (Not Connected) | Private App Token (`contacts.read`, `deals.read`) / Connected App OAuth | Paid-ad lead arrival timestamps, first touch, stage | Included in standard CRM tiers | Lacks settled POS receipt IDs unless reconciled against clinic checkout export. |
| **Google Sheets** | Supported via `.csv` Export | File Download -> Universal CSV Importer | Lead trackers, manual call logs | **$0** | Schema drift across tabs caught by CSV column validator. |
