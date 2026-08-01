export function Card({ title, badge, className = '', children, style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {title != null && (
        <div className="card-title">
          <span>{title}</span>
          {badge != null && <span className="badge">{badge}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, className = '' }) {
  return <span className={`badge ${className}`}>{children}</span>;
}

export function Pill({ tone = 'idle', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function LevelPill({ level }) {
  return <Pill tone={String(level).toLowerCase()}>Level {level}</Pill>;
}
