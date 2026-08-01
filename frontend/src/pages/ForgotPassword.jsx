import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/ui/Toast';

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    toast('Reset link sent to ' + email);
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo"><span className="logo"><span className="logo-mark" /> Zippio</span></div>
        <h2>Reset password</h2>
        <p className="auth-sub">We'll email you a reset link if the address exists.</p>

        {sent ? (
          <div className="form-ok" style={{ display: 'block' }}>Check <b>{email}</b> for the reset link.</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Email <span className="req">*</span></label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@zippio.io" />
            </div>
            <button className="btn-primary" style={{ width: '100%' }}>Send reset link</button>
          </form>
        )}

        <div className="auth-alt"><Link to="/login">Back to sign in</Link></div>
      </div>
    </div>
  );
}
