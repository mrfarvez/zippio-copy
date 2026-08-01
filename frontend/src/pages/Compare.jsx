import { useState } from 'react';
import PageHead from '../components/ui/PageHead';
import StatCard from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { employees, KPIS, lastCycle, levelColor, fmt } from '../data/mock';

export default function Compare() {
  const [aId, setAId] = useState('emp-01');
  const [bId, setBId] = useState('emp-02');
  const a = employees.find((e) => e.id === aId);
  const b = employees.find((e) => e.id === bId);
  const cols = [a, b];

  return (
    <>
      <PageHead
        eyebrow="management"
        title="Compare"
        sub="Side-by-side KPI snapshot for any two employees."
        actions={
          <div className="flex" style={{ gap: 10 }}>
            <Select value={aId} onChange={(e) => setAId(e.target.value)} style={{ width: 200 }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
            <span className="muted small">vs</span>
            <Select value={bId} onChange={(e) => setBId(e.target.value)} style={{ width: 200 }}>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </div>
        }
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatCard label={a.name.split(' ')[0]} value={a.current.score} tone={levelColor(a.current.level)} sub={`Level ${a.current.level} · +${fmt(a.current.points)}`} />
        <StatCard label={b.name.split(' ')[0]} value={b.current.score} tone={levelColor(b.current.level)} sub={`Level ${b.current.level} · +${fmt(b.current.points)}`} />
        <StatCard label="Gap" value={Math.abs(a.current.score - b.current.score)} tone="var(--gold)" sub="score points apart" />
      </div>

      <Card title={`KPI breakdown · latest cycle`}>
        {KPIS.map((k) => (
          <div className="compare-labels" key={k.key} style={{ ['--cmp-count']: 2 }}>
            <div className="kpi-name">{k.name} <span className="mono muted" style={{ fontSize: 11 }}>×{k.weight}%</span></div>
            {cols.map((e, i) => (
              <div key={e.id} className="cmp-col">
                <div className="cmp-bar">
                  <div className="cmp-fill" style={{ width: `${lastCycle(e)[k.key]}%`, background: i === 0 ? 'var(--mint)' : 'var(--gold)' }} />
                </div>
                <div className="cmp-val">{lastCycle(e)[k.key]}</div>
              </div>
            ))}
          </div>
        ))}
      </Card>
    </>
  );
}
