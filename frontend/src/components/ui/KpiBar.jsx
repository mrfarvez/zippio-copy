export function KpiRow({ name, value, color, max = 100 }) {
  return (
    <div className="kpi-row">
      <div className="kpi-name">{name}</div>
      <div className="kpi-track">
        <div className="kpi-fill" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </div>
      <div className="kpi-pct">{value}</div>
    </div>
  );
}

export function KpiBreakdown({ kpis, cycle }) {
  return (
    <div className="kpi-list">
      {kpis.map((k) => (
        <KpiRow key={k.key} name={k.name} value={cycle[k.key]} weight={k.weight} color={k.color} />
      ))}
    </div>
  );
}
