import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../context/AuthContext';

const MAIN_LINKS = [
  { to: '/app', label: 'Dashboard', roles: ['employee', 'manager', 'hr', 'super-admin'] },
  { to: '/app/history', label: 'History', roles: ['employee', 'manager', 'hr', 'super-admin'] },
  { to: '/app/profile', label: 'Profile', roles: ['employee', 'manager', 'hr', 'super-admin'] },
  { to: '/app/team', label: 'Team', roles: ['manager', 'hr', 'super-admin'] },
  { to: '/app/compare', label: 'Compare', roles: ['manager', 'hr', 'super-admin'] },
  { to: '/app/evaluate', label: 'Evaluate', roles: ['manager', 'hr', 'super-admin'] },
  { to: '/app/reports', label: 'Reports', roles: ['manager', 'hr', 'super-admin'] },
];

const HR_LINKS = [
  { to: '/app/hr/employees', label: 'Employees' },
  { to: '/app/hr/departments', label: 'Departments' },
  { to: '/app/hr/kpis', label: 'KPIs' },
  { to: '/app/hr/users', label: 'Users' },
  { to: '/app/hr/audit', label: 'Audit' },
  { to: '/app/hr/settings', label: 'Settings' },
];

function Chip({ name, role }) {
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="user-chip">
      <span className="user-avatar">{initials}</span>
      <span className="user-meta">
        <span className="user-name" style={{ display: 'block' }}>{name}</span>
        <span className="user-role">{role.replace('-', ' ')}</span>
      </span>
    </div>
  );
}

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = MAIN_LINKS.filter((l) => !user || l.roles.includes(user.role));

  return (
    <>
      <nav className="topnav">
        <div className="wrap">
          <Link to={user ? ROLE_HOME[user.role] || '/app' : '/'} className="logo">
            <span className="logo-mark" /> Zippio
          </Link>

          {user && (
            <div className="nav-links">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}

          <div className="nav-right">
            {user ? (
              <>
                <Chip name={user.name} role={user.role} />
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <a href="/#how" className="nav-links" style={{ gap: 20 }}>
                  <span>How it works</span>
                  <span>Levels</span>
                </a>
                <Link to="/login" className="nav-cta">Sign in</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {user && (user.role === 'hr' || user.role === 'super-admin') && (
        <div className="subnav">
          <div className="wrap">
            {HR_LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
