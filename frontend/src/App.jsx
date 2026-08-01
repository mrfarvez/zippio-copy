import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './context/AuthContext';
import { RequireAuth, GuestOnly } from './components/layout/Guards';
import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';

import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import NotFound from './pages/NotFound';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Profile from './pages/Profile';
import Team from './pages/Team';
import Compare from './pages/Compare';
import Evaluate from './pages/Evaluate';
import Reports from './pages/Reports';
import HrEmployees from './pages/hr/HrEmployees';
import HrDepartments from './pages/hr/HrDepartments';
import HrKpis from './pages/hr/HrKpis';
import HrUsers from './pages/hr/HrUsers';
import HrAudit from './pages/hr/HrAudit';
import HrSettings from './pages/hr/HrSettings';

const STAFF = ['manager', 'hr', 'super-admin'];
const HR = ['hr', 'super-admin'];

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />

      <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="history" element={<History />} />
        <Route path="profile" element={<Profile />} />
        <Route path="team" element={<RequireAuth allow={STAFF}><Team /></RequireAuth>} />
        <Route path="compare" element={<RequireAuth allow={STAFF}><Compare /></RequireAuth>} />
        <Route path="evaluate" element={<RequireAuth allow={STAFF}><Evaluate /></RequireAuth>} />
        <Route path="reports" element={<RequireAuth allow={STAFF}><Reports /></RequireAuth>} />
        <Route path="hr/employees" element={<RequireAuth allow={HR}><HrEmployees /></RequireAuth>} />
        <Route path="hr/departments" element={<RequireAuth allow={HR}><HrDepartments /></RequireAuth>} />
        <Route path="hr/kpis" element={<RequireAuth allow={HR}><HrKpis /></RequireAuth>} />
        <Route path="hr/users" element={<RequireAuth allow={HR}><HrUsers /></RequireAuth>} />
        <Route path="hr/audit" element={<RequireAuth allow={HR}><HrAudit /></RequireAuth>} />
        <Route path="hr/settings" element={<RequireAuth allow={HR}><HrSettings /></RequireAuth>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
