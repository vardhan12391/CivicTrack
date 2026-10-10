# CivicTrack — Database Model Contract

All documents use Mongoose `timestamps: true` (`createdAt`, `updatedAt`).
ObjectIds are referenced by `_id` unless noted.

## User
| field | type | notes |
|---|---|---|
| name | String, required | 2–80 chars |
| email | String, required, unique, lowercase | validated format |
| passwordHash | String, required | bcrypt (bcryptjs-compatible), never returned by API |
| role | enum `citizen` \| `official` \| `administrator` | default `citizen` |
| departmentId | ObjectId → Department | required when role = `official` |
| isActive | Boolean | default true; admins can deactivate |

**Index:** `email` unique.

## Department
| field | type | notes |
|---|---|---|
| name | String, required, unique | e.g. "Water Department" |
| departmentType | enum `water` \| `roads` \| `drainage` \| `electricity` \| `gas` \| `telecom` \| `other` |
| description | String |
| contactEmail | String (optional) |

## Project
| field | type | notes |
|---|---|---|
| title | String, required | 5–160 chars |
| description | String, required | ≥ 20 chars |
| category | enum | `road` \| `drainage` \| `water_pipeline` \| `sewage` \| `electricity` \| `streetlight` \| `telecom` \| `gas` \| `other` |
| roadSegmentId | String, required | normalized on save (upper-case, spaces → `-`) |
| location | `{ address, ward, point: { type:'Point', coordinates:[lng,lat] } }` | 2dsphere index |
| departmentId | ObjectId → Department, required | |
| assignedOfficerId | ObjectId → User | official of that department |
| contractorName | String | fictional demo data |
| budget / currency | Number / String | default `INR` |
| startDate | Date, required | |
| plannedEndDate | Date, required | original deadline, never mutated silently |
| revisedEndDate | Date, optional | set only with a documented reason |
| status | enum `planned` \| `active` \| `delayed` \| `completed` \| `cancelled` | default `planned` |
| isOverdue | Boolean, virtual/computed | plannedEndDate < today && status ∉ {completed, cancelled} |
| delayExplanation | String | required when status = `delayed` or revisedEndDate set |
| createdBy | ObjectId → User | |

**Indexes:** `roadSegmentId`, `status`, `departmentId`, `plannedEndDate`, text index on `title`/`description`.

## Milestone
`projectId`, `title`, `description`, `dueDate`, `status` (`pending` \| `in_progress` \| `completed` \| `skipped`), `completedAt`, `evidence` (`{ url, caption, verified: false, verifiedBy, verifiedAt }`).

## ProjectUpdate
`projectId`, `authorId`, `updateType` (`progress` \| `delay` \| `schedule_change` \| `completion` \| `general`), `message`, `evidence` (array as above), `createdAt`.

## CitizenReport
`title`, `description`, `category` (`damaged_road` \| `stalled_construction` \| `poor_workmanship` \| `drainage` \| `repeated_excavation` \| `unsafe_condition` \| `other`), `location` (`{ address, ward, point }`), `roadSegmentId`, `images[]` (Cloudinary URL or `/uploads/...`), `citizenId` (User, required), `assignedDepartmentId`, `linkedProjectId`, `status` (`submitted` \| `under_review` \| `assigned` \| `in_progress` \| `resolved` \| `rejected`), `officialResponse`, `resolutionNotes`, `statusHistory[]` (`{ status, changedBy, note, at }`).

**Privacy:** citizen email/name are never embedded in list responses; populated only for the report owner and officials.

## Conflict (RoadSync)
`projectIds[2]`, `conflictType` (`schedule_overlap` \| `revisit_risk`), `roadSegmentId`, `overlapStartDate`, `overlapEndDate`, `explanation`, `priority` (`high` \| `medium` \| `low` — derived from overlap length), `status` (`unreviewed` \| `under_review` \| `resolved` \| `dismissed`), `reviewNote`, `reviewNotes[]` (append-only history), `reviewedBy`, `resolution`, `resolvedBy`, `resolvedAt`, `isActive`.

**Duplicate prevention:** unique compound index on `{ conflictType, roadSegmentId, projectIds }` + application-level check for an existing active record for the same project pair.

## AuditLog (append-only)
`actorId`, `actorRole`, `entityType` (`project` \| `conflict` \| `report` \| `user` \| `department` \| `milestone`), `entityId`, `action` (e.g. `project.created`, `project.schedule_revised`, `conflict.resolved`), `previousValues` (Mixed), `newValues` (Mixed), `explanation`, `createdAt`.

**No API exposes update/delete on audit entries.**

## Date & timezone strategy
All dates are stored as UTC `Date` at **day precision** (project schedules use `YYYY-MM-DD` inputs, normalized to `00:00:00.000Z`). "Today" for overdue/conflict comparisons is computed as **UTC calendar date** so the demo behaves identically in any timezone. This is documented in the README as a deliberate simplification.
