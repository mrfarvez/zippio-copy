import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, ROLE_HOME } from '../context/AuthContext';
import { demoAccounts } from '../data/mock';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('farvez@zippio.io');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      const from = location.state?.from?.pathname;
      navigate(from || ROLE_HOME[user.role] || '/app', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"><span className="logo"><span className="logo-mark" /> Zippio</span></div>
        <h2>Welcome back</h2>
        <p className="auth-sub">Sign in to see your effort add up.</p>

        {error && <div className="form-err" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>Email <span className="req">*</span></label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label>Password <span className="req">*</span></label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn-primary" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="auth-alt"><Link to="/forgot-password">Forgot password?</Link></div>

        <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
          <div className="mono muted small" style={{ textAlign: 'center', marginBottom: 12 }}>DEMO ACCOUNTS — one tap to try</div>
          <div className="flex" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                className="btn-ghost btn-sm"
                onClick={async () => {
                  setEmail(a.email); setPassword(a.password);
                  try {
                    const user = await login(a.email, a.password);
                    navigate(ROLE_HOME[user.role] || '/app', { replace: true });
                  } catch (err) { setError(err.message); }
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="auth-meta">Zippio · demo frontend · Laravel backend pending</div>
      </div>
    </div>
  );
}
