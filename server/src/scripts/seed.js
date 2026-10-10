/**
 * ============================================================
 *  CivicTrack — repeatable demonstration seed
 * ============================================================
 *
 *  ALL DATA BELOW IS FICTIONAL DEMONSTRATION DATA.
 *  Names, departments, projects, reports and addresses are made up for the
 *  hackathon demo. Passwords are demo-only and clearly labelled — they must
 *  never be reused for real accounts.
 *
 *  `npm run seed` wipes the database and recreates everything, so the demo
 *  can be repeated reliably.
 *
 *  Expected RoadSync result after seeding (asserted by tests):
 *    • 3 ACTIVE conflicts:  MAIN-ROAD-01 (water × roads)
 *                           ELM-STREET-03 (drainage × electricity)
 *                           INDUSTRIAL-BYPASS-01 (telecom × roads)
 *    • 0 false positives: same-segment pairs that do NOT overlap
 *      (PARK-AVENUE-07, MARKET-LANE-05, HILL-VIEW-09, RIVER-ROAD-02)
 *      and same-department pairs are NOT flagged.
 *    • 2 overdue projects (delayed, deadline passed) with explanations.
 * ============================================================
 */

const bcrypt = require('bcryptjs');
const Department = require('../models/Department');
const User = require('../models/User');
const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const ProjectUpdate = require('../models/ProjectUpdate');
const CitizenReport = require('../models/CitizenReport');
const Conflict = require('../models/Conflict');
const AuditLog = require('../models/AuditLog');
const { detectConflicts } = require('../services/roadSyncService');
const { writeAudit } = require('../services/auditService');

/** UTC midnight date n days from today — keeps the demo valid whenever run. */
function day(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Clearly labelled demo accounts (documented in the README). */
const DEMO_ACCOUNTS = [
  { name: 'Demo Administrator', email: 'admin@civictrack.demo', password: 'DemoAdmin123!', role: 'administrator', departmentId: null },
  { name: 'Demo Water Officer', email: 'officer.water@civictrack.demo', password: 'DemoOfficial123!', role: 'official', department: 'water' },
  { name: 'Demo Roads Officer', email: 'officer.roads@civictrack.demo', password: 'DemoOfficial123!', role: 'official', department: 'roads' },
  { name: 'Demo Drainage Officer', email: 'officer.drainage@civictrack.demo', password: 'DemoOfficial123!', role: 'official', department: 'drainage' },
  { name: 'Demo Citizen Aisha', email: 'aisha@civictrack.demo', password: 'DemoCitizen123!', role: 'citizen', departmentId: null },
  { name: 'Demo Citizen Ravi', email: 'ravi@civictrack.demo', password: 'DemoCitizen123!', role: 'citizen', departmentId: null },
];

const DEPARTMENTS = [
  { key: 'water', name: 'Water Supply & Sewerage Department', departmentType: 'water', description: 'Fictional demonstration department — drinking water and sewer infrastructure.', contactEmail: 'water@civictrack.demo' },
  { key: 'roads', name: 'Roads & Transport Department', departmentType: 'roads', description: 'Fictional demonstration department — roads, footpaths and signage.', contactEmail: 'roads@civictrack.demo' },
  { key: 'drainage', name: 'Drainage & Flood Control Department', departmentType: 'drainage', description: 'Fictional demonstration department — storm drains and flood mitigation.', contactEmail: 'drainage@civictrack.demo' },
  { key: 'electricity', name: 'Electricity & Street Lighting Department', departmentType: 'electricity', description: 'Fictional demonstration department — cabling and streetlights.', contactEmail: 'electricity@civictrack.demo' },
  { key: 'telecom', name: 'Telecom Infrastructure Department', departmentType: 'telecom', description: 'Fictional demonstration department — fibre and duct infrastructure.', contactEmail: 'telecom@civictrack.demo' },
];

/** Shared road segments with plausible fictional coordinates (lng, lat). */
const SEGMENTS = {
  'MAIN-ROAD-01': { address: 'Main Road, Demonstration City', ward: 'Ward 4', point: { type: 'Point', coordinates: [78.482, 17.385] } },
  'ELM-STREET-03': { address: 'Elm Street, Demonstration City', ward: 'Ward 2', point: { type: 'Point', coordinates: [78.491, 17.393] } },
  'PARK-AVENUE-07': { address: 'Park Avenue, Demonstration City', ward: 'Ward 7', point: { type: 'Point', coordinates: [78.475, 17.401] } },
  'RIVER-ROAD-02': { address: 'River Road, Demonstration City', ward: 'Ward 3', point: { type: 'Point', coordinates: [78.468, 17.377] } },
  'MARKET-LANE-05': { address: 'Market Lane, Demonstration City', ward: 'Ward 5', point: { type: 'Point', coordinates: [78.495, 17.388] } },
  'HILL-VIEW-09': { address: 'Hill View Colony, Demonstration City', ward: 'Ward 9', point: { type: 'Point', coordinates: [78.46, 17.41] } },
  'INDUSTRIAL-BYPASS-01': { address: 'Industrial Bypass, Demonstration City', ward: 'Ward 11', point: { type: 'Point', coordinates: [78.505, 17.365] } },
  'CANAL-BANK-04': { address: 'Canal Bank Road, Demonstration City', ward: 'Ward 6', point: { type: 'Point', coordinates: [78.473, 17.37] } },
  'OLD-TOWN-11': { address: 'Old Town Road, Demonstration City', ward: 'Ward 1', point: { type: 'Point', coordinates: [78.487, 17.397] } },
};

/**
 * 16 fictional projects. Day offsets are relative to today so the demo
 * (overdue detection, active conflicts) works whenever the seed is run.
 */
const PROJECTS = [
  { key: 'water-main', dept: 'water', title: 'Main Road Water Main Replacement — Phase 2', category: 'water_pipeline', segment: 'MAIN-ROAD-01', start: -15, end: 15, status: 'active', budget: 4200000, contractor: 'AquaBuild (fictional)', officer: 'water',
    description: 'Replace 1.8 km of ageing water main along Main Road with DI pipes, including house connections and road reinstatement. Fictional demonstration project.' },
  { key: 'roads-resurface', dept: 'roads', title: 'Main Road Resurfacing Drive', category: 'road', segment: 'MAIN-ROAD-01', start: 2, end: 8, status: 'planned', budget: 2600000, contractor: 'SmoothWays Infra (fictional)', officer: 'roads',
    description: 'Asphalt resurfacing of Main Road between Junction 1 and Junction 4, with fresh road markings. Fictional demonstration project.' },
  { key: 'drain-elm', dept: 'drainage', title: 'Elm Street Storm Drain Upgrade', category: 'drainage', segment: 'ELM-STREET-03', start: -20, end: 26, status: 'active', budget: 3100000, contractor: 'HydroFlow Contractors (fictional)', officer: 'drainage',
    description: 'Enlarge Elm Street storm drains from 600 mm to 900 mm and clear three chronic blockage points before the next rainy season. Fictional demonstration project.' },
  { key: 'elec-elm', dept: 'electricity', title: 'Elm Street Underground Cable Laying', category: 'electricity', segment: 'ELM-STREET-03', start: -9, end: 21, status: 'active', budget: 2900000, contractor: 'CityPower EPC (fictional)', officer: null,
    description: 'Lay 2.2 km of 11 kV underground cable along Elm Street and remove sixteen overhead poles. Fictional demonstration project.' },
  { key: 'roads-park', dept: 'roads', title: 'Park Avenue Resurfacing', category: 'road', segment: 'PARK-AVENUE-07', start: 35, end: 48, status: 'planned', budget: 1850000, contractor: 'SmoothWays Infra (fictional)', officer: 'roads',
    description: 'Full-depth resurfacing of Park Avenue with kerb repairs and a new pedestrian crossing. Fictional demonstration project.' },
  { key: 'water-park', dept: 'water', title: 'Park Avenue Valve Replacement', category: 'water_pipeline', segment: 'PARK-AVENUE-07', start: 15, end: 26, status: 'planned', budget: 740000, contractor: 'AquaBuild (fictional)', officer: 'water',
    description: 'Replace eight crumbling isolation valves on Park Avenue so leaks can be shut off within minutes. Fictional demonstration project.' },
  { key: 'water-hill', dept: 'water', title: 'Hill View Colony Water Connection Program', category: 'water_pipeline', segment: 'HILL-VIEW-09', start: -60, end: -10, status: 'delayed', budget: 2200000, contractor: 'AquaBuild (fictional)', officer: 'water',
    explanation: 'Delayed by 3 weeks: the monsoon blocked trenching for 12 days and the scheduled pipe delivery arrived late. Revised completion expected shortly.',
    description: 'Provide individual household water connections to 240 homes in Hill View Colony. Fictional demonstration project.' },
  { key: 'roads-river-done', dept: 'roads', title: 'River Road Footpath Repair', category: 'road', segment: 'RIVER-ROAD-02', start: -100, end: -55, status: 'completed', budget: 1250000, contractor: 'PathMasons (fictional)', officer: 'roads',
    description: 'Rebuild 900 m of broken footpath along River Road with tactile paving at crossings. Fictional demonstration project.' },
  { key: 'drain-market', dept: 'drainage', title: 'Market Lane Culvert De-silting', category: 'drainage', segment: 'MARKET-LANE-05', start: -15, end: -2, status: 'delayed', budget: 680000, contractor: 'HydroFlow Contractors (fictional)', officer: 'drainage',
    explanation: 'Overdue: approvals for disposing silt at the designated yard were delayed by the vendor selection process. Work resumes this week.',
    description: 'Remove 600 cubic metres of silt from the Market Lane culvert and repair the retaining wall. Fictional demonstration project.' },
  { key: 'elec-market', dept: 'electricity', title: 'Market Lane Streetlight Replacement', category: 'streetlight', segment: 'MARKET-LANE-05', start: 10, end: 29, status: 'planned', budget: 990000, contractor: 'CityPower EPC (fictional)', officer: null,
    description: 'Replace 72 sodium streetlights with LED luminaires on Market Lane. Fictional demonstration project.' },
  { key: 'telecom-bypass', dept: 'telecom', title: 'Industrial Bypass Fibre Rollout', category: 'telecom', segment: 'INDUSTRIAL-BYPASS-01', start: -30, end: 60, status: 'active', budget: 5400000, contractor: 'NetSpan Telecom (fictional)', officer: null,
    description: 'Trench and duct 6 km of fibre along the Industrial Bypass to connect the industrial estate. Fictional demonstration project.' },
  { key: 'roads-bypass', dept: 'roads', title: 'Industrial Bypass Lighting Electrification', category: 'electricity', segment: 'INDUSTRIAL-BYPASS-01', start: 40, end: 55, status: 'planned', budget: 1750000, contractor: 'CityPower EPC (fictional)', officer: 'roads',
    description: 'Install 34 median light poles and feeder pillars along the Industrial Bypass. Fictional demonstration project.' },
  { key: 'roads-river-sb', dept: 'roads', title: 'River Road Speed Breaker Installation', category: 'road', segment: 'RIVER-ROAD-02', start: -5, end: 10, status: 'active', budget: 420000, contractor: 'PathMasons (fictional)', officer: 'roads',
    description: 'Install 18 speed breakers and advance warning signage near the River Road schools. Fictional demonstration project.' },
  { key: 'water-canal-done', dept: 'water', title: 'Canal Bank Sewer Line Repair', category: 'sewage', segment: 'CANAL-BANK-04', start: -90, end: -75, status: 'completed', budget: 1600000, contractor: 'AquaBuild (fictional)', officer: 'water',
    description: 'Repair a collapsed sewer section along Canal Bank Road and reinstate the roadway. Fictional demonstration project.' },
  { key: 'drain-hill', dept: 'drainage', title: 'Hill View Drain De-silting', category: 'drainage', segment: 'HILL-VIEW-09', start: -1, end: 20, status: 'active', budget: 560000, contractor: 'HydroFlow Contractors (fictional)', officer: 'drainage',
    description: 'Seasonal de-silting of the Hill View trunk drain and descaling of four inlet chambers. Fictional demonstration project.' },
  { key: 'elec-oldtown-cancelled', dept: 'electricity', title: 'Old Town Feeder Upgrade', category: 'electricity', segment: 'OLD-TOWN-11', start: -140, end: -120, status: 'cancelled', budget: 2400000, contractor: 'CityPower EPC (fictional)', officer: null,
    explanation: 'Cancelled after the load study showed the existing feeder has spare capacity; the allocated budget was returned to the pool.',
    description: 'Install a new 11 kV feeder for the Old Town quadrant to reduce outage hours. Fictional demonstration project.' },
];

/**
 * Seed the database. Wipes existing collections first so the script is
 * repeatable. Requires an open mongoose connection.
 */
async function seed({ wipe = true, log = true } = {}) {
  const say = (...a) => { if (log) console.log('[seed]', ...a); };

  if (wipe) {
    // Children first so referential logic stays simple.
    await Promise.all([
      Conflict.deleteMany({}), AuditLog.deleteMany({}), ProjectUpdate.deleteMany({}),
      Milestone.deleteMany({}), CitizenReport.deleteMany({}), Project.deleteMany({}),
      User.deleteMany({}), Department.deleteMany({}),
    ]);
    say('cleared previous data');
  }

  /* ---------- Departments ---------- */
  const deptDocs = await Department.create(DEPARTMENTS.map(({ key, ...d }) => d));
  const deptByKey = Object.fromEntries(DEPARTMENTS.map((d, i) => [d.key, deptDocs[i]]));
  say(`departments: ${deptDocs.length}`);

  /* ---------- Users (bcrypt-hashed demo passwords) ---------- */
  const hashCache = {};
  const hash = (pw) => (hashCache[pw] = hashCache[pw] || bcrypt.hashSync(pw, 10));
  const userDocs = [];
  for (const acct of DEMO_ACCOUNTS) {
    const deptId = acct.department ? deptByKey[acct.department]._id : null;
    userDocs.push(
      await User.create({ name: acct.name, email: acct.email, passwordHash: hash(acct.password), role: acct.role, departmentId: deptId })
    );
  }
  const userByEmail = Object.fromEntries(DEMO_ACCOUNTS.map((a, i) => [a.email, userDocs[i]]));
  const admin = userByEmail['admin@civictrack.demo'];
  const officer = (key) => (key ? userByEmail[`officer.${key}@civictrack.demo`] || admin : admin);
  say(`users: ${userDocs.length} (demo accounts, hashed passwords)`);

  /* ---------- Projects ---------- */
  const projectDocs = [];
  for (const p of PROJECTS) {
    const loc = SEGMENTS[p.segment];
    const doc = await Project.create({
      title: p.title,
      description: p.description,
      category: p.category,
      roadSegmentId: p.segment,
      location: loc,
      departmentId: deptByKey[p.dept]._id,
      assignedOfficerId: p.officer ? officer(p.officer)._id : null,
      contractorName: p.contractor,
      budget: p.budget,
      startDate: day(p.start),
      plannedEndDate: day(p.end),
      status: p.status,
      delayExplanation: p.explanation || '',
      createdBy: officer(p.officer)._id,
    });
    projectDocs.push(doc);
    await writeAudit({
      actor: { _id: officer(p.officer)._id, role: officer(p.officer).role },
      entityType: 'project',
      entityId: doc._id,
      action: 'project.created',
      newValues: { title: doc.title, status: doc.status, roadSegmentId: doc.roadSegmentId },
      explanation: 'Seed: fictional demonstration project created.',
    });
  }
  const projByKey = Object.fromEntries(PROJECTS.map((p, i) => [p.key, projectDocs[i]]));
  say(`projects: ${projectDocs.length}`);

  /* ---------- RoadSync scan → the conflicts the demo expects ---------- */
  const scan = await detectConflicts();
  say(`roadsync scan → created ${scan.created}, active conflicts ${scan.active}, candidate pairs ${scan.candidates}`);

  /* ---------- One historical RESOLVED conflict (resolution history demo) ---------- */
  // The Park Avenue pair once overlapped; the water team moved their valve work
  // earlier, so RoadSync no longer flags it. Kept (inactive) for its history.
  const parkPair = [projByKey['roads-park']._id, projByKey['water-park']._id].map(String).sort();
  const historical = await Conflict.create({
    projectIds: parkPair,
    conflictType: 'schedule_overlap',
    roadSegmentId: 'PARK-AVENUE-07',
    departmentIds: [deptByKey.roads._id, deptByKey.water._id],
    overlapStartDate: day(-40),
    overlapEndDate: day(-33),
    explanation: 'Historical demonstration conflict on PARK-AVENUE-07: both departments were originally scheduled on Park Avenue in the same week. The water team advanced their valve replacement, removing the overlap.',
    priority: 'medium',
    status: 'resolved',
    isActive: false,
    reviewNote: 'Water department moved valve work earlier — overlap cleared.',
    reviewNotes: [
      { status: 'under_review', note: 'Coordinating with the water department about sequencing.', by: userByEmail['officer.roads@civictrack.demo']._id, at: day(-42) },
      { status: 'resolved', note: 'Water department moved valve work earlier — overlap cleared.', by: userByEmail['officer.water@civictrack.demo']._id, at: day(-41) },
    ],
    reviewedBy: userByEmail['officer.roads@civictrack.demo']._id,
    resolution: 'Water department moved valve work earlier — overlap cleared.',
    resolvedBy: userByEmail['officer.water@civictrack.demo']._id,
    resolvedAt: day(-41),
    createdAt: day(-43),
  });
  await writeAudit({ actor: { _id: userByEmail['officer.roads@civictrack.demo']._id, role: 'official' }, entityType: 'conflict', entityId: historical._id, action: 'conflict.under_review', newValues: { status: 'under_review' }, explanation: 'Coordinating with the water department about sequencing.', });
  await writeAudit({ actor: { _id: userByEmail['officer.water@civictrack.demo']._id, role: 'official' }, entityType: 'conflict', entityId: historical._id, action: 'conflict.resolved', newValues: { status: 'resolved', roadSegmentId: 'PARK-AVENUE-07' }, explanation: 'Water department moved valve work earlier — overlap cleared.' });
  say('historical resolved conflict: 1');

  /* ---------- Milestones ---------- */
  await Milestone.create([
    { projectId: projByKey['water-main']._id, title: 'Trench approval obtained', dueDate: day(-12), status: 'completed', completedAt: day(-13), evidence: { caption: 'Approval letter received from the utility desk (demo evidence).', verified: false } },
    { projectId: projByKey['water-main']._id, title: 'Pipe delivery to site', dueDate: day(-5), status: 'completed', completedAt: day(-6), evidence: { caption: 'Delivery challan photographed at the site store (demo evidence).', verified: false } },
    { projectId: projByKey['water-main']._id, title: 'Section A pressure test', dueDate: day(9), status: 'in_progress' },
    { projectId: projByKey['drain-elm']._id, title: 'Blockage points cleared', dueDate: day(-8), status: 'completed', completedAt: day(-8), evidence: { caption: 'Three blockages cleared; sludge removal logged (demo evidence).', verified: false } },
    { projectId: projByKey['drain-elm']._id, title: '900 mm pipes laid — segment 1', dueDate: day(14), status: 'pending' },
    { projectId: projByKey['roads-river-done']._id, title: 'Footpath opened to public', dueDate: day(-58), status: 'completed', completedAt: day(-58), evidence: { caption: 'Final walk-through with the ward office (demo evidence).', verified: true } },
    { projectId: projByKey['roads-river-done']._id, title: 'Tactile paving installed', dueDate: day(-62), status: 'completed', completedAt: day(-62), evidence: { caption: 'Four crossings completed (demo evidence).', verified: false } },
  ]);
  say('milestones: 7');

  /* ---------- Project updates ---------- */
  await ProjectUpdate.create([
    { projectId: projByKey['water-main']._id, authorId: officer('water')._id, updateType: 'progress', message: 'Trenching complete for Section A; pipe laying begins tomorrow. Traffic is being managed with one-way diversions.' },
    { projectId: projByKey['drain-elm']._id, authorId: officer('drainage')._id, updateType: 'progress', message: 'Excavation reached design depth at blockage point 2. Work is on schedule despite the narrow street.' },
    { projectId: projByKey['water-hill']._id, authorId: officer('water')._id, updateType: 'delay', message: 'Monsoon rains stopped trenching for 12 days and the pipe shipment arrived late. Crews are now working extended shifts to recover.' },
    { projectId: projByKey['drain-market']._id, authorId: officer('drainage')._id, updateType: 'delay', message: 'Silt disposal approvals took longer than planned; the disposal yard selection is now confirmed and work resumes this week.' },
    { projectId: projByKey['roads-river-done']._id, authorId: officer('roads')._id, updateType: 'completion', message: 'Footpath handed over to the ward office after the final walk-through. All four crossings have tactile paving.' },
  ]);
  say('project updates: 5');

  /* ---------- Citizen reports (linked to relevant projects) ---------- */
  const aisha = userByEmail['aisha@civictrack.demo'];
  const ravi = userByEmail['ravi@civictrack.demo'];
  const reports = await CitizenReport.create([
    {
      title: 'Deep potholes outside the bus stop on Main Road', category: 'damaged_road',
      description: 'Three deep potholes right at the bus stop are forcing pedestrians into traffic. They have worsened after the recent water main work.',
      location: { address: 'Bus stop near Main Road Junction 2, Demonstration City', ward: 'Ward 4' },
      roadSegmentId: 'MAIN-ROAD-01', citizenId: aisha._id, linkedProjectId: projByKey['water-main']._id, status: 'under_review',
      statusHistory: [
        { status: 'submitted', changedBy: aisha._id, at: day(-6) },
        { status: 'under_review', changedBy: officer('roads')._id, note: 'Being assessed with the ongoing water main project.', at: day(-5) },
      ],
    },
    {
      title: 'Waterlogging across Elm Street after every rain', category: 'drainage',
      description: 'The whole street floods to ankle depth when it rains because the drain inlet is blocked. Please prioritise this before the next spell of rain.',
      location: { address: 'Elm Street crossing, Demonstration City', ward: 'Ward 2' },
      roadSegmentId: 'ELM-STREET-03', citizenId: ravi._id, linkedProjectId: projByKey['drain-elm']._id, status: 'in_progress',
      statusHistory: [
        { status: 'submitted', changedBy: ravi._id, at: day(-9) },
        { status: 'under_review', changedBy: officer('drainage')._id, at: day(-8) },
        { status: 'in_progress', changedBy: officer('drainage')._id, note: 'Linked to the storm drain upgrade; crew scheduled on site.', at: day(-7) },
      ],
      officialResponse: 'Your report is linked to the Elm Street Storm Drain Upgrade now underway. The crew clears the inlet this week.',
    },
    {
      title: 'Streetlight dark near the Market Lane corner', category: 'unsafe_condition',
      description: 'The corner by the vegetable market is completely dark after 8 pm and residents do not feel safe walking home.',
      location: { address: 'Market Lane corner, Demonstration City', ward: 'Ward 5' },
      roadSegmentId: 'MARKET-LANE-05', citizenId: aisha._id, linkedProjectId: null, status: 'submitted',
      statusHistory: [{ status: 'submitted', changedBy: aisha._id, at: day(-2) }],
    },
    {
      title: 'Sewer overflowing onto Canal Bank Road', category: 'other',
      description: 'A manhole on Canal Bank Road was overflowing regularly. It was fixed after the sewer repair work finished.',
      location: { address: 'Canal Bank Road near the bridge, Demonstration City', ward: 'Ward 6' },
      roadSegmentId: 'CANAL-BANK-04', citizenId: ravi._id, linkedProjectId: projByKey['water-canal-done']._id, status: 'resolved',
      statusHistory: [
        { status: 'submitted', changedBy: ravi._id, at: day(-85) },
        { status: 'under_review', changedBy: officer('water')._id, at: day(-84) },
        { status: 'resolved', changedBy: officer('water')._id, note: 'Collapsed section repaired and tested.', at: day(-74) },
      ],
      officialResponse: 'The collapsed sewer section was repaired, tested and the road reinstated. Thank you for reporting it.',
      resolutionNotes: 'Repaired under the Canal Bank Sewer Line Repair project.',
    },
    {
      title: 'Water connection work stopped halfway in Hill View', category: 'stalled_construction',
      description: 'Trenches have been open near our colony gate for weeks with no workers. Please confirm whether the connection work is still happening.',
      location: { address: 'Hill View Colony gate, Demonstration City', ward: 'Ward 9' },
      roadSegmentId: 'HILL-VIEW-09', citizenId: aisha._id, linkedProjectId: projByKey['water-hill']._id, status: 'assigned',
      statusHistory: [
        { status: 'submitted', changedBy: aisha._id, at: day(-4) },
        { status: 'assigned', changedBy: admin._id, note: 'Assigned to the Water department for a site response.', at: day(-3) },
      ],
    },
  ]);
  for (const r of reports) {
    await writeAudit({ actor: { _id: r.citizenId, role: 'citizen' }, entityType: 'report', entityId: r._id, action: 'report.submitted', newValues: { category: r.category, title: r.title }, explanation: 'Seed: fictional demonstration report.' });
  }
  say(`citizen reports: ${reports.length}`);

  const summary = {
    departments: deptDocs.length,
    users: userDocs.length,
    projects: projectDocs.length,
    activeConflicts: scan.active,
    historicalConflicts: 1,
    reports: reports.length,
    auditEntries: await AuditLog.countDocuments({}),
  };
  say('summary:', JSON.stringify(summary));
  say('demo accounts:', DEMO_ACCOUNTS.map((a) => `${a.role}: ${a.email} / ${a.password}`).join(' | '));
  return summary;
}

/* Standalone execution: `npm run seed` */
if (require.main === module) {
  const env = require('../config/env');
  const { connectDB, disconnectDB } = require('../config/db');
  (async () => {
    await connectDB();
    await seed({ wipe: true });
    await disconnectDB();
    console.log('[seed] done.');
    process.exit(0);
  })().catch((err) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
}

module.exports = { seed, DEMO_ACCOUNTS };
