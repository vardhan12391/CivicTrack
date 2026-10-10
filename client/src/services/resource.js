import api from './api';

// ---------- Auth ----------
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (payload) => api.post('/auth/register', payload);
export const logout = () => api.post('/auth/logout');
export const me = () => api.get('/auth/me');

// ---------- Departments ----------
export const listDepartments = () => api.get('/departments');
export const createDepartment = (payload) => api.post('/departments', payload);
export const updateDepartment = (id, payload) => api.put(`/departments/${id}`, payload);
export const deleteDepartment = (id) => api.delete(`/departments/${id}`);

// ---------- Projects ----------
export const listProjects = (params) => api.get('/projects', { params });
export const getProject = (id) => api.get(`/projects/${id}`);
export const getProjectHistory = (id) => api.get(`/projects/${id}/history`);
export const getProjectUpdates = (id) => api.get(`/projects/${id}/updates`);
export const createProject = (payload) => api.post('/projects', payload);
export const updateProject = (id, payload) => api.put(`/projects/${id}`, payload);
export const updateProjectStatus = (id, payload) => api.patch(`/projects/${id}/status`, payload);
export const updateProjectSchedule = (id, payload) => api.patch(`/projects/${id}/schedule`, payload);
export const deleteProject = (id) => api.delete(`/projects/${id}`);
export const listOverdueProjects = () => api.get('/projects/overdue');
export const getMapProjects = (params) => api.get('/projects/map', { params });

// ---------- Milestones & updates ----------
export const createMilestone = (projectId, payload) =>
  api.post(`/projects/${projectId}/milestones`, payload);
export const updateMilestone = (id, payload) => api.patch(`/milestones/${id}`, payload);
export const createProjectUpdate = (projectId, payload) =>
  api.post(`/projects/${projectId}/updates`, payload);

// ---------- RoadSync conflicts ----------
export const listConflicts = (params) => api.get('/conflicts', { params });
export const getConflict = (id) => api.get(`/conflicts/${id}`);
export const scanConflicts = () => api.post('/conflicts/scan');
export const updateConflictStatus = (id, payload) => api.patch(`/conflicts/${id}/status`, payload);

// ---------- Citizen reports ----------
export const createReport = (payload) => api.post('/reports', payload);
export const listMyReports = () => api.get('/reports/mine');
export const listReports = (params) => api.get('/reports', { params });
export const getReport = (id) => api.get(`/reports/${id}`);
export const updateReportStatus = (id, payload) => api.patch(`/reports/${id}/status`, payload);
export const updateReportResponse = (id, payload) => api.patch(`/reports/${id}/response`, payload);
// Multipart photo upload (field name must be "image").
export const uploadReportImage = (id, formData) =>
  api.post(`/reports/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

// ---------- Analytics ----------
export const getSummary = () => api.get('/analytics/summary');
export const getCharts = () => api.get('/analytics/charts');
export const getImpact = () => api.get('/analytics/impact');

// ---------- Admin ----------
export const listUsers = (params) => api.get('/users', { params });
export const updateUser = (id, payload) => api.patch(`/users/${id}`, payload);
export const updateUserRole = (id, payload) => api.patch(`/users/${id}/role`, payload);
export const listAuditLogs = (params) => api.get('/audit', { params });
export const getEntityAudit = (entityType, entityId) =>
  api.get(`/audit/${entityType}/${entityId}`);

export default api;
