# CLAUDE.md — Aesthetic Revenue OS Engineering & Compliance Rules

## 1. Product Identity
**Aesthetic Revenue OS** is an enterprise multi-location revenue operations platform for 5–50+ location medspa and aesthetics groups. It is **not** a generic chatbot or marketing agency dashboard.

## 2. Non-Negotiable Architecture Rules
- **Deterministic Core First:** All KPI calculations, funnel conversion rates, inactivity segmentation, fit scoring, and 6-stage ROI attribution (`src/engine.js`) MUST remain 100% deterministic and auditable. Never delegate financial math to an LLM.
- **Provable ROI Separation:** Never conflate `identified_opportunity` or `estimated_opportunity` with `revenue_collected`. `revenue_collected` requires a human-approved `action_initiated_at` timestamp AND a verifiable `receipt_reference`.
- **Non-Clinical / Anti-PHI Guardrail:** Never ingest diagnoses, clinical notes, prescriptions, chart photos, or SSNs. `detectProhibitedColumns` in `src/security.js` must inspect every import path.
- **Human-in-the-Loop:** Never auto-send external emails/SMS or mutate external POS records without explicit human approval (`approve:communications` permission) and verified `marketing_consent && !opted_out`.
- **Tenant Isolation:** Every database query and API handler must filter by `session.org_id` from the signed session token—never trust client-supplied `org_id`.
- **Zero-Bloat Stack:** Node.js >=20 native modules (`node:http`, `node:crypto`, `node:test`), Vercel serverless compatibility (`api/index.js`), and PostgreSQL + RLS (`supabase/schema.sql`).
