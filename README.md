# Aesthetic Revenue OS

**Multi-Location Revenue Operations, Recovery & Provable Attribution Platform for 5–50+ Studio Aesthetics Groups**

Built on a zero-bloat Node.js 22 + Vercel + Supabase PostgreSQL architecture (`$0` initial operating cost). Connects non-clinical POS/CRM exports in 48 hours, identifies studio-level revenue leaks across lead response, consultation conversion, repeat-visit retention, and memberships, enforces human-approved follow-up, and strictly separates raw pipeline from POS-receipt-verified collected revenue.

---

## Quick Start & Automated Verification

```bash
# Start platform locally (binds 0.0.0.0:3000)
npm start

# Run automated security, tenant-isolation, RBAC, CSV & ROI test suite
npm test
```

## Synthetic Demo Personas (Pre-Seeded & Clearly Labeled)
Use the top-right **Demo Persona** selector in the UI, or sign in via `/api/auth/login`:
- **Owner / CEO (`org-lumina-demo` — 8 Studios):** `ceo@lumina-demo.example` / `DemoOwner2026!`
- **VP Ops / Operator (`org-lumina-demo`):** `revops@lumina-demo.example` / `DemoOps2026!`
- **Read-Only Analyst (`viewer` RBAC check):** `cfo-readonly@lumina-demo.example` / `DemoViewer2026!`
- **Isolated Tenant B (`org-radiance-isolated`):** `owner@radiance-demo.example` / `TenantTwo2026!`

## Repository Structure
- `server.js` & `api/index.js` — Local HTTP server (`0.0.0.0:3000`) & Vercel Serverless entrypoint
- `src/security.js` — `scrypt` password hashing, HMAC-SHA256 session tokens, RBAC matrix, PHI column blocker, audit scrubber
- `src/csvImporter.js` — Universal RFC-4180 CSV parser, auto-column mapper, duplicate & validation engine
- `src/engine.js` — Deterministic Modules A–F + 6-Stage Provable ROI Attribution Engine
- `src/llm.js` — Single-provider optional LLM abstraction with zero-cost deterministic fallback
- `src/seed.js` — Synthetic 8-location demo dataset + 10 real publicly verified US multi-location medspa prospects
- `supabase/schema.sql` — Production PostgreSQL schema with tenant-scoped Row-Level Security (`RLS`)
- `docs/` — Complete Audit & Architecture, Security & Compliance, Commercial Sales Kit, and Pilot Playbook
- `tests/platform.test.js` — End-to-end automated verification suite
