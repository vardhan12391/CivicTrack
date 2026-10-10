# CivicTrack — Smart Public Works Transparency & Coordination Platform



A MERN-stack civic-technology application that gives the public a transparent view of infrastructure projects while helping departments coordinate roadwork through **RoadSync** — a deterministic engine that identifies potential conflicts before two departments dig up the same road.

> ⚠️ **Demonstration project:** All projects, departments, people, reports, and coordinates in this application use fictional data created for a hackathon demo. CivicTrack is not connected to any real government system.



---



## Live demo

- **Website:** [https://civic-track-sepia.vercel.app](https://civic-track-sepia.vercel.app)
- **Backend health check:** [https://civictrack-edf6.onrender.com/api/health](https://civictrack-edf6.onrender.com/api/health)

> **Demo note:** The project uses fictional demonstration data. The backend may take a little time to wake up if the hosting service has been idle.
## 🎥 Project video 

[▶️ Watch the CivicTrack Hackathon  Video](https://github.com/vardhan12391/CivicTrack/blob/main/hackathon%20video.mp4)


## 🎥 Alternative Project video 

[▶️ Watch the CivicTrack Demo Video (Version 2)](https://github.com/vardhan12391/CivicTrack/blob/main/hackathon%20video%20(1).mp4)

## 1. Problem statement



City governments run hundreds of small infrastructure projects — water mains, storm drains,

road resurfacing, street lighting, fibre ducts — spread across many departments and

contractors. In practice:



- **Citizens cannot see what is happening on their street.** Projects are announced in

  siloed department pages, notices boards, or not at all. When work stalls, residents are

  told nothing.

- **Departments do not coordinate their schedules.** The water department opens Main Road

  in October; the roads department resurfaces Main Road the same week. The road is dug up

  twice, traffic is disrupted twice, and public money is spent twice.

- **There is no accountability trail.** Deadlines slip silently. There is no public record

  of who changed a deadline, why, or what was promised as mitigation.



## 2. Problems addressed



| Problem | CivicTrack response |

|---|---|

| Opaque public works | Public project directory, map, and dashboard — no login required |

| Inter-department double-digging | **RoadSync** detects overlapping schedules on the same road segment and flags them for human review |

| Silent deadline slippage | Overdue detection with days-overdue counts and a **mandatory** written explanation before a project can be marked delayed |

| No accountability history | Append-only audit log: every schedule change, status change, and conflict decision is recorded with actor, previous values, and reason |

| Citizens unheard | Citizen reports linked to real projects, with official responses and public status tracking |

| Unverifiable claims | Impact numbers are labelled activity counts, never invented financial savings; uploaded evidence is "submitted", not "verified", until an administrator confirms it |



## 3. Proposed solution



CivicTrack is a single platform with three audiences:



1. **The public** browses projects, filters by department/status/road, views them on a map,

   reads delay explanations, follows conflicts, and submits/tracks reports — without an account.

2. **Department officials** manage their own department's projects, publish progress updates

   and milestones with evidence, respond to citizen reports, and — critically — **review and

   resolve RoadSync conflicts** with documented reasoning.

3. **Administrators** manage users and departments, verify evidence, and audit every action

   ever taken in the system.



**RoadSync is the distinguishing feature.** Whenever a project is created or its schedule

changes, the engine re-compares it against every other scheduled project and raises

**potential conflicts** — never automatic rescheduling — so a human always decides.



## 4. Features



**Public**

- Project directory with search, filters (status, category, department, road segment, date range, overdue), sorting, and pagination

- Project detail: facts, milestones, progress updates, and an accountability timeline

- Public dashboard: live totals and Chart.js distributions (status, department workload)

- Infrastructure map (React Leaflet + OpenStreetMap): projects by status, conflict markers, filters

- RoadSync dashboard: every detected conflict with priority, overlap window, and a written explanation

- Overdue watchlist with days overdue and the department's stated reason

- About/methodology page (how detection works, honesty about limits)



**Citizens (registered)**

- Submit reports (category, location, optional road segment, optional linked project)

- Attach photo evidence to a report (≤ 5 MB, images only; stored locally or on Cloudinary)

- Track their own reports end-to-end: status timeline + official responses

- Strict privacy: citizens can only read **their own** reports; officials see the reporter's name only, never their email



**Officials**

- Create/edit projects **for their own department only** (enforced server-side)

- Status changes; `delayed`/`cancelled` require a public explanation

- Schedule revisions require a reason; the original deadline is preserved forever

- Milestones with evidence; completing a milestone requires an evidence caption

- Progress updates (progress / delay / schedule change / completion)

- Review citizen reports: assign department, link to a project, respond, resolve/reject with a note

- RoadSync: run scans, review conflicts (review note → resolution), all audited



**Administrators**

- Everything officials can do, in any department, plus:

- User management (roles, department assignment, activate/deactivate; cannot demote the last admin)

- Department CRUD (blocked while projects still reference a department)

- Evidence verification (the only role that can mark evidence "independently verified")

- Global audit log with filters



## 5. Technology stack



| Layer | Technology |

|---|---|

| Frontend | React 18, Vite, JavaScript (ES modules), React Router 6, Bootstrap 5 + custom CSS, Axios, Chart.js (react-chartjs-2), React Leaflet |

| Backend | Node.js, Express 4, JavaScript (CommonJS), REST API |

| Database | MongoDB (Mongoose 8) — MongoDB Atlas in production, local mongod for development |

| Auth | bcrypt password hashing, JWT in **httpOnly cookie** + **CSRF double-submit** header, role-based authorization enforced server-side |

| Security | Helmet, CORS allow-list, express-rate-limit on auth endpoints |

| Testing | Jest + Supertest (74 tests: unit, integration, seed contract) |

| Services | OpenStreetMap tiles (map), Cloudinary (optional image uploads) |

| Deployment | Vercel (frontend), Render (backend), MongoDB Atlas (database), GitHub (source) |



## 6. Architecture



```

┌──────────────────────────┐         HTTPS / JSON + httpOnly cookies

│  React SPA  (Vercel)     │ ───────────────────────────────────────────┐

│  pages · components      │                                            │

│  axios + CSRF interceptor│                                            ▼

│  Chart.js · Leaflet      │                          ┌─────────────────────────────┐

└──────────────────────────┘                          │  Express API  (Render)      │

                                                      │  helmet · CORS · rate-limit │

                                                      │  JWT cookie auth + CSRF     │

                                                      │  RBAC middleware            │

                                                      │  ┌───────────────────────┐  │

                                                      │  │ RoadSync engine       │  │

                                                      │  │ pairwise comparison   │  │

                                                      │  │ on project changes    │  │

                                                      │  └───────────────────────┘  │

                                                      │  audit service (append-only)│

                                                      └──────────────┬──────────────┘

                                                                     │ Mongoose

                                                                     ▼

                                                      ┌─────────────────────────────┐

                                                      │  MongoDB Atlas              │

                                                      │  users · departments ·      │

                                                      │  projects · milestones ·    │

                                                      │  updates · reports ·        │

                                                      │  conflicts · auditlogs      │

                                                      └─────────────────────────────┘

```



**Local development:** Vite proxies `/api → localhost:4000`, so the browser talks to a

single origin and cookies work without CORS. In production the SPA calls the Render URL

directly (`VITE_API_BASE_URL`), with CORS restricted to the Vercel origin.



## 7. Database schema overview



| Collection | Purpose | Key fields |

|---|---|---|

| `users` | All accounts | name, email (unique), passwordHash (bcrypt, never serialized), role (`citizen`/`official`/`administrator`), departmentId, isActive |

| `departments` | City departments | name (unique), departmentType, contactEmail |

| `projects` | Infrastructure projects | title, description, category, **roadSegmentId (normalised, indexed)**, location (address, ward, GeoJSON Point), departmentId, assignedOfficerId, contractorName, budget, **startDate / plannedEndDate / revisedEndDate**, status, delayExplanation |

| `milestones` | Project stages | projectId, title, dueDate, status, evidence {url, caption, **verified**} |

| `project_updates` | Public progress posts | projectId, authorId, updateType, message, evidence[] |

| `citizen_reports` | Citizen-submitted issues | title, description, category, location, images[], citizenId, assignedDepartmentId, linkedProjectId, status, officialResponse, statusHistory[] |

| `conflicts` | RoadSync findings | **projectIds[2]**, roadSegmentId, departmentIds[2], overlapStart/End, priority, status, isActive, reviewNotes[] (append-only), resolution, resolvedBy |

| `auditlogs` | Append-only history | actorId, actorRole, entityType, entityId, action, previousValues, newValues, explanation |



Design notes:

- `plannedEndDate` is the **original public deadline**; `revisedEndDate` only exists when a

  reason was documented. The effective deadline is `revisedEndDate || plannedEndDate`.

- Audit logs have **no update or delete path in the API** — history cannot be rewritten.

- Conflicts are **never deleted**; when schedules stop overlapping, `isActive` flips to

  `false` and the record + its review history remain.



## 8. RoadSync — how the detection algorithm works



> **Elevator pitch for judges:** RoadSync answers one question — *"Are two different

> departments scheduled to work on the same road segment at the same time?"* It

> normalises road-segment identifiers so `"main road 01"` and `"MAIN-ROAD-01"` are the

> same road, then compares every pair of scheduled projects using an inclusive date-overlap

> test. When it finds an overlap between two departments it does **not** move anything —

> it creates a conflict record with a plain-English explanation and notifies humans to

> decide. Every decision, and every schedule change made because of it, lands in the

> audit trail."



Rules (all must hold to raise a conflict):



1. **Different projects** — never compare a project with itself.

2. **Different departments** — same-department overlap is that department's own planning issue, not a coordination conflict.

3. **Same normalised road segment** — `normalizeRoadSegment()` upper-cases, converts spaces/underscores to single hyphens, and trims edge hyphens, so every spelling of a road matches.

4. **Inclusive date overlap** — `startA ≤ endB && startB ≤ endA`. Touching endpoints (one project ends the day the other starts) count as an overlap because both crews would be on the same road. The effective end date is `revisedEndDate || plannedEndDate`.

5. **Only scheduled work counts** — statuses `planned`, `active`, `delayed`. Completed and cancelled projects are in the past.

6. **Deterministic output** — each detected pair produces exactly one conflict per road segment, keyed canonically (sorted project IDs) so rescans never create duplicates.



**Priority** is derived from the overlap length: ≥ 7 days → high, 3–6 → medium, 1–2 → low.



**Re-evaluation:** creating/updating a project or revising a schedule triggers

`reevaluateProject()`, which re-checks that project against all others, updates overlap

windows, reactivates conflicts whose overlap returns, and deactivates (never deletes)

conflicts whose overlap is gone. A rescan **never reopens a conflict humans already

resolved or dismissed** — that decision belongs to people.



**Documented limitations:** pairwise comparison is O(n²) over scheduled projects (fine at

municipal scale of hundreds of projects, not millions); detection uses scheduled dates only —

it cannot know two crews share a single entrance; conflicts are **potential** conflicts and

always require human judgement.



## 9. API documentation



Base path `/api`. JSON in/out. Auth via httpOnly JWT cookie (`ct_token`); every mutating

request must echo the `ct_csrf` cookie in the `x-csrf-token` header (double-submit).

Full details in [docs/API.md](docs/API.md). Error shape:



```json

{ "error": { "message": "Human readable", "code": "VALIDATION_ERROR", "details": [{ "field": "title", "message": "..." }] } }

```



Quick map: `GET /health` · `POST/GET /auth/{register,login,logout,me}` · `GET/POST/PUT/DELETE /departments` ·

`GET/POST /projects`, `GET /projects/{overdue,map}`, `GET/PUT/DELETE /projects/:id`,

`PATCH /projects/:id/{status,schedule}`, `POST /projects/:id/{milestones,updates}`,

`PATCH /milestones/:id` · `GET /conflicts`, `POST /conflicts/scan`,

`PATCH /conflicts/:id/{status}`, `POST /conflicts/:id/rescan` ·

`POST /reports`, `GET /reports/{mine}`, `PATCH /reports/:id/{status,response}`,

`POST /reports/:id/images` · `GET /analytics/{summary,charts,impact}` ·

`GET /users`, `PATCH /users/:id{,/role}` · `GET /audit`, `GET /audit/:entityType/:entityId`



## 10. Local setup



Prerequisites: **Node.js ≥ 18**, npm, and **MongoDB** (local `mongod` or an Atlas URI).



```bash

# 1. Clone and install

git clone \<your-repo-url> civictrack && cd civictrack

cd server && npm install

cd ../client && npm install && cd ..



# 2. Configure environment

cp .env.example server/.env     # then edit: MONGODB_URI, JWT_SECRET



# 3. Seed the fictional demonstration data

cd server && npm run seed        # prints the demo accounts when finished



# 4. Run both apps (two terminals)

cd server && npm run dev         # API on http\://localhost:4000

cd client && npm run dev         # SPA on http\://localhost:5173 (proxies /api)



# 5. Open http\://localhost:5173 and sign in with a demo account (section 12)

```



## 11. Environment variables



Copy `.env.example` → `server/.env` (backend) and set in Vercel (frontend).



| Variable | Where | Purpose | Example |

|---|---|---|---|

| `PORT` | server | Express port | `4000` |

| `MONGODB_URI` | server | Database connection | `mongodb://127.0.0.1:27017/civictrack` / Atlas SRV |

| `CLIENT_ORIGIN` | server | CORS allow-list (comma-separated) | `https\://your-app.vercel.app` |

| `JWT_SECRET` | server | Signs auth JWTs — long random string | `openssl rand -hex 48` |

| `JWT_EXPIRES_IN` | server | Auth cookie lifetime | `7d` |

| `COOKIE_SECURE` | server | `true` in production (HTTPS only) | `true` |

| `UPLOAD_DIR` | server | Local image storage dir | `uploads` |

| `CLOUDINARY_URL` | server | **Optional** image uploads | `cloudinary://key:secret\@cloud` |

| `SEED_ON_START` | server | Wipe+seed on boot (dev only, never prod) | `false` |

| `VITE_API_BASE_URL` | client | Backend base URL | `https\://your-api.onrender.com/api` |



## 12. Seed data & demo accounts



`npm run seed` is **repeatable** — it wipes and recreates clearly-labelled fictional data:

5 departments · 16 projects (all five statuses, several sharing road segments) ·

3 genuine RoadSync conflicts + 1 historical resolved conflict · 2 overdue projects with

explanations · 5 citizen reports linked to projects · 7 milestones · 5 progress updates ·

25+ audit entries. The seed's design guarantees (asserted by `tests/seed.test.js`):

the three expected conflicts are detected, same-segment non-overlapping pairs are **not**

flagged, and dashboard counts equal database counts.



| Role | Email | Password |

|---|---|---|

| Citizen | `aisha\@civictrack.demo` | `DemoCitizen123!` |

| Citizen | `ravi\@civictrack.demo` | `DemoCitizen123!` |

| Official (Water) | `officer.water\@civictrack.demo` | `DemoOfficial123!` |

| Official (Roads) | `officer.roads\@civictrack.demo` | `DemoOfficial123!` |

| Official (Drainage) | `officer.drainage\@civictrack.demo` | `DemoOfficial123!` |

| Administrator | `admin\@civictrack.demo` | `DemoAdmin123!` |



These passwords are **fictional demo credentials shown here for convenience — never reuse

them anywhere real.** They exist only in your local/seeded database.



## 13. Testing



```bash

cd server

npm test          # Jest: 74 tests (unit + integration + seed contract)

npm run seed      # reset demo data any time

node scripts/smoke.js   # 31-check live end-to-end smoke test (API must be running)

cd ../client && npm run build   # production build check

```



What is covered: password hashing & no-plaintext-storage, registration role-escalation

impossibility, login/logout/CSRF, role-based access (citizen/official/administrator),

department-scoped officials, project CRUD + validation, schedule-revision accountability,

RoadSync rules (unit) + detection/resolution/duplicate-prevention (integration),

false-positive guards, citizen-report privacy, analytics/database count consistency,

audit-history persistence, CORS allow-list, security headers, and the seed contract

(expected conflicts, no false positives, repeatable volumes).



## 14. Deployment

**Live URLs:** [CivicTrack website](https://civic-track-sepia.vercel.app) · [Backend health check](https://civictrack-edf6.onrender.com/api/health)



**Backend (Render)**

1. New Web Service → point at the `server/` directory; build `npm install`; start `npm start`.

2. Set environment variables: `MONGODB_URI` (Atlas), `JWT_SECRET`, `CLIENT_ORIGIN=https://civic-track-sepia.vercel.app`, `COOKIE_SECURE=true`, `NODE_ENV=production`.

3. Health check path: `/api/health`.



**Frontend (Vercel)**

1. Import the repo; root directory `client`; framework preset Vite; build `npm run build`; output `dist`.

2. Set `VITE_API_BASE_URL=https://civictrack-edf6.onrender.com/api`.



**Database (MongoDB Atlas)**

1. Create a free M0 cluster → Database Access: create a user → Network Access: allow Render's egress (or `0.0.0.0/0` for a demo).

2. Copy the SRV connection string into `MONGODB_URI`.

3. Run `npm run seed` **once** from a machine that can reach Atlas to load demo data.



**First-run checklist:** open `/api/health` (expect `db: "connected"`) → load the frontend →

sign in as `admin\@civictrack.demo` → check dashboard counts → open RoadSync → run a scan

(should report 0 new) → submit a report as a citizen → verify it appears under

`/official/reports`. The live deployment links are listed at the top of this README.



## 15. Demo script (2–5 minutes)



1. **Public directory** — open the app, browse `/projects`; filter to Active.

2. **A Water project** — open "Main Road Water Main Replacement — Phase 2" (facts, timeline).

3. **An overlapping Roads project** — open "Main Road Resurfacing Drive" on the same segment.

4. **RoadSync detects it** — go to `/roadsync`: the MAIN-ROAD-01 conflict (High, 7-day overlap) with the written explanation.

5. **Official resolves it** — sign in as `officer.roads\@civictrack.demo`, open the conflict, add a review note, then a resolution.

6. **Revised schedule appears** — open the project's schedule (reason required) and see the accountability timeline update.

7. **Audit history** — as `admin\@civictrack.demo` open `/admin/audit`: `conflict.under_review`, `conflict.resolved`, `project.schedule_revised` all present with actors and reasons.

8. **Citizen report** — as `aisha\@civictrack.demo` submit a report, attach a photo, then track it; respond as an official.

9. **Public dashboard** — `/dashboard`: totals and charts match the database; `/map` shows project and conflict markers.



## 16. External libraries & services



- **OpenStreetMap** via Leaflet/react-leaflet tiles — map basemap (© OpenStreetMap contributors)

- **Chart.js** via react-chartjs-2 — dashboard charts

- **Bootstrap 5** (CSS only, no React components) + custom design system

- **Mongoose**, **Express**, **bcryptjs**, **jsonwebtoken**, **cookie-parser**, **cors**, **helmet**, **express-rate-limit**, **multer**, **morgan** (backend)

- **Cloudinary** (optional) — image hosting when `CLOUDINARY_URL` is set; otherwise local disk

- **Axios** (frontend HTTP)



## 17. Known limitations & honest notes



- **No real notifications** (email/SMS): status changes are visible in-app only.

- **Image uploads** are stored on the backend's local disk by default; on ephemeral hosting (Render free tier) attach Cloudinary or expect uploads to vanish on redeploy.

- **RoadSync is date+segment based:** it cannot detect conflicts arising from shared access roads, crane radius, or traffic impact beyond the same segment; it also trusts departments to keep `roadSegmentId` accurate.

- **O(n²) pairwise scan** is fine for hundreds of projects; a production city-wide system would index by segment + date window.

- **No unit-level cost estimates:** the impact page deliberately reports activity counts only — inventing savings figures would be dishonest without verified baselines.

- **Seed coordinates** are fictional points inside one demonstration city; they do not correspond to real works.

- **Rate limiting** is per-IP and in-memory — appropriate for a demo, not for hostile production traffic behind rotating IPs (add a shared store for production).

- **Not penetration-tested.** Security posture follows the checklist in section 19 of [docs/CHECKLIST.md](docs/CHECKLIST.md) but is not a substitute for a professional review.



## 18. Repository layout



```

civictrack/

├── client/                 # React SPA (Vite)

│   └── src/

│       ├── components/     # UI kit, charts, protected route

│       ├── hooks/          # auth context, data-fetching hooks

│       ├── layouts/        # navbar + footer shell

│       ├── pages/          # 20+ pages (public, citizen, official, admin)

│       ├── services/       # axios instance + typed API calls

│       └── styles/         # design system CSS on top of Bootstrap

├── server/                 # Express API

│   ├── scripts/seed.js     # repeatable fictional dataset

│   ├── scripts/smoke.js    # live end-to-end smoke test

│   ├── src/

│   │   ├── config/         # env + mongoose connection

│   │   ├── controllers/    # route handlers

│   │   ├── middleware/     # auth (JWT cookie), CSRF, RBAC

│   │   ├── models/         # 8 Mongoose models

│   │   ├── routes/         # express routers

│   │   ├── services/       # RoadSync engine + audit service

│   │   ├── utils/          # errors, tokens

│   │   ├── app.js          # express assembly (health, CORS, security)

│   │   └── server.js       # entry point

│   └── tests/              # Jest suites (74 tests)

├── docs/                   # CHECKLIST · DATA-MODELS · API

└── .env.example

```



## 19. Version control & submission



Source is hosted on GitHub; secrets live only in environment variables (`.env` is

git-ignored; `.env.example` documents every key). The implementation checklist with

per-phase verification status is in [docs/CHECKLIST.md](docs/CHECKLIST.md).



---



**CivicTrack — civic-technology hackathon demonstration. All data fictional.**
