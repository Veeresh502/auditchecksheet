import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Login from './pages/auth/Login';
// We will create these pages next
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import L1Dashboard from './pages/l1/MyTasks';
import L2Dashboard from './pages/l2/Inbox';
import OwnerDashboard from './pages/owner/MyNCs';
import 'bootstrap/dist/css/bootstrap.min.css';
import Unauthorized from './pages/auth/Unauthorized';
import DashboardLayout from './components/layout/DashboardLayout';
import AuditWorkspace from './pages/l1/AuditWorkspace';
import NCResolution from './pages/owner/NCResolution';
import ScoringWorkspace from './pages/l2/ScoringWorkspace';
import DockAuditPlan from './pages/admin/DockAuditPlan';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import ScheduleAudit from './pages/admin/ScheduleAudit';
import DockAnalytics from './pages/admin/DockAnalytics';
import ManufacturingProductAuditPlan from './pages/admin/ManufacturingProductAuditPlan';
import TemplateManagement from './pages/admin/TemplateManagement';
import NCHistory from './pages/admin/NCHistory';

function App() {
  return (
    <AuthProvider>
      <ToastContainer position="top-right" autoClose={3000} />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<UserManagement />} /> {/* <--- NEW */}
              <Route path="/admin/schedule" element={<ScheduleAudit />} /> {/* <--- NEW */}
              <Route path="/admin/audit/:id" element={<AuditWorkspace />} />
              <Route path="/admin/dock-plan" element={<DockAuditPlan />} />
              <Route path="/admin/mfg-plan" element={<ManufacturingProductAuditPlan />} />
              <Route path="/admin/analytics" element={<DockAnalytics />} />
              <Route path="/admin/templates" element={<TemplateManagement />} />
              <Route path="/admin/nc-history" element={<NCHistory />} />
            </Route>
            {/* Add Schedule / User routes here */}
          </Route>

          {/* L1 Routes */}
          <Route element={<ProtectedRoute allowedRoles={['L1_Auditor', 'Admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/l1/tasks" element={<L1Dashboard />} />
              <Route path="/l1/audit/:id" element={<AuditWorkspace />} />
            </Route>
            {/* Add Audit Workspace route here */}
          </Route>

          {/* L2 Routes */}
          <Route element={<ProtectedRoute allowedRoles={['L2_Auditor', 'Admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/l2/inbox" element={<L2Dashboard />} />
              <Route path="/l2/audit/:id" element={<ScoringWorkspace />} /> {/* Reuse the same URL structure or make unique */}
            </Route>
          </Route>

          {/* Owner Routes */}
          <Route element={<ProtectedRoute allowedRoles={['Process_Owner', 'Admin']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/owner/tasks" element={<OwnerDashboard />} />
              <Route path="/owner/resolve/:id" element={<NCResolution />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;