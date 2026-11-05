# Paid Pilot Delivery Checklist, Runbook & Operating Cost Model

## 1. Pre-Contract & Legal Gate (Do Not Skip)
- [ ] **Entity & Signatory Verification:** Ensure legal business entity (LLC/Corp), business bank/Stripe account, and adult/authorized legal review are in place before executing commercial contracts.
- [ ] **Compliance & Data Classification Check:** Confirm in writing with client counsel that Phase 1 Pilot exports contain **strictly non-clinical commercial fields** (External ID, Location Code, Inquiry Timestamp, Funnel Status, Visit Count, Last Visit Date, Total Spend, Membership Tier, Marketing Consent Flag, Opt-Out Flag) — **zero clinical notes, diagnoses, prescriptions, or treatment charts**.
- [ ] **Production Security Check:** Set unique 32-byte `SESSION_SECRET` in Vercel, connect dedicated Supabase PostgreSQL instance (`supabase/schema.sql`), enable Supabase RLS + daily backups, and disable synthetic demo personas in production.

## 2. 30-Day Paid Pilot Onboarding & Delivery Checklist
- [ ] **Day 1–2 (Kickoff & Baseline Export):** Collect 90-day historical CSV exports for Pilot Studios (3–5 locations). Run through Step 1 (`Validate & Preview CSV`) to confirm zero prohibited clinical columns and <2% malformed rows.
- [ ] **Day 3–4 (Baseline Lock):** Export and sign off on pre-pilot baseline metrics (`avg_response_minutes`, `inquiry_to_consult_rate`, `membership_penetration_rate`, `inactive_110d_count`).
- [ ] **Day 5–7 (Opportunity Inbox Review):** Walk COO / Regional Manager through top High-Confidence opportunities by studio; configure studio `operator` logins and `viewer` executive logins.
- [ ] **Weeks 2–4 (Weekly Operating Cadence — ~90 Mins/Week Operator Effort):**
  1. Import weekly incremental POS/CRM CSV export (10 mins).
  2. Review newly flagged uncontacted inquiries & 110+ day inactive eligible cohorts (15 mins).
  3. Studio coordinators approve queued messages inside Workflow Center & log booked consultations / POS receipt IDs (automated audit trail).
  4. Download & send the **6-Part Weekly Executive Report (`.md`/PDF)** every Monday morning (15 mins).
- [ ] **Day 30 (Executive Readout & Group Rollout Proposal):** Present the **6-Stage Provable ROI Waterfall**, highlighting exact POS-verified collected receipts vs. pilot fee, and propose network-wide expansion across all remaining locations.

## 3. Support & Incident Process
- **Support Tiering:** Business-hours Slack/email channel for studio operators (4-hour response SLA); critical data/access issues (1-hour response SLA).
- **Data Correction / Deletion Requests:** Execute tenant-scoped record deletion or full CSV purge (`POST /api/settings/purge-imported`) within 24 hours of written owner request and provide audit-log confirmation ID.

## 4. Honest Operating Cost Model (Under $100 Budget)

| Stage | Infrastructure Stack | Monthly Cost | Free-Tier Limits & Scale Triggers |
| :--- | :--- | :--- | :--- |
| **Stage 0: Build, Demo & Prospecting (Right Now)** | GitHub + Vercel Hobby + Local/Supabase Free + Deterministic Engine (`LLM_PROVIDER=none`) | **$0 / month** | Vercel Hobby is for non-commercial/demo preview (100 GB bandwidth, serverless execution limits). Supabase Free pauses after 7 days of inactivity and caps DB at 500 MB (max 2 free projects). |
| **Stage 1: Live Commercial prospecting (Optional Domain)** | Custom `.com` Domain + Workspace Mailbox | **~$12/yr domain + $7/mo mailbox (~$19 upfront)** | Well under your $100 budget; gives you `you@yourdomain.com` for executive credibility. |
| **Stage 2: First Paid Pilot ($5k–$8.5k Deposit Collected)** | Upgrade to **Vercel Pro ($20/mo)** + **Supabase Pro ($25/mo)** + Optional single LLM API key (~$2–$5/mo usage) | **~$47–$50 / month** | Funded **after** client deposit clears. Vercel Pro allows commercial production hosting; Supabase Pro removes pausing, raises DB to 8 GB, and enables daily backups. |
| **Stage 3: Healthcare / BAA Enterprise Scale** | Supabase Team + HIPAA Add-on + BAA, or AWS/GCP HIPAA BAA environment | **$599+ / month** | Only trigger when signing $30k–$75k+ enterprise contracts requiring formal HIPAA Business Associate Agreements. |
