import PageHead from '../components/ui/PageHead';
import StatCard from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import DoughnutChart from '../components/charts/DoughnutChart';
import { me, KPIS, levelColor, fmt } from '../data/mock';

export default function Profile() {
  const cycle = me.cycles[me.cycles.length - 1];
  const weights = KPIS.map((k) => k.weight);
  const colors = KPIS.map((k) => k.color);

  return (
    <>
      <PageHead eyebrow="profile" title={me.name} sub={`${me.role} · ${me.dept} · joined ${me.joined}`} />

      <div className="layout">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
            <Avatar name={me.name} size={64} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{me.name}</div>
              <div className="mono muted" style={{ fontSize: 12 }}>{me.role} · {me.dept}</div>
              <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>Reports to {me.manager}</div>
            </div>
          </div>
          <div className="stat-grid" style={{ marginBottom: 0 }}>
            <StatCard label="Current score" value={me.current.score} tone={levelColor(me.current.level)} sub={`Level ${me.current.level}`} />
            <StatCard label="Points this cycle" value={`+${fmt(me.current.points)}`} tone="var(--mint)" />
            <StatCard label="Lifetime points" value={fmt(me.current.total)} tone="var(--gold)" />
          </div>
        </Card>

        <Card title="Weight split">
          <DoughnutChart labels={KPIS.map((k) => k.name)} data={weights} colors={colors} center={{ value: '100', label: 'points' }} />
        </Card>
      </div>

      <Card title={`Latest cycle · ${me.cycles.length}`}>
        <ul className="list">
          {KPIS.map((k) => (
            <li key={k.key}>
              <span className="l-label">{k.name} <span className="mono muted">×{k.weight}%</span></span>
              <span className="l-value" style={{ color: levelColor(me.current.level) }}>{cycle[k.key]}</span>
            </li>
          ))}
          <li>
            <span className="l-label">Manager note</span>
            <span className="l-value" style={{ color: 'var(--muted)', fontFamily: 'var(--body)', maxWidth: 380, textAlign: 'right' }}>{cycle.comment}</span>
          </li>
        </ul>
      </Card>
    </>
  );
}
