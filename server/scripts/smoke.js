/**
 * End-to-end smoke test against a RUNNING CivicTrack API.
 *   node scripts/smoke.js            (expects http://localhost:4000/api)
 *   API_BASE=http://host/api node scripts/smoke.js
 *
 * Covers: health, public reads, login/CSRF, role-based access control,
 * project CRUD + department scoping, schedule-revision accountability,
 * RoadSync scan/resolve flow, citizen report privacy, audit history.
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/api';

/** Minimal cookie-jar HTTP session (httpOnly cookies + CSRF double-submit). */
class Session {
  constructor(label) {
    this.label = label;
    this.cookies = {};
  }

  cookieHeader() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  async request(method, path, body) {
    const headers = { cookie: this.cookieHeader() };
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (method !== 'GET' && this.cookies.ct_csrf) headers['x-csrf-token'] = this.cookies.ct_csrf;
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const sc of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
      const [pair] = sc.split(';');
      const eq = pair.indexOf('=');
      this.cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
    }
    let data = null;
    try { data = await res.json(); } catch { /* no body */ }
    return { status: res.status, data };
  }
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const anon = new Session('anon');
  const admin = new Session('admin');
  const water = new Session('water');
  const roads = new Session('roads');
  const citizenA = new Session('citizenA');
  const citizenB = new Session('citizenB');

  /* ---------- 1. Health + public reads ---------- */
  const health = await anon.request('GET', '/health');
  check('GET /health', health.status === 200 && health.data.db === 'connected', `db=${health.data.db}`);

  const projects = await anon.request('GET', '/projects?limit=50');
  const totalProjects = projects.data?.total ?? 0;
  check('public project list', projects.status === 200 && totalProjects >= 16, `total=${totalProjects}`);

  const conflicts = await anon.request('GET', '/conflicts');
  const s = conflicts.data?.summary || {};
  check('public conflict list', conflicts.status === 200 && s.total === 4 && s.unreviewed === 3 && s.resolved === 1,
    `total=${s.total} unreviewed=${s.unreviewed} resolved=${s.resolved}`);

  const summary = await anon.request('GET', '/analytics/summary');
  check('analytics summary matches DB',
    summary.status === 200 && summary.data.totals.projects.total === totalProjects,
    `projects=${summary.data?.totals?.projects?.total}`);

  const overdue = await anon.request('GET', '/projects/overdue');
  check('overdue projects listed', overdue.status === 200 && overdue.data.total === 2,
    `overdue=${overdue.data?.total}`);

  const map = await anon.request('GET', '/projects/map');
  check('map projects have coordinates', map.status === 200 && map.data.items.every((p) => p.location?.point?.coordinates),
    `items=${map.data?.total}`);

  /* ---------- 2. Authentication + CSRF ---------- */
  const badLogin = await anon.request('POST', '/auth/login', { email: 'admin@civictrack.demo', password: 'wrong-password' });
  check('wrong password rejected', badLogin.status === 401);

  await admin.request('POST', '/auth/login', { email: 'admin@civictrack.demo', password: 'DemoAdmin123!' });
  const me = await admin.request('GET', '/auth/me');
  check('admin login + session', me.status === 200 && me.data.user.role === 'administrator', `role=${me.data?.user?.role}`);

  // CSRF: same cookies, but no x-csrf-token header on a mutation.
  const noCsrf = await fetch(BASE + '/auth/logout', { method: 'POST', headers: { cookie: admin.cookieHeader() } });
  check('mutation without CSRF header rejected', noCsrf.status === 403, `status=${noCsrf.status}`);

  await admin.request('POST', '/auth/login', { email: 'admin@civictrack.demo', password: 'DemoAdmin123!' }); // restore session

  /* ---------- 3. Role-based access control ---------- */
  await citizenA.request('POST', '/auth/login', { email: 'aisha@civictrack.demo', password: 'DemoCitizen123!' });
  const citizenUsers = await citizenA.request('GET', '/users');
  check('citizen cannot list users', citizenUsers.status === 403, `status=${citizenUsers.status}`);

  const anonCreate = await anon.request('POST', '/projects', {});
  check('anonymous cannot create project', anonCreate.status === 401, `status=${anonCreate.status}`);

  await water.request('POST', '/auth/login', { email: 'officer.water@civictrack.demo', password: 'DemoOfficial123!' });
  await roads.request('POST', '/auth/login', { email: 'officer.roads@civictrack.demo', password: 'DemoOfficial123!' });

  const depts = await anon.request('GET', '/departments');
  const deptByKey = Object.fromEntries((depts.data.items || []).map((d) => [d.departmentType, d]));
  const waterDept = deptByKey.water;
  const roadsDept = deptByKey.roads;

  // Officer may only create projects for their OWN department.
  const crossDept = await water.request('POST', '/projects', {
    title: 'Cross department attempt should fail',
    description: 'This request must be rejected because the officer belongs to another department.',
    category: 'road', roadSegmentId: 'TEST-SEGMENT-99', departmentId: roadsDept._id,
    startDate: '2026-12-01', plannedEndDate: '2026-12-05',
  });
  check('official blocked from other department', crossDept.status === 403, `status=${crossDept.status}`);

  /* ---------- 4. Project create + RoadSync re-evaluation ---------- */
  const created = await water.request('POST', '/projects', {
    title: 'Water Department Test Connection Work',
    description: 'A short-lived demonstration project used by the smoke test suite.',
    category: 'water_pipeline', roadSegmentId: 'TEST-SEGMENT-99', departmentId: waterDept._id,
    startDate: '2026-12-01', plannedEndDate: '2026-12-10',
    location: { address: 'Test street', ward: 'Ward 99', point: { coordinates: [78.48, 17.39] } },
  });
  check('official creates own-department project', created.status === 201, `status=${created.status} id=${created.data?.project?._id}`);
  const testProjectId = created.data?.project?._id;

  // Now a roads project overlapping the SAME segment and window → RoadSync must flag it.
  const clashing = await roads.request('POST', '/projects', {
    title: 'Roads Department Test Resurfacing Work',
    description: 'Overlaps the water department test project on the same road segment on purpose.',
    category: 'road', roadSegmentId: 'test-segment-99', departmentId: roadsDept._id,
    startDate: '2026-12-03', plannedEndDate: '2026-12-08',
  });
  check('RoadSync flags new overlap on create',
    clashing.status === 201 && clashing.data.roadSync?.created === 1,
    `created=${clashing.data?.roadSync?.created} active=${clashing.data?.roadSync?.active}`);
  const clashProjectId = clashing.data?.project?._id;

  /* ---------- 5. Schedule revision requires a reason ---------- */
  const noReason = await water.request('PATCH', `/projects/${testProjectId}/schedule`, { revisedEndDate: '2026-12-20' });
  check('schedule revision without reason rejected', noReason.status === 400, `status=${noReason.status}`);

  const withReason = await water.request('PATCH', `/projects/${testProjectId}/schedule`, {
    revisedEndDate: '2026-12-20',
    reason: 'Pipe delivery shifted by one week; revised to keep the road open for the festival.',
  });
  check('schedule revision with reason accepted', withReason.status === 200, `status=${withReason.status}`);

  // Conflict on that segment should now show for review; resolve it as roads officer.
  const segConflicts = await anon.request('GET', '/conflicts?roadSegmentId=TEST-SEGMENT-99');
  const newConflict = (segConflicts.data.items || []).find((c) => c.isActive);
  check('new conflict visible publicly', !!newConflict, `id=${newConflict?._id}`);

  if (newConflict) {
    const reviewed = await roads.request('PATCH', `/conflicts/${newConflict._id}/status`, {
      status: 'under_review', reviewNote: 'Checking sequencing with the water team.',
    });
    check('official starts review', reviewed.status === 200 && reviewed.data.conflict.status === 'under_review');

    const resolved = await roads.request('PATCH', `/conflicts/${newConflict._id}/status`, {
      status: 'resolved', resolution: 'Water team shifted to week 2; roads will resurface afterwards. Both confirmed in writing.',
    });
    check('conflict resolved with documented resolution', resolved.status === 200 && resolved.data.conflict.status === 'resolved');

    const again = await roads.request('PATCH', `/conflicts/${newConflict._id}/status`, {
      status: 'resolved', resolution: 'duplicate attempt',
    });
    check('closed conflict cannot be re-closed', again.status === 409, `status=${again.status}`);

    const detail = await anon.request('GET', `/conflicts/${newConflict._id}`);
    check('conflict detail includes history', detail.status === 200 && (detail.data.history || []).length >= 2,
      `history=${detail.data?.history?.length}`);
  }

  /* ---------- 6. Citizen report privacy ---------- */
  const report = await citizenA.request('POST', '/reports', {
    title: 'Smoke test pothole report', description: 'A pothole opened up near the community hall entrance.',
    category: 'damaged_road', address: 'Community hall, Test Road', ward: 'Ward 4',
  });
  const reportId = report.data?.report?._id;
  check('citizen submits report', report.status === 201, `id=${reportId}`);

  await citizenB.request('POST', '/auth/login', { email: 'ravi@civictrack.demo', password: 'DemoCitizen123!' });
  const peek = await citizenB.request('GET', `/reports/${reportId}`);
  check('other citizen cannot read report', peek.status === 403, `status=${peek.status}`);

  const mine = await citizenA.request('GET', '/reports/mine');
  check('owner sees own report', mine.status === 200 && mine.data.items.some((r) => String(r._id) === String(reportId)));

  const responded = await water.request('PATCH', `/reports/${reportId}/response`, {
    officialResponse: 'Scheduled with the roads crew for this month; thank you for flagging it.',
  });
  check('official responds to report', responded.status === 200);

  const closed = await water.request('PATCH', `/reports/${reportId}/status`, { status: 'resolved', note: 'Pothole patched and compacted.' });
  check('report closed with note', closed.status === 200 && closed.data.report.status === 'resolved');

  const missingNote = await water.request('PATCH', `/reports/${reportId}/status`, { status: 'rejected' });
  check('resolve/reject without note rejected', missingNote.status === 400, `status=${missingNote.status}`);

  /* ---------- 7. Audit history ---------- */
  const audit = await admin.request('GET', '/audit?limit=100');
  const actions = (audit.data.items || []).map((e) => e.action);
  const needed = ['project.created', 'project.schedule_revised', 'conflict.under_review', 'conflict.resolved', 'report.submitted', 'report.responded'];
  check('audit contains required actions',
    audit.status === 200 && needed.every((a) => actions.includes(a)),
    `missing=${needed.filter((a) => !actions.includes(a)).join(',') || 'none'}`);

  const timeline = await water.request('GET', `/audit/project/${testProjectId}`);
  const tlActions = (timeline.data.items || []).map((e) => e.action);
  check('per-entity timeline includes creation + revision',
    timeline.status === 200 && tlActions.includes('project.created') && tlActions.includes('project.schedule_revised'),
    `actions=${tlActions.join(',')}`);

  const citizenAudit = await citizenA.request('GET', '/audit');
  check('citizen cannot read global audit', citizenAudit.status === 403, `status=${citizenAudit.status}`);

  /* ---------- 8. Cleanup: remove the two smoke-test projects ---------- */
  if (clashProjectId) await admin.request('DELETE', `/projects/${clashProjectId}`);
  if (testProjectId) await admin.request('DELETE', `/projects/${testProjectId}`);
  const after = await anon.request('GET', '/projects?limit=1');
  check('cleanup restored project count', after.data?.total === totalProjects, `total=${after.data?.total}`);

  /* ---------- Summary ---------- */
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join(' | '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE SCRIPT ERROR:', err);
  process.exit(1);
});
