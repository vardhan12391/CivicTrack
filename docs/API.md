# CivicTrack — REST API Contract

Base path: `/api`. JSON in/out. Auth via **httpOnly JWT cookie** (`ct_token`) plus **CSRF double-submit** (`ct_csrf` cookie must be echoed in the `x-csrf-token` header on every mutating request).

Legend: 🌍 public · 👤 citizen · 🧑‍💼 official · 🛡 administrator

## Health
- `GET /api/health` 🌍 → `{ status, uptime, db }`

## Auth
- `POST /api/auth/register` 🌍 `{ name, email, password }` → creates **citizen** (role escalation impossible from this endpoint), sets cookies, returns `{ user }`
- `POST /api/auth/login` 🌍 `{ email, password }` → sets cookies, returns `{ user }`
- `POST /api/auth/logout` 🌍 (CSRF) → clears cookies
- `GET /api/auth/me` 🌍 → `{ user }` or 401

Rate limited: 10 requests / 15 min per IP on register+login.

## Departments
- `GET /api/departments` 🌍
- `POST /api/departments` 🛡 `{ name, departmentType, description }`
- `PUT /api/departments/:id` 🛡
- `DELETE /api/departments/:id` 🛡 (blocked if projects exist)

## Projects
- `GET /api/projects` 🌍 — query: `search, status, category, departmentId, roadSegmentId, from, to, overdue, page, limit, sort`
  → `{ items, total, page, pages }`; each item includes computed `isOverdue`, populated department, and `conflictCount`
- `GET /api/projects/map` 🌍 → geo-projected list for the map page
- `GET /api/projects/:id` 🌍 → project + milestones + recent updates + summary of audit history
- `GET /api/projects/:id/history` 🌍 → audit timeline (project-scoped)
- `POST /api/projects` 🧑‍💼(own dept) 🛡 `{ ...project fields }`
- `PUT /api/projects/:id` 🧑‍💼(own dept) 🛡
- `PATCH /api/projects/:id/status` 🧑‍💼 🛡 `{ status, explanation }` — `explanation` **required** for `delayed` and for `completed` with note
- `PATCH /api/projects/:id/schedule` 🧑‍💼 🛡 `{ startDate?, plannedEndDate?, revisedEndDate, reason }` — `reason` **required**; original `plannedEndDate` preserved; RoadSync re-evaluated; audit entry written
- `DELETE /api/projects/:id` 🛡
- `GET /api/projects/overdue` 🌍 → overdue projects with daysOverdue, delay explanation, latest update

### Milestones & updates
- `POST /api/projects/:id/milestones` 🧑‍💼
- `PATCH /api/milestones/:id` 🧑‍💼 — completing requires `evidence` caption; evidence marked `verified:false` unless an admin/admin official marks it
- `POST /api/projects/:id/updates` 🧑‍💼 `{ updateType, message, evidence? }`
- `GET /api/projects/:id/updates` 🌍

## RoadSync conflicts
- `GET /api/conflicts` 🌍 — query `status, priority, roadSegmentId, departmentId`
  → `{ summary: { total, unreviewed, under_review, resolved, dismissed }, items }`;
  each item's `projectIds` are populated (incl. `location` so the map can plot conflict markers)
- `GET /api/conflicts/:id` 🌍 → conflict + both projects + audit history
- `POST /api/conflicts/scan` 🧑‍💼 → runs detection, returns created/existing counts
- `PATCH /api/conflicts/:id/status` 🧑‍💼
  - `{ status: 'under_review', reviewNote }`
  - `{ status: 'resolved', resolution }`
  - `{ status: 'dismissed', resolution }` (documented explanation required)
  - → writes audit entry, appends to `reviewNotes`
- `POST /api/conflicts/:id/rescan` 🧑‍💼 → re-evaluates one conflict

## Citizen reports
- `POST /api/reports` 👤 `{ title, description, category, address, ward, roadSegmentId?, projectId? }`
  (photos are attached afterwards via `POST /api/reports/:id/images`)
- `GET /api/reports/mine` 👤 → own reports (official responses included)
- `GET /api/reports` 🧑‍💼 — list with filters; **citizen PII stripped** from cross-user views
- `GET /api/reports/:id` 👤(owner) 🧑‍💼
- `PATCH /api/reports/:id/status` 🧑‍💼 `{ status, note?, assignedDepartmentId?, linkedProjectId? }`
- `PATCH /api/reports/:id/response` 🧑‍💼 `{ officialResponse, resolutionNotes }`
- `POST /api/reports/:id/images` 👤(owner) 🧑‍💼 multipart `image` (≤ 5 MB, images only) — stored on local disk (`/uploads/…`) or Cloudinary when `CLOUDINARY_URL` is set; ownership is checked before anything touches disk

## Analytics
- `GET /api/analytics/summary` 🌍 — totals: projects by status, open/resolved reports, conflicts by status, overdue count, budget total
- `GET /api/analytics/charts` 🌍 — status distribution, department workload, completion trend (by month), delayed-by-department, report categories, conflict status
- `GET /api/analytics/impact` 🌍 — conflicts detected/reviewed/resolved, schedules revised (labelled as activity counts, not financial claims)

## Users & audit (admin)
- `GET /api/users` 🛡 — list users (**passwordHash never serialized**)
- `PATCH /api/users/:id` 🛡 — activate/deactivate
- `PATCH /api/users/:id/role` 🛡 — role change; cannot demote the last administrator; writes audit entry
- `GET /api/audit` 🛡 — global audit log with filters `entityType, actorId, action, page`
- `GET /api/audit/:entityType/:entityId` 🧑‍💼 — entity timeline

### Error shape
```json
{ "error": { "message": "Human readable", "code": "VALIDATION_ERROR", "details": [...] } }
```
Statuses: 400 validation · 401 unauthenticated · 403 forbidden/csrf · 404 not found · 409 conflict · 429 rate limit · 500 generic (no internals leaked).
