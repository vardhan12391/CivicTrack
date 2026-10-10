import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

import Landing from './pages/Landing';
import PublicDashboard from './pages/PublicDashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import MapPage from './pages/MapPage';
import RoadSyncDashboard from './pages/RoadSyncDashboard';
import ConflictReview from './pages/ConflictReview';
import ReportSubmit from './pages/ReportSubmit';
import MyReports from './pages/MyReports';
import Login from './pages/Login';
import Register from './pages/Register';
import About from './pages/About';
import OfficialDashboard from './pages/OfficialDashboard';
import OfficialProjects from './pages/OfficialProjects';
import OfficialReports from './pages/OfficialReports';
import ProjectForm from './pages/ProjectForm';
import AdminUsers from './pages/AdminUsers';
import AdminAudit from './pages/AdminAudit';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AppLayout>
      <ErrorBoundary>
        <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<PublicDashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/roadsync" element={<RoadSyncDashboard />} />
        <Route path="/roadsync/:id" element={<ConflictReview />} />
        <Route path="/reports/new" element={<ReportSubmit />} />
        <Route path="/reports/mine" element={<MyReports />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/about" element={<About />} />

        {/* Official */}
        <Route
          path="/official"
          element={
            <ProtectedRoute officialOnly>
              <OfficialDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/official/projects"
          element={
            <ProtectedRoute officialOnly>
              <OfficialProjects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/official/projects/new"
          element={
            <ProtectedRoute officialOnly>
              <ProjectForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/official/projects/:id/edit"
          element={
            <ProtectedRoute officialOnly>
              <ProjectForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/official/reports"
          element={
            <ProtectedRoute officialOnly>
              <OfficialReports />
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/users" replace />}
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute adminOnly>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute adminOnly>
              <AdminAudit />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  </AppLayout>
  );
}
