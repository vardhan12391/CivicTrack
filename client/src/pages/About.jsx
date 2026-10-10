import { PageHeader, Card } from '../components/ui';

export default function About() {
  return (
    <div className="ct-container">
      <PageHeader
        eyebrow="About & methodology"
        title="How CivicTrack works"
        description="CivicTrack is a demonstration platform for public-works transparency and inter-department coordination. Every project, report, and conflict shown here is fictional demonstration data."
      />

      <div className="row g-4 pb-4">
        <div className="col-lg-8">
          <Card title="The problem" className="mb-4">
            <p>
              Residents regularly see roads being dug up, drains repaired, and pipelines laid —
              often without knowing what is happening, why, who is responsible, or when it will
              finish. Different departments and contractors handle the work, and they rarely share
              a single schedule.
            </p>
            <p className="mb-0">
              The result is scattered information, repeated excavation of the same road, delayed
              work without explanations, and no easy way for citizens to report problems or follow
              up.
            </p>
          </Card>

          <Card title="The solution" className="mb-4">
            <p>
              CivicTrack centralises infrastructure project information and layers three things on
              top of it:
            </p>
            <ol className="mb-0">
              <li>
                <strong>A public project directory</strong> — every project with its purpose,
                department, contractor, budget, planned dates, milestones, and progress updates.
              </li>
              <li>
                <strong>RoadSync</strong> — a deterministic conflict-detection engine that finds
                projects by different departments scheduled on the same road segment with
                overlapping dates, so officials can coordinate <em>before</em> the dig.
              </li>
              <li>
                <strong>Citizen feedback</strong> — report issues, link them to projects, and track
                the official response, all recorded in an append-only audit history.
              </li>
            </ol>
          </Card>

          <Card title="RoadSync methodology" className="mb-4">
            <p>RoadSync answers one question deterministically:</p>
            <div className="ct-explain mb-3">
              Are two projects from <strong>different departments</strong> scheduled on the{' '}
              <strong>same road segment</strong> with <strong>overlapping date ranges</strong>?
            </div>
            <p>The rules, in order:</p>
            <ol>
              <li>Compare only projects with different IDs.</li>
              <li>Compare only projects belonging to different departments.</li>
              <li>Normalise road segment IDs (upper-case, spaces to hyphens) before comparing.</li>
              <li>
                Detect overlap between <em>inclusive</em> date ranges:{' '}
                <code className="ct-mono">startA &lt;= endB &amp;&amp; startB &lt;= endA</code>
              </li>
              <li>Consider only planned and active projects — completed and cancelled work is ignored.</li>
              <li>Unrelated road segments never conflict, no matter the dates.</li>
              <li>Every detection produces a written explanation naming both projects, both departments, the shared segment, and the overlap window.</li>
            </ol>
            <p className="mb-0">
              Conflicts are <strong>potential conflicts</strong>: they are suggestions for human
              review, never automatic reschedules. An authorised official reviews each one, adds a
              note, and either resolves it (possibly after changing a schedule with a documented
              reason) or dismisses it with an explanation. All of it is recorded in the audit
              history.
            </p>
          </Card>

          <Card title="Known limitations" className="mb-4">
            <ul className="mb-0">
              <li>
                <strong>Demonstration data only.</strong> CivicTrack is not connected to any real
                government department, tender system, or GIS source.
              </li>
              <li>
                <strong>Segment identity, not geometry.</strong> RoadSync matches normalised
                segment IDs. It does not detect that two differently-named segments physically
                overlap.
              </li>
              <li>
                <strong>Day-precision dates in UTC.</strong> Schedules are calendar dates compared
                in UTC so behaviour is identical in every timezone; sub-day timing is out of scope.
              </li>
              <li>
                <strong>Evidence is submitted, not verified.</strong> A photograph attached to a
                progress update proves an image was uploaded — not that physical work was
                independently inspected. Unverified evidence is labelled as such.
              </li>
            </ul>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card title="Technology" className="mb-4">
            <ul className="mb-0 ct-small">
              <li>React 18 + Vite + React Router</li>
              <li>Bootstrap 5 + custom CSS design system</li>
              <li>Chart.js · React Leaflet (OpenStreetMap)</li>
              <li>Node.js + Express REST API</li>
              <li>MongoDB (Mongoose ODM)</li>
              <li>JWT in httpOnly cookies + CSRF double-submit</li>
              <li>bcrypt password hashing</li>
            </ul>
          </Card>
          <Card title="Roles">
            <p className="ct-small">
              <strong>Citizen</strong> — view projects, submit and track reports.
            </p>
            <p className="ct-small">
              <strong>Official</strong> — manage their department’s projects, publish updates,
              review reports and RoadSync conflicts.
            </p>
            <p className="ct-small mb-0">
              <strong>Administrator</strong> — manage users and departments, inspect the full
              audit history, system-wide analytics.
            </p>
          </Card>
          <Card title="Data honesty">
            <p className="ct-small mb-0">
              All statistics on this site are computed live from the database. Nothing is
              hard-coded, and no claim of money saved or excavation prevented is made without
              verified evidence.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
