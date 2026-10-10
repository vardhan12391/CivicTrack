/**
 * RoadSync engine — pure unit tests (no database required).
 * Each test maps to one documented rule of the conflict engine.
 */
const {
  compareProjects,
  overlapWindow,
  overlapDays,
  priorityFor,
  toUtcDay,
} = require('../src/services/roadSyncService');
const { normalizeRoadSegment } = require('../src/models/Project');

/** Build a minimal project-like object. */
let n = 0;
function proj(overrides = {}) {
  n += 1;
  return {
    _id: `p${n}`,
    title: 'Test project',
    category: 'road',
    roadSegmentId: 'MAIN-ROAD-01',
    departmentId: `dept-${n}`,
    status: 'active',
    startDate: new Date('2026-06-01T00:00:00Z'),
    plannedEndDate: new Date('2026-06-20T00:00:00Z'),
    revisedEndDate: null,
    department: { name: 'Test Department' },
    ...overrides,
  };
}

describe('overlapWindow (rule 4: inclusive overlap)', () => {
  const d = (s) => new Date(`${s}T00:00:00Z`);

  test('clearly overlapping ranges produce the shared window', () => {
    const w = overlapWindow(d('2026-06-01'), d('2026-06-20'), d('2026-06-10'), d('2026-06-30'));
    expect(w).toEqual({ start: d('2026-06-10'), end: d('2026-06-20') });
  });

  test('touching endpoints still overlap (inclusive)', () => {
    const w = overlapWindow(d('2026-06-01'), d('2026-06-10'), d('2026-06-10'), d('2026-06-15'));
    expect(w).toEqual({ start: d('2026-06-10'), end: d('2026-06-10') });
    expect(overlapDays(w.start, w.end)).toBe(1); // same day counts as one day
  });

  test('disjoint ranges produce no window', () => {
    expect(overlapWindow(d('2026-06-01'), d('2026-06-10'), d('2026-06-11'), d('2026-06-15'))).toBeNull();
  });

  test('missing dates produce no window', () => {
    expect(overlapWindow(null, d('2026-06-10'), d('2026-06-01'), d('2026-06-15'))).toBeNull();
    expect(overlapWindow(d('2026-06-01'), d('2026-06-10'), d('2026-06-01'), null)).toBeNull();
  });

  test('overlapDays counts calendar days inclusively', () => {
    expect(overlapDays(d('2026-06-10'), d('2026-06-20'))).toBe(11);
  });
});

describe('priorityFor', () => {
  test('7+ days → high, 3–6 → medium, 1–2 → low', () => {
    expect(priorityFor(7)).toBe('high');
    expect(priorityFor(30)).toBe('high');
    expect(priorityFor(3)).toBe('medium');
    expect(priorityFor(6)).toBe('medium');
    expect(priorityFor(1)).toBe('low');
    expect(priorityFor(2)).toBe('low');
  });
});

describe('compareProjects rules', () => {
  test('RULE 1: the same project never conflicts with itself', () => {
    const a = proj();
    expect(compareProjects(a, a)).toBeNull();
  });

  test('RULE 2: same department on the same segment is NOT a coordination conflict', () => {
    const a = proj({ departmentId: 'dept-x' });
    const b = proj({ departmentId: 'dept-x', _id: 'other' });
    expect(compareProjects(a, b)).toBeNull();
  });

  test('RULE 3: segment comparison is case-insensitive', () => {
    const a = proj({ roadSegmentId: 'main-road-01', departmentId: 'd1' });
    const b = proj({ roadSegmentId: 'MAIN-ROAD-01', departmentId: 'd2', _id: 'x2' });
    expect(compareProjects(a, b)).not.toBeNull();
  });

  test('RULE 3: normalizeRoadSegment makes spellings equivalent', () => {
    expect(normalizeRoadSegment('main road 01')).toBe('MAIN-ROAD-01');
    expect(normalizeRoadSegment(' Main__Road--01 ')).toBe('MAIN-ROAD-01');
    expect(normalizeRoadSegment('main-road-01')).toBe('MAIN-ROAD-01');
  });

  test('RULE 4: different departments + same segment + overlapping dates → conflict with correct window', () => {
    const a = proj({ departmentId: 'water', roadSegmentId: 'SEG-1', startDate: new Date('2026-06-01'), plannedEndDate: new Date('2026-06-20') });
    const b = proj({ departmentId: 'roads', roadSegmentId: 'SEG-1', startDate: new Date('2026-06-15'), plannedEndDate: new Date('2026-06-30') });
    const c = compareProjects(a, b);
    expect(c).not.toBeNull();
    expect(c.roadSegmentId).toBe('SEG-1');
    expect(c.overlapStartDate.toISOString().slice(0, 10)).toBe('2026-06-15');
    expect(c.overlapEndDate.toISOString().slice(0, 10)).toBe('2026-06-20');
    expect(c.overlapDays).toBe(6);
    expect(c.priority).toBe('medium');
    expect(c.explanation).toContain('SEG-1');
    // Canonical ordering keeps the pair key stable regardless of argument order.
    expect(compareProjects(b, a).projectIds).toEqual(c.projectIds);
  });

  test('RULE 4: same segment but disjoint schedules → no conflict (false-positive check)', () => {
    const a = proj({ departmentId: 'water', roadSegmentId: 'SEG-2', startDate: new Date('2026-06-01'), plannedEndDate: new Date('2026-06-10') });
    const b = proj({ departmentId: 'roads', roadSegmentId: 'SEG-2', startDate: new Date('2026-06-12'), plannedEndDate: new Date('2026-06-20') });
    expect(compareProjects(a, b)).toBeNull();
  });

  test('RULE 5: completed and cancelled projects are not scheduled work', () => {
    const a = proj({ departmentId: 'water', status: 'completed' });
    const b = proj({ departmentId: 'roads', status: 'active' });
    expect(compareProjects(a, b)).toBeNull();
    a.status = 'cancelled';
    expect(compareProjects(a, b)).toBeNull();
  });

  test('RULE 5: planned, active and delayed all count as scheduled work', () => {
    for (const status of ['planned', 'active', 'delayed']) {
      const a = proj({ departmentId: 'water', status });
      const b = proj({ departmentId: 'roads', status: 'active' });
      expect(compareProjects(a, b)).not.toBeNull();
    }
  });

  test('RULE 6: different road segments never conflict', () => {
    const a = proj({ departmentId: 'water', roadSegmentId: 'SEG-A' });
    const b = proj({ departmentId: 'roads', roadSegmentId: 'SEG-B' });
    expect(compareProjects(a, b)).toBeNull();
  });

  test('revisedEndDate shrinks the effective window (moved out of overlap → no conflict)', () => {
    const a = proj({ departmentId: 'water', startDate: new Date('2026-06-01'), plannedEndDate: new Date('2026-06-20') });
    const b = proj({
      departmentId: 'roads',
      startDate: new Date('2026-06-15'),
      plannedEndDate: new Date('2026-06-30'),
      revisedEndDate: new Date('2026-06-14'), // pulled earlier with a documented reason
    });
    expect(compareProjects(a, b)).toBeNull();
  });

  test('department given as populated object or plain id both work', () => {
    const a = proj({ departmentId: { _id: 'dept-1' } });
    const b = proj({ departmentId: 'dept-2' });
    expect(compareProjects(a, b)).not.toBeNull();
    const same = proj({ departmentId: { _id: 'dept-1' }, _id: 'other' });
    expect(compareProjects(a, same)).toBeNull();
  });
});

describe('toUtcDay', () => {
  test('normalises timestamps to UTC midnight', () => {
    expect(toUtcDay(new Date('2026-06-15T18:30:00Z')).toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(toUtcDay('2026-06-15T00:00:00Z').toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(toUtcDay(null)).toBeNull();
    expect(toUtcDay('not-a-date')).toBeNull();
  });
});
