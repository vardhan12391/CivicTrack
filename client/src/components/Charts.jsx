/**
 * Chart.js visualisations (the stack specifies Chart.js + react-chartjs-2).
 * Every chart receives data computed by the backend from the database —
 * no hard-coded numbers, so charts always match the dashboard totals.
 */
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** One palette for the whole app — colours follow the status meanings. */
export const STATUS_COLORS = {
  planned: '#5b7c99',
  active: '#0f766e',
  delayed: '#b45309',
  completed: '#2d6a4f',
  cancelled: '#9f1239',
  unreviewed: '#b45309',
  under_review: '#5b7c99',
  resolved: '#2d6a4f',
  dismissed: '#64748b',
};

const FALLBACK_COLOR = '#94a3b8';

function colorFor(label) {
  return STATUS_COLORS[String(label).toLowerCase()] || FALLBACK_COLOR;
}

const centerText = {
  // Keeps labels outside the doughnut on small screens.
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
  maintainAspectRatio: false,
};

/** Doughnut of { label, value } slices — used for project/conflict status. */
export function StatusDoughnut({ items = [], emptyLabel = 'No data yet' }) {
  if (!items.length) {
    return <div className="ct-chart d-flex align-items-center justify-content-center"><span className="ct-small ct-muted">{emptyLabel}</span></div>;
  }
  return (
    <div className="ct-chart">
      <Doughnut
        data={{
          labels: items.map((i) => i.label),
          datasets: [{
            data: items.map((i) => i.value),
            backgroundColor: items.map((i) => colorFor(i.label)),
            borderWidth: 1,
            borderColor: '#ffffff',
          }],
        }}
        options={centerText}
      />
    </div>
  );
}

/** Grouped bars: total projects per department vs. currently active ones. */
export function DepartmentBars({ items = [] }) {
  if (!items.length) {
    return <div className="ct-chart d-flex align-items-center justify-content-center"><span className="ct-small ct-muted">No departments yet</span></div>;
  }
  return (
    <div className="ct-chart">
      <Bar
        data={{
          labels: items.map((i) => i.label),
          datasets: [
            { label: 'Projects', data: items.map((i) => i.value), backgroundColor: '#5b7c99', borderRadius: 4 },
            { label: 'Active / delayed', data: items.map((i) => i.active ?? 0), backgroundColor: '#0f766e', borderRadius: 4 },
          ],
        }}
        options={{
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: {
            x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 0 } },
            y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 } },
          },
        }}
      />
    </div>
  );
}

/** Simple single-series bar — used for report categories. */
export function CategoryBars({ items = [], color = '#0f766e', emptyLabel = 'No data yet' }) {
  if (!items.length) {
    return <div className="ct-chart d-flex align-items-center justify-content-center"><span className="ct-small ct-muted">{emptyLabel}</span></div>;
  }
  return (
    <div className="ct-chart">
      <Bar
        data={{
          labels: items.map((i) => i.label),
        datasets: [{ label: 'Count', data: items.map((i) => i.value), backgroundColor: color, borderRadius: 4 }],
        }}
        options={{
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0, stepSize: 1 } },
            y: { ticks: { font: { size: 10 } } },
          },
        }}
      />
    </div>
  );
}
