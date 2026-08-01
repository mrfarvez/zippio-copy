import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, ROLE_HOME } from '../../context/AuthContext';

export function RequireAuth({ children, allow }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/app'} replace />;
  }
  return children;
}

export function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={ROLE_HOME[user.role] || '/app'} replace />;
  return children;
}
