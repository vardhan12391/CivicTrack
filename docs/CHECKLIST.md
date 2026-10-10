# CivicTrack — Implementation Checklist

Legend: `[x]` done & verified · `[~]` partial · `[ ]` not started
"Verified" means executed and observed — not merely written.

## Phase 0 — Inspection & planning
- [x] Inspect environment (Node 24, npm 11, local MongoDB running, git available)
- [x] Repository structure (`client/`, `server/`, `docs/`)
- [x] `.gitignore` and `.env.example`
- [x] Database model contract ([DATA-MODELS.md](DATA-MODELS.md))
- [x] API contract ([API.md](API.md))
- [x] Feature priority order (essential vs optional)

## Phase 1 — Foundation & UI
- [x] React + Vite app boots (dev server + production build verified)
- [x] Express app boots + `/api/health` (returns status, uptime, db state)
- [x] Bootstrap 5 + custom CSS design system (navy/teal, responsive)
- [x] Navbar + Footer + responsive mobile nav
- [x] Reusable UI components (Card, StatCard, Badge, FormField, Pagination, states)
- [x] Landing page · Public dashboard · Project directory · Project detail
- [x] Infrastructure map page · Report submit · Report tracking · Login/Register
- [x] Official dashboard · RoadSync dashboard · About & methodology · 404
- [x] Loading / empty / error states everywhere data is fetched
- [x] Responsive check + console clean (only anonymous `/auth/me` 401 + Router hints)

## Phase 2 — Database, auth, project management
- [x] Mongoose connection + config (retrying connect, URI masking in logs)
- [x] Models: User, Department, Project, Milestone, ProjectUpdate, CitizenReport, Conflict, AuditLog
- [x] Auth: register/login/logout/me, bcrypt hashing, JWT httpOnly cookie + CSRF double-submit
- [x] RBAC middleware (`requireAuth`, `requireRole`, `requireOwnDepartment`, create-time dept check)
- [x] Project CRUD + search/filter/pagination + validation (400 with field details)
- [x] Department CRUD (admin), blocked while projects reference them
- [x] Milestones + project updates (completing a milestone requires evidence caption)
- [x] Audit log service (append-only; no update/delete path exists in the API)
- [x] Seed script (5 departments, 16 projects, 5 reports, milestones, updates, 26 audit entries, demo accounts) — repeatable, verified by re-running
- [x] Backend tests: auth, RBAC, CRUD, validation (in `tests/api.test.js`)
- [x] Frontend wired to real API (auth context, CSRF interceptor, protected routes)

## Phase 3 — RoadSync engine (signature feature)
- [x] `roadSyncService.detectConflicts()` — deterministic rules (unit-tested pure core)
- [x] Road segment normalization (incl. equivalence tests)
- [x] Inclusive date-overlap rule with touching-endpoint semantics
- [x] Eligibility: planned/active/delayed, different departments, different projects
- [x] Duplicate prevention (pair+segment key map + unique index; rescan test)
- [x] Auto re-evaluation on create/update/schedule change
- [x] Conflict statuses unreviewed → under_review → resolved/dismissed; closed conflicts immutable (409 on re-close)
- [x] Conflict API + official-only mutations; review notes append-only
- [x] RoadSync dashboard with counts, priorities, explanations, project titles
- [x] Resolution flow with mandatory documented explanation
- [x] Rescan never reopens human-resolved conflicts (fixed + tested)
- [x] Schedule revisions recorded with previous values in audit history
- [x] Unit + integration tests covering all rules and scenarios
- [x] Algorithm documentation (README section 8: rules, edge cases, limitations)

## Phase 4 — Overdue, citizen reports, accountability
- [x] Overdue detection (UTC calendar days; effective end = revised || planned)
- [x] Days-overdue + delay explanation required for `delayed` status
- [x] Schedule revision requires reason; original deadline preserved
- [x] Citizen report submission with validation + optional linked project
- [x] Photo evidence upload (`POST /reports/:id/images`, ≤5 MB images only, ownership checked before disk write, Cloudinary optional)
- [x] Report statuses + official responses + assignment + outcome notes
- [x] Citizens see only their own reports; officials never see citizen emails
- [x] Accountable history timeline per project (append-only)
- [x] Evidence "submitted" vs "independently verified" (admin-only verification)
- [x] Tests: overdue, reports, privacy, audit persistence, access restrictions

## Phase 5 — Map, analytics, polish
- [x] React Leaflet map with real coordinates from DB (16 project markers verified live)
- [x] Marker types: projects by status, reports (official session), conflict ⚠ markers (3 verified)
- [x] Map filters: department, category, status
- [x] Demonstration-data labelling (page badge + footer + About)
- [x] Analytics API computing counts from DB (summary/charts/impact)
- [x] Chart.js: status doughnut, department workload bars, conflict status doughnut (rendered + data verified = DB counts)
- [x] Totals agree with dashboard counts (enforced by seed contract test)
- [x] UI polish (badges, tables, forms, empty/loading/error, responsive)
- [x] Impact section = activity counts only, with disclaimer (no invented financials)

## Phase 6 — Testing, security, deployment, submission
- [x] Full automated test run green — **74/74 Jest tests** (unit + integration + seed contract)
- [x] Live smoke test green — **31/31 checks** (`server/scripts/smoke.js`)
- [x] Production build succeeds (`vite build`, exit 0)
- [x] Security pass:
  - [x] bcrypt hashes only; `passwordHash` never serialized (select:false + toJSON transform + tests)
  - [x] No secrets in repo (no `.env` committed; `.gitignore` covers env files; secret-pattern scan clean)
  - [x] Protected endpoints enforce auth + RBAC (401/403 tests)
  - [x] Citizens cannot read/modify others' reports (403 tests, live-verified)
  - [x] Officials cannot perform admin actions (403 tests); cannot touch other departments
  - [x] Inputs validated (projects, reports, conflicts, users); validation errors return field details
  - [x] Auth rate limit (10/15 min per IP on register+login)
  - [x] CORS allow-list; foreign Origin refused (403 test)
  - [x] DB/internal errors return generic 500, details only server-side
  - [x] Cookies httpOnly + sameSite=lax + secure in production (env-driven)
  - [x] CSRF double-submit on every mutation (403 test without header)
  - [x] Upload guard: type/size limited, randomised filenames, ownership before disk write
- [x] `.env.example` finalised; health endpoint verified live
- [x] README (all required sections) + deployment instructions
- [x] Demo account instructions (README §12, also shown on the login page)
- [x] Demo script (README §15)
- [ ] **Deployed URL verified from a fresh browser session — BLOCKED: requires your Vercel/Render/Atlas accounts.** Instructions ready (README §14); nothing deployed without your go-ahead.

## Known gaps / honest limitations
- Deployments not created (needs your account credentials) — README §14 has exact steps.
- Image uploads default to local disk; use Cloudinary on ephemeral hosting.
- No email/SMS notifications; no password reset flow.
- Rate-limit store is in-memory (single instance).
- Not penetration-tested.
