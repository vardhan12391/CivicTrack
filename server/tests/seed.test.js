/**
 * Seed-data contract test.
 * Runs the repeatable seed against a TEST database and asserts the demo
 * guarantees: expected conflicts detected, no false positives, dashboard
 * counts matching the database, hashed passwords, audit history present.
 */
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/civictrack_seed_test';

const mongoose = require('mongoose');

const { seed, DEMO_ACCOUNTS } = require('../src/scripts/seed');
const Project = require('../src/models/Project');
const Department = require('../src/models/Department');
const User = require('../src/models/User');
const Conflict = require('../src/models/Conflict');
const CitizenReport = require('../src/models/CitizenReport');
const AuditLog = require('../src/models/AuditLog');
const { compareProjects } = require('../src/services/roadSyncService');
const analyticsController = require('../src/controllers/analyticsController');

const DB = 'mongodb://127.0.0.1:27017/civictrack_seed_test';

let summary;

beforeAll(async () => {
  await mongoose.connect(DB);
  await mongoose.connection.dropDatabase();
  summary = await seed({ wipe: true, log: false });
}, 60000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/** Minimal res mock for calling controllers directly. */
function resMock() {
  const r = { statusCode: 200, body: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.json = (payload) => { r.body = payload; return r; };
  return r;
}

describe('Seed volumes match the specification', () => {
  test('has at least 4 departments', async () => {
    expect(await Department.countDocuments({})).toBeGreaterThanOrEqual(4);
  });

  test('has 12–20 projects covering every status', async () => {
    const projects = await Project.find({}).lean();
    expect(projects.length).toBeGreaterThanOrEqual(12);
    expect(projects.length).toBeLessThanOrEqual(20);
    const statuses = new Set(projects.map((p) => p.status));
    for (const s of ['planned', 'active', 'delayed', 'completed', 'cancelled']) {
      expect(statuses).toContain(s);
    }
  });

  test('has citizen, official and administrator demo accounts', () => {
    const roles = new Set(DEMO_ACCOUNTS.map((a) => a.role));
    expect(roles).toContain('citizen');
    expect(roles).toContain('official');
    expect(roles).toContain('administrator');
  });

  test('multiple projects share road segments', async () => {
    const bySegment = {};
    for (const p of await Project.find({}).select('roadSegmentId').lean()) {
      bySegment[p.roadSegmentId] = (bySegment[p.roadSegmentId] || 0) + 1;
    }
    expect(Object.values(bySegment).filter((n) => n >= 2).length).toBeGreaterThanOrEqual(3);
  });

  test('has overdue projects with documented explanations', async () => {
    const overdue = await Project.find({
      plannedEndDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
      $or: [{ revisedEndDate: null }, { revisedEndDate: { $lt: new Date() } }],
    }).lean();
    expect(overdue.length).toBeGreaterThanOrEqual(1);
    for (const p of overdue) expect(p.delayExplanation.length).toBeGreaterThan(20);
  });

  test('has citizen reports linked to projects, milestones, updates and audits', async () => {
    expect(await CitizenReport.countDocuments({})).toBeGreaterThanOrEqual(3);
    expect(await CitizenReport.countDocuments({ linkedProjectId: { $ne: null } })).toBeGreaterThanOrEqual(2);
    expect(await mongoose.model('Milestone').countDocuments({})).toBeGreaterThanOrEqual(5);
    expect(await mongoose.model('ProjectUpdate').countDocuments({})).toBeGreaterThanOrEqual(4);
    expect(await AuditLog.countDocuments({})).toBeGreaterThanOrEqual(20);
  });

  test('passwords are stored as bcrypt hashes, never plaintext', async () => {
    for (const acct of DEMO_ACCOUNTS) {
      const u = await User.findOne({ email: acct.email }).select('+passwordHash');
      expect(u).toBeTruthy();
      expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(u.passwordHash).not.toContain(acct.password);
    }
  });
});

describe('RoadSync detects exactly the expected conflicts', () => {
  let conflicts;

  beforeAll(async () => {
    conflicts = await Conflict.find({}).lean();
  });

  test('exactly 3 active conflicts + 1 historical resolved conflict', () => {
    const active = conflicts.filter((c) => c.isActive);
    const resolved = conflicts.filter((c) => !c.isActive && c.status === 'resolved');
    expect(active.length).toBe(3);
    expect(resolved.length).toBe(1);
  });

  test('active conflicts sit on the three documented segments', () => {
    const segments = conflicts.filter((c) => c.isActive).map((c) => c.roadSegmentId).sort();
    expect(segments).toEqual(['ELM-STREET-03', 'INDUSTRIAL-BYPASS-01', 'MAIN-ROAD-01'].sort());
  });

  test('every ACTIVE conflict is genuine (different depts, same segment, overlapping dates)', async () => {
    for (const c of conflicts.filter((x) => x.isActive)) {
      const [a, b] = await Promise.all(
        c.projectIds.map((id) => Project.findById(id).populate('departmentId', 'name departmentType').lean())
      );
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(String(a.departmentId._id)).not.toBe(String(b.departmentId._id)); // different departments
      expect(a.roadSegmentId).toBe(b.roadSegmentId); // same segment
      expect(compareProjects(a, b)).not.toBeNull(); // engine agrees it is an overlap
    }
  });

  test('NO false positives: same-segment non-overlapping pairs are not flagged', async () => {
    const flagged = new Set(conflicts.map((c) => c.projectIds.map(String).sort().join('|')));

    // Every pair of projects on the same segment from different departments
    // must be flagged ONLY if their effective windows truly overlap.
    const projects = await Project.find({ status: { $in: ['planned', 'active', 'delayed'] } })
      .populate('departmentId', 'name departmentType')
      .lean();

    let checked = 0;
    for (let i = 0; i < projects.length; i += 1) {
      for (let j = i + 1; j < projects.length; j += 1) {
        const a = projects[i];
        const b = projects[j];
        if (String(a.departmentId._id) === String(b.departmentId._id)) continue;
        if (a.roadSegmentId !== b.roadSegmentId) continue;
        checked += 1;
        const genuine = compareProjects(a, b) !== null;
        const key = [String(a._id), String(b._id)].sort().join('|');
        const hasActive = conflicts.some((c) => c.isActive && c.projectIds.map(String).sort().join('|') === key);
        expect({ key, hasActive }).toEqual({ key, hasActive: genuine });
      }
    }
    expect(checked).toBeGreaterThanOrEqual(3); // we actually exercised cross-dept same-segment pairs
  });

  test('the historical resolved conflict keeps its full review history', () => {
    const historical = conflicts.find((c) => !c.isActive && c.status === 'resolved');
    expect(historical).toBeTruthy();
    expect(historical.reviewNotes.length).toBeGreaterThanOrEqual(2);
    expect(historical.resolution.length).toBeGreaterThan(20);
    expect(historical.resolvedBy).toBeTruthy();
  });

  test('every conflict has a human-readable explanation mentioning the segment', () => {
    for (const c of conflicts) {
      expect(c.explanation.length).toBeGreaterThan(60);
      expect(c.explanation).toContain(c.roadSegmentId);
    }
  });
});

describe('Dashboard counts match the database (computed, not hard-coded)', () => {
  test('analytics summary equals real counts', async () => {
    const req = { };
    const res = resMock();
    await analyticsController.summary(req, res);
    const t = res.body.totals;

    expect(t.projects.total).toBe(await Project.countDocuments({}));
    expect(t.projects.active).toBe(await Project.countDocuments({ status: 'active' }));
    expect(t.projects.delayed).toBe(await Project.countDocuments({ status: 'delayed' }));
    expect(t.projects.completed).toBe(await Project.countDocuments({ status: 'completed' }));
    expect(t.reports.resolved).toBe(await CitizenReport.countDocuments({ status: 'resolved' }));
    expect(t.conflicts.resolved).toBe(await Conflict.countDocuments({ status: 'resolved' }));
    expect(t.departments).toBe(await Department.countDocuments({}));

    const dbOverdue = await Project.countDocuments({
      plannedEndDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
      $or: [{ revisedEndDate: null }, { revisedEndDate: { $lt: new Date() } }],
    });
    expect(t.projects.overdue).toBe(dbOverdue);
  });

  test('status distribution sums to the project total', async () => {
    const res = resMock();
    await analyticsController.charts({}, res);
    const sum = res.body.statusDistribution.reduce((acc, s) => acc + s.value, 0);
    expect(sum).toBe(await Project.countDocuments({}));
  });

  test('every map project has coordinates (markers correspond to real projects)', async () => {
    const withPoint = await Project.countDocuments({ 'location.point.coordinates': { $exists: true } });
    expect(withPoint).toBe(await Project.countDocuments({}));
    expect(withPoint).toBeGreaterThanOrEqual(12);
  });

  test('re-running the seed is repeatable (same expected volumes)', async () => {
    const second = await seed({ wipe: true, log: false });
    expect(second.projects).toBe(summary.projects);
    expect(second.activeConflicts).toBe(3);
    expect(second.departments).toBe(summary.departments);
    expect(await Conflict.countDocuments({})).toBe(4);
  }, 60000);
});
