// Shared labels and colour keys for statuses, categories, roles.
// Kept in one place so the UI stays consistent everywhere.

export const PROJECT_STATUS = {
  planned: { label: 'Planned', badge: 'planned' },
  active: { label: 'Active', badge: 'active' },
  delayed: { label: 'Delayed', badge: 'delayed' },
  completed: { label: 'Completed', badge: 'completed' },
  cancelled: { label: 'Cancelled', badge: 'cancelled' },
};

export const PROJECT_STATUS_OPTIONS = Object.entries(PROJECT_STATUS).map(
  ([value, meta]) => ({ value, label: meta.label })
);

export const PROJECT_CATEGORIES = {
  road: 'Road construction',
  drainage: 'Drainage',
  water_pipeline: 'Water pipeline',
  sewage: 'Sewage',
  electricity: 'Electricity',
  streetlight: 'Street lighting',
  telecom: 'Telecom',
  gas: 'Gas pipeline',
  other: 'Other',
};

export const REPORT_CATEGORIES = {
  damaged_road: 'Damaged road',
  stalled_construction: 'Stalled construction',
  poor_workmanship: 'Poorly completed work',
  drainage: 'Drainage problem',
  repeated_excavation: 'Repeated excavation',
  unsafe_condition: 'Unsafe construction condition',
  other: 'Other infrastructure issue',
};

export const REPORT_STATUS = {
  submitted: { label: 'Submitted', badge: 'submitted' },
  under_review: { label: 'Under review', badge: 'under_review' },
  assigned: { label: 'Assigned', badge: 'under_review' },
  in_progress: { label: 'In progress', badge: 'in_progress' },
  resolved: { label: 'Resolved', badge: 'completed' },
  rejected: { label: 'Rejected', badge: 'cancelled' },
};

export const CONFLICT_STATUS = {
  unreviewed: { label: 'Unreviewed', badge: 'unreviewed' },
  under_review: { label: 'Under review', badge: 'under_review' },
  resolved: { label: 'Resolved', badge: 'resolved' },
  dismissed: { label: 'Dismissed', badge: 'dismissed' },
};

export const CONFLICT_PRIORITY = {
  high: { label: 'High', badge: 'high' },
  medium: { label: 'Medium', badge: 'medium' },
  low: { label: 'Low', badge: 'low' },
};

export const ROLES = {
  citizen: 'Citizen',
  official: 'Official',
  administrator: 'Administrator',
};

export const DEPARTMENT_TYPES = {
  water: 'Water',
  roads: 'Roads',
  drainage: 'Drainage',
  electricity: 'Electricity',
  gas: 'Gas',
  telecom: 'Telecom',
  other: 'Other',
};

export const UPDATE_TYPES = {
  progress: 'Progress update',
  delay: 'Delay explanation',
  schedule_change: 'Schedule change',
  completion: 'Completion note',
  general: 'General notice',
};

// Leaflet marker colours by project status
export const STATUS_COLORS = {
  planned: '#14395c',
  active: '#14568f',
  delayed: '#9a6700',
  completed: '#157f4b',
  cancelled: '#5b6b7f',
};

export const FALLBACK_MAP_CENTER = [19.076, 72.8777]; // Mumbai
