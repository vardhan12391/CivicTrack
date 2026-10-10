/**
 * API integration tests (supertest, in-process app).
 * Uses a SEPARATE database (civictrack_test) so the demo data is never touched.
 * NODE_ENV=test also disables the auth rate limiter so tests can log in freely.
 */
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/civictrack_test';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = require('../src/app');
const User = require('../src/models/User');
const Department = require('../src/models/Department');
const Project = require('../src/models/Project');
const Conflict = require('../src/models/Conflict');
const AuditLog = require('../src/models/AuditLog');
const CitizenReport = require('../src/models/CitizenReport');

/** Cookie-holding client that echoes the CSRF cookie on mutations. */
function session() {
  const agent = request.agent(app);
  let csrf = null;
  const send = (method) => (url, body) => {
    let req = agent[method](url);
    if (csrf) req = req.set('x-csrf-token', csrf);
    if (body !== undefined) req = req.send(body);
    return req;
  };
  const capture = (res) => {
    const cookies = [].concat(res.headers['set-cookie'] || []);
    const found = cookies.find((c) => c.startsWith('ct_csrf='));
    if (found) csrf = decodeURIComponent(found.split(';')[0].slice('ct_csrf='.length));
  };
  return {
    agent,
    get: (url) => agent.get(url),
    post: send('post'),
    patch: send('patch'),
    put: send('put'),
    del: send('delete'),
    raw: (method, url, body) => agent[method](url).send(body), // no CSRF header
    async login(email, password) {
      // Mirror the real frontend: it echoes the CSRF cookie on every mutation.
      let req = agent.post('/api/auth/login');
      if (csrf) req = req.set('x-csrf-token', csrf);
      const res = await req.send({ email, password });
      capture(res);
      return res;
    },
    async register(payload) {
      let req = agent.post('/api/auth/register');
      if (csrf) req = req.set('x-csrf-token', csrf);
      const res = await req.send(payload);
      capture(res);
      return res;
    },
    clearCsrf() { csrf = null; },
  };
}

const ids = {};

beforeAll(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/civictrack_test');
  await mongoose.connection.dropDatabase();

  // Fixtures — departments and users created directly (registration is
  // citizen-only by design, so officials/admins are provisioned here).
  const water = await Department.create({ name: 'Test Water Dept', departmentType: 'water' });
  const roads = await Department.create({ name: 'Test Roads Dept', departmentType: 'roads' });
  const power = await Department.create({ name: 'Test Power Dept', departmentType: 'electricity' });
  ids.water = water._id;
  ids.roads = roads._id;
  ids.power = power._id;

  const mkUser = async (name, email, role, departmentId) =>
    User.create({ name, email, passwordHash: bcrypt.hashSync('TestPass123!', 10), role, departmentId: departmentId || null });
  ids.admin = await mkUser('Test Admin', 'admin@test.local', 'administrator');
  ids.waterOfficer = await mkUser('Water Officer', 'water@test.local', 'official', ids.water);
  ids.roadsOfficer = await mkUser('Roads Officer', 'roads@test.local', 'official', ids.roads);
  ids.citizen1 = await mkUser('Citizen One', 'c1@test.local', 'citizen');
  ids.citizen2 = await mkUser('Citizen Two', 'c2@test.local', 'citizen');
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('Health & public reads', () => {
  test('GET /api/health reports db status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('connected');
  });

  test('GET /api/projects is public and paginated', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body).toHaveProperty('total');
  });

  test('unknown API route returns JSON 404, not HTML', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Authentication', () => {
  const anon = session();

  test('public registration always creates a citizen (no role escalation)', async () => {
    const res = await anon.register({ name: 'New Citizen', email: 'new@test.local', password: 'LongPass123!', role: 'administrator' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('citizen');
    const stored = await User.findOne({ email: 'new@test.local' }).select('+passwordHash');
    expect(stored.role).toBe('citizen');
    expect(stored.passwordHash).toMatch(/^\$2/); // bcrypt, never plaintext
    expect(stored.passwordHash).not.toContain('LongPass123!');
  });

  test('duplicate registration → 409', async () => {
    const res = await anon.register({ name: 'Dup', email: 'new@test.local', password: 'LongPass123!' });
    expect(res.status).toBe(409);
  });

  test('weak password rejected with 400', async () => {
    const res = await anon.register({ name: 'Weak', email: 'weak@test.local', password: 'short' });
    expect(res.status).toBe(400);
  });

  test('wrong password → 401 with the same message as unknown user', async () => {
    const res = await anon.post('/api/auth/login', { email: 'admin@test.local', password: 'nope' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password.');
  });

  test('login sets httpOnly auth cookie + readable CSRF cookie, /me works', async () => {
    const res = await anon.login('admin@test.local', 'TestPass123!');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'].join(' ');
    expect(cookies).toMatch(/ct_token=/);
    expect(cookies).toMatch(/HttpOnly/i); // session cookie is httpOnly
    const me = await anon.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('administrator');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  test('mutation with session but NO CSRF header → 403', async () => {
    const res = await anon.raw('post', '/api/auth/logout', {});
    expect(res.status).toBe(403);
  });

  test('logout with CSRF clears the session', async () => {
    const res = await anon.post('/api/auth/logout');
    expect(res.status).toBe(200);
    const me = await anon.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

describe('Role-based access control', () => {
  const anon = session();
  const citizen = session();
  const water = session();
  const roads = session();
  const admin = session();

  beforeAll(async () => {
    await citizen.login('c1@test.local', 'TestPass123!');
    await water.login('water@test.local', 'TestPass123!');
    await roads.login('roads@test.local', 'TestPass123!');
    await admin.login('admin@test.local', 'TestPass123!');
  });

  test('anonymous cannot create projects (401)', async () => {
    const res = await anon.post('/api/projects', {});
    expect(res.status).toBe(401);
  });

  test('citizen cannot create projects, list users, or scan conflicts (403)', async () => {
    expect((await citizen.post('/api/projects', {})).status).toBe(403);
    expect((await citizen.get('/api/users')).status).toBe(403);
    expect((await citizen.post('/api/conflicts/scan')).status).toBe(403);
    expect((await citizen.get('/api/audit')).status).toBe(403);
  });

  test('official cannot create a project for another department (403)', async () => {
    const res = await water.post('/api/projects', {
      title: 'Not allowed cross-department project',
      description: 'This project belongs to another department and must be rejected.',
      category: 'road', roadSegmentId: 'SEG-X', departmentId: ids.roads,
      startDate: '2027-01-01', plannedEndDate: '2027-01-05',
    });
    expect(res.status).toBe(403);
  });

  test('official CAN create a project for their own department (201)', async () => {
    const res = await water.post('/api/projects', {
      title: 'Water main work on Test Avenue',
      description: 'Replacing a leaking water main along Test Avenue for the integration tests.',
      category: 'water_pipeline', roadSegmentId: 'SEG-1', departmentId: ids.water,
      startDate: '2027-06-01', plannedEndDate: '2027-06-20',
      location: { address: 'Test Avenue', ward: 'Ward 1', point: { coordinates: [78.48, 17.39] } },
    });
    expect(res.status).toBe(201);
    expect(res.body.project.department.name).toBe('Test Water Dept');
    ids.p1 = res.body.project._id;
  });

  test('official from another department cannot edit or delete it (403)', async () => {
    expect((await roads.patch(`/api/projects/${ids.p1}/status`, { status: 'delayed', explanation: 'trying' })).status).toBe(403);
    expect((await roads.del(`/api/projects/${ids.p1}`)).status).toBe(403); // delete is admin-only anyway
    expect((await citizen.del(`/api/projects/${ids.p1}`)).status).toBe(403);
  });
});

describe('Project validation & schedule accountability', () => {
  const water = session();
  beforeAll(async () => { await water.login('water@test.local', 'TestPass123!'); });

  test('create without required fields → 400 with field details', async () => {
    const res = await water.post('/api/projects', { title: 'x', departmentId: String(ids.water) });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.some((d) => d.field === 'description')).toBe(true);
  });

  test('end date before start date → 400', async () => {
    const res = await water.post('/api/projects', {
      title: 'Backwards dates project',
      description: 'This project has its dates reversed and must be rejected by validation.',
      category: 'road', roadSegmentId: 'SEG-2', departmentId: String(ids.water),
      startDate: '2027-03-10', plannedEndDate: '2027-03-01',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.field === 'plannedEndDate')).toBe(true);
  });

  test('status "delayed" requires a public explanation', async () => {
    const noExplain = await water.patch(`/api/projects/${ids.p1}/status`, { status: 'delayed' });
    expect(noExplain.status).toBe(400);
    const withExplain = await water.patch(`/api/projects/${ids.p1}/status`, {
      status: 'delayed', explanation: 'Pipe delivery delayed by the supplier; new estimate next week.',
    });
    expect(withExplain.status).toBe(200);
    expect(withExplain.body.project.delayExplanation).toContain('Pipe delivery delayed');
  });

  test('schedule revision without a reason → 400; with reason → 200 + audit entry', async () => {
    const bad = await water.patch(`/api/projects/${ids.p1}/schedule`, { revisedEndDate: '2027-06-30' });
    expect(bad.status).toBe(400);

    const good = await water.patch(`/api/projects/${ids.p1}/schedule`, {
      revisedEndDate: '2027-06-30',
      reason: 'Utility clearance arrived late; revised end date agreed with the ward office.',
    });
    expect(good.status).toBe(200);
    expect(good.body.project.revisedEndDate).toBeTruthy();

    const audit = await AuditLog.find({ entityId: ids.p1, action: 'project.schedule_revised' });
    expect(audit.length).toBe(1);
    expect(audit[0].explanation).toContain('Utility clearance');
    expect(audit[0].previousValues).toBeTruthy(); // old values preserved
  });
});

describe('RoadSync conflict detection & resolution', () => {
  const water = session();
  const roads = session();
  const anon = session();

  beforeAll(async () => {
    await water.login('water@test.local', 'TestPass123!');
    await roads.login('roads@test.local', 'TestPass123!');
  });

  test('overlapping project from another department → conflict detected on create', async () => {
    const res = await roads.post('/api/projects', {
      title: 'Roads resurfacing on Test Avenue',
      description: 'Resurfacing work that deliberately overlaps the water main project on SEG-1.',
      category: 'road', roadSegmentId: 'seg-1', departmentId: ids.roads, // normalises to SEG-1
      startDate: '2027-06-15', plannedEndDate: '2027-06-30', // overlaps p1 (06-01..06-20)
    });
    expect(res.status).toBe(201);
    expect(res.body.roadSync.created).toBe(1);
    ids.p2 = res.body.project._id;
  });

  test('non-overlapping project on the SAME segment → no new conflict (false-positive check)', async () => {
    const res = await water.post('/api/projects', {
      title: 'Later valve replacement on Test Avenue',
      description: 'Scheduled well after both other projects so RoadSync must not flag it.',
      category: 'water_pipeline', roadSegmentId: 'SEG-1', departmentId: ids.water,
      startDate: '2027-07-20', plannedEndDate: '2027-07-28',
    });
    expect(res.status).toBe(201);
    expect(res.body.roadSync.created).toBe(0);
  });

  test('overlapping project in the SAME department → not a coordination conflict', async () => {
    // Second water project overlapping only p1 (same department) on another segment.
    const p = await water.post('/api/projects', {
      title: 'Second water crew on Test Avenue',
      description: 'Same department as the original water project; RoadSync must not flag internal overlap.',
      category: 'water_pipeline', roadSegmentId: 'SEG-3', departmentId: ids.water,
      startDate: '2027-06-01', plannedEndDate: '2027-06-10',
    });
    expect(p.status).toBe(201);
    const q = await water.post('/api/projects', {
      title: 'Water crew two on segment three',
      description: 'Second water department project on SEG-3 that overlaps the first one internally.',
      category: 'water_pipeline', roadSegmentId: 'SEG-3', departmentId: ids.water,
      startDate: '2027-06-05', plannedEndDate: '2027-06-15',
    });
    expect(q.status).toBe(201);
    expect(q.body.roadSync.created).toBe(0); // same-department overlap never flags
  });

  test('conflict is publicly visible with a human-readable explanation', async () => {
    const res = await anon.get('/api/conflicts?roadSegmentId=SEG-1');
    expect(res.status).toBe(200);
    const conflict = res.body.items.find((c) => c.isActive);
    expect(conflict).toBeTruthy();
    expect(conflict.roadSegmentId).toBe('SEG-1');
    expect(conflict.explanation).toContain('overlap');
    expect(conflict.explanation.length).toBeGreaterThan(80);
    expect(conflict.status).toBe('unreviewed');
    expect(res.body.summary.unreviewed).toBeGreaterThanOrEqual(1);
    ids.conflict = conflict._id;
  });

  test('review → resolve → closed (409 on further changes), history preserved', async () => {
    const noteless = await roads.patch(`/api/conflicts/${ids.conflict}/status`, { status: 'under_review' });
    expect(noteless.status).toBe(400); // review note required

    const review = await roads.patch(`/api/conflicts/${ids.conflict}/status`, {
      status: 'under_review', reviewNote: 'Contacting both departments about sequencing.',
    });
    expect(review.status).toBe(200);
    expect(review.body.conflict.status).toBe('under_review');

    const noResolution = await roads.patch(`/api/conflicts/${ids.conflict}/status`, { status: 'resolved' });
    expect(noResolution.status).toBe(400); // resolution required

    const resolved = await roads.patch(`/api/conflicts/${ids.conflict}/status`, {
      status: 'resolved', resolution: 'Water finishes 06-20; roads start 06-21. Both departments confirmed.',
    });
    expect(resolved.status).toBe(200);
    expect(resolved.body.conflict.status).toBe('resolved');
    expect(resolved.body.conflict.isActive).toBe(false);

    const closed = await roads.patch(`/api/conflicts/${ids.conflict}/status`, { status: 'dismissed', resolution: 'attempt' });
    expect(closed.status).toBe(409); // closed conflicts stay closed

    const detail = await anon.get(`/api/conflicts/${ids.conflict}`);
    expect(detail.status).toBe(200);
    expect(detail.body.conflict.reviewNotes.length).toBe(2);
    expect(detail.body.history.some((h) => h.action === 'conflict.resolved')).toBe(true);
  });

  test('re-scanning neither duplicates conflicts nor reopens a resolved one', async () => {
    const before = await Conflict.countDocuments({});
    const res = await roads.post('/api/conflicts/scan');
    expect(res.status).toBe(200);
    expect(await Conflict.countDocuments({})).toBe(before); // duplicate prevention

    // The human decision survives a rescan: still resolved, still inactive.
    const stillClosed = await Conflict.findById(ids.conflict);
    expect(stillClosed.status).toBe('resolved');
    expect(stillClosed.isActive).toBe(false);
  });
});

describe('Citizen reports (privacy + accountability)', () => {
  const c1 = session();
  const c2 = session();
  const water = session();

  beforeAll(async () => {
    await c1.login('c1@test.local', 'TestPass123!');
    await c2.login('c2@test.local', 'TestPass123!');
    await water.login('water@test.local', 'TestPass123!');
  });

  test('citizen submits a report (201) and tracks it in /reports/mine', async () => {
    const res = await c1.post('/api/reports', {
      title: 'Broken slab outside the clinic',
      description: 'A loose slab wobbles when people step on it near the clinic entrance.',
      category: 'unsafe_condition', address: 'Clinic Road', ward: 'Ward 3',
    });
    expect(res.status).toBe(201);
    ids.report = res.body.report._id;

    const mine = await c1.get('/api/reports/mine');
    expect(mine.status).toBe(200);
    expect(mine.body.items.some((r) => String(r._id) === String(ids.report))).toBe(true);
  });

  test('validation: short title/description rejected with field details', async () => {
    const res = await c1.post('/api/reports', { title: 'hi', description: 'no', category: 'other', address: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  test('another citizen cannot read the report (403); the owner can (200)', async () => {
    expect((await c2.get(`/api/reports/${ids.report}`)).status).toBe(403);
    expect((await c1.get(`/api/reports/${ids.report}`)).status).toBe(200);
  });

  test('officials see the report but never the citizen email', async () => {
    const res = await water.get('/api/reports');
    expect(res.status).toBe(200);
    const found = res.body.items.find((r) => String(r._id) === String(ids.report));
    expect(found).toBeTruthy();
    expect(found.citizen).toHaveProperty('name');
    expect(found.citizen).not.toHaveProperty('email'); // PII stripped
    expect(JSON.stringify(res.body)).not.toContain('c1@test.local');
  });

  test('citizen cannot change report status (403); official can with a note', async () => {
    expect((await c1.patch(`/api/reports/${ids.report}/status`, { status: 'resolved' })).status).toBe(403);
    const bad = await water.patch(`/api/reports/${ids.report}/status`, { status: 'resolved' });
    expect(bad.status).toBe(400); // outcome note required
    const good = await water.patch(`/api/reports/${ids.report}/status`, { status: 'resolved', note: 'Slab re-laid on 12 Oct.' });
    expect(good.status).toBe(200);
    expect(good.body.report.status).toBe('resolved');
  });

  test('official response reaches the owner', async () => {
    const res = await water.patch(`/api/reports/${ids.report}/response`, { officialResponse: 'Repaired and inspected. Thank you for reporting.' });
    expect(res.status).toBe(200);
    const owner = await c1.get(`/api/reports/${ids.report}`);
    expect(owner.body.report.officialResponse).toContain('Repaired and inspected');
  });
});

describe('Analytics & audit consistency', () => {
  const admin = session();
  const citizen = session();
  beforeAll(async () => {
    await admin.login('admin@test.local', 'TestPass123!');
    await citizen.login('c1@test.local', 'TestPass123!');
  });

  test('summary totals equal the actual database counts', async () => {
    const res = await admin.get('/api/analytics/summary');
    expect(res.status).toBe(200);
    expect(res.body.totals.projects.total).toBe(await Project.countDocuments({}));
    expect(res.body.totals.reports.resolved).toBe(await CitizenReport.countDocuments({ status: 'resolved' }));
    expect(res.body.totals.departments).toBe(await Department.countDocuments({}));
  });

  test('charts endpoints return arrays for Chart.js', async () => {
    const res = await admin.get('/api/analytics/charts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statusDistribution)).toBe(true);
    expect(Array.isArray(res.body.departmentWorkload)).toBe(true);
  });

  test('impact endpoint carries the no-financial-claims disclaimer', async () => {
    const res = await admin.get('/api/analytics/impact');
    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toMatch(/not verified financial/i);
  });

  test('global audit log is admin-only and records the actions performed above', async () => {
    expect((await citizen.get('/api/audit')).status).toBe(403);
    const res = await admin.get('/api/audit?limit=100');
    expect(res.status).toBe(200);
    const actions = res.body.items.map((e) => e.action);
    expect(actions).toContain('project.schedule_revised');
    expect(actions).toContain('conflict.resolved');
    expect(actions).toContain('report.submitted');
    // No action may ever expose a password hash.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('project timeline endpoint returns the project’s own history', async () => {
    const res = await admin.get(`/api/audit/project/${ids.p1}`);
    expect(res.status).toBe(200);
    const actions = res.body.items.map((e) => e.action);
    expect(actions).toContain('project.created');
    expect(actions).toContain('project.schedule_revised');
  });
});

describe('Security headers & CORS', () => {
  test('helmet sets security headers on responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeTruthy();
  });

  test('requests from an unknown origin are refused', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
  });

  test('configured frontend origin is allowed', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
