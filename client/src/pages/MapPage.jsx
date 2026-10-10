import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApiData } from '../hooks/useApiData';
import { getMapProjects, listReports, listConflicts, listDepartments } from '../services/resource';
import { PageHeader, Card } from '../components/ui';
import { LoadingState, ErrorState, EmptyState } from '../components/States';
import StatusBadge from '../components/StatusBadge';
import { PROJECT_STATUS, PROJECT_CATEGORIES, REPORT_CATEGORIES, STATUS_COLORS, FALLBACK_MAP_CENTER } from '../utils/constants';
import { formatDate } from '../utils/format';

// Fix default marker icons for bundlers (Leaflet ships them as relative URLs).
const icon = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const projectIcon = (status) => icon(STATUS_COLORS[status] || '#14395c');
const reportIcon = icon('#b3261e');
const conflictIcon = L.divIcon({
  className: '',
  html: '<div style="font-size:20px;line-height:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">⚠️</div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function MapPage() {
  const [filters, setFilters] = useState({ departmentId: '', category: '', status: '' });

  const projects = useApiData(() => getMapProjects(filters), [filters.departmentId, filters.category, filters.status]);
  const reports = useApiData(() => listReports ? getMapReports() : Promise.resolve({ items: [] }), []);
  const conflicts = useApiData(() => listConflicts({ status: 'unreviewed' }), []);
  const departments = useApiData(listDepartments, []);

  const items = projects.data?.items || [];
  const reportItems = reports.data?.items || [];
  const conflictItems = conflicts.data?.items || [];

  const center = useMemo(() => {
    if (items.length > 0) {
      const first = items.find((p) => p.location?.point?.coordinates);
      if (first) return [first.location.point.coordinates[1], first.location.point.coordinates[0]];
    }
    return FALLBACK_MAP_CENTER;
  }, [items.length > 0 ? items[0]?._id : null]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="ct-container ct-page">
      <PageHeader
        eyebrow="Geographic view"
        title="Infrastructure map"
        description="Projects, citizen reports, and open coordination conflicts plotted from real database coordinates."
        actions={<span className="ct-simulated-flag">Fictional demonstration data · live from the database</span>}
      />

      <div className="ct-filters mb-3">
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label" htmlFor="m-dept">Department</label>
            <select id="m-dept" className="form-select" value={filters.departmentId} onChange={(e) => setFilter('departmentId', e.target.value)}>
              <option value="">All departments</option>
              {(departments.data?.items || departments.data || []).map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="m-cat">Category</label>
            <select id="m-cat" className="form-select" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(PROJECT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="m-status">Status</label>
            <select id="m-status" className="form-select" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(PROJECT_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>{meta.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button type="button" className="btn btn-ct-outline w-100" onClick={() => setFilters({ departmentId: '', category: '', status: '' })}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="ct-legend mb-3">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span className="ct-legend__item" key={status}>
            <span className="ct-legend__swatch" style={{ background: color, borderRadius: '50%' }} />
            {PROJECT_STATUS[status]?.label || status}
          </span>
        ))}
        <span className="ct-legend__item">
          <span className="ct-legend__swatch" style={{ background: '#b3261e', borderRadius: '50%' }} /> Citizen report
        </span>
        <span className="ct-legend__item">⚠ Open conflict</span>
      </div>

      {projects.loading && <Card><LoadingState label="Loading map data…" /></Card>}
      {projects.error && <Card><ErrorState error={projects.error} onRetry={projects.reload} /></Card>}
      {!projects.loading && !projects.error && items.length === 0 && (
        <Card>
          <EmptyState icon="🗺" title="No mapped projects match these filters" message="Adjust the filters above or seed the demonstration data." />
        </Card>
      )}

      {!projects.loading && !projects.error && items.length > 0 && (
        <div className="ct-map-frame">
          <MapContainer center={center} zoom={12} scrollWheelZoom={false}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {items.map((p) => {
              const coord = p.location?.point?.coordinates;
              if (!coord || coord.length < 2) return null;
              return (
                <Marker
                  key={p._id}
                  position={[coord[1], coord[0]]}
                  icon={projectIcon(p.status)}
                >
                  <Popup>
                    <div className="ct-map-popup">
                      <h6>{p.title}</h6>
                      <div className="mb-1">
                        <StatusBadge status={p.status} map={PROJECT_STATUS} />
                        {p.isOverdue && <StatusBadge status="overdue" label="Overdue" />}
                      </div>
                      <div className="ct-small">
                        {p.department?.name} · {PROJECT_CATEGORIES[p.category]}
                        <br />
                        🛣 {p.roadSegmentId}
                        <br />
                        {formatDate(p.startDate)} → {formatDate(p.revisedEndDate || p.plannedEndDate)}
                        <br />
                        <Link to={`/projects/${p._id}`}>View project details →</Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            {reportItems.map((r) => {
              const coord = r.location?.point?.coordinates || r.linkedProject?.location?.point?.coordinates;
              if (!coord || coord.length < 2) return null;
              return (
                <CircleMarker
                  key={r._id}
                  center={[coord[1], coord[0]]}
                  radius={7}
                  pathOptions={{ color: '#b3261e', fillOpacity: 0.75 }}
                >
                  <Popup>
                    <div className="ct-map-popup">
                      <h6>{r.title}</h6>
                      <div className="ct-small">
                        {REPORT_CATEGORIES[r.category] || r.category} · {r.status?.replace('_', ' ')}
                        <br />
                        {r.location?.address}
                        <br />
                        <Link to={r.linkedProject ? `/projects/${r.linkedProject._id}` : `/official/reports`}>
                          View details →
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
            {conflictItems.map((c) => {
              const coord = c.projectIds?.[0]?.location?.point?.coordinates;
              if (!coord) return null;
              return (
                <Marker key={c._id} position={[coord[1], coord[0]]} icon={conflictIcon}>
                  <Popup>
                    <div className="ct-map-popup">
                      <h6>⚠ Potential conflict on {c.roadSegmentId}</h6>
                      <div className="ct-small">
                        {c.explanation}
                        <br />
                        <Link to="/roadsync">Open RoadSync dashboard →</Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      <p className="ct-small ct-muted mt-3">
        Map data © OpenStreetMap contributors. Project coordinates are fictional demonstration
        locations inside a single demonstration city.
      </p>
    </div>
  );
}

// Citizen reports are official-facing on the API, so the public map only plots
// reports when the endpoint allows it; otherwise it silently shows none.
async function getMapReports() {
  try {
    const { data } = await listReports({ limit: 200, public: '1' });
    return data;
  } catch {
    return { items: [] };
  }
}
