export default function StatCard({ label, value, sub, tone, style }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={tone ? { color: tone, ...style } : style}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
