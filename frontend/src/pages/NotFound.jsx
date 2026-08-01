import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="eyebrow" style={{ justifyContent: 'center' }}>404</div>
        <h2>Page not found</h2>
        <p className="auth-sub">That path doesn't lead anywhere in Zippio.</p>
        <Link to="/" className="btn-primary" style={{ display: 'inline-block' }}>Back home</Link>
      </div>
    </div>
  );
}
