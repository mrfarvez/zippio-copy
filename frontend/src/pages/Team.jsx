import { useState } from 'react';
import PageHead from '../components/ui/PageHead';
import StatCard from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import { employees, departments, me, levelColor, fmt } from '../data/mock';

export default function Team() {
  const [dept, setDept] = useState('All');
  const rows = employees.filter((e) => dept === 'All' || e.dept === dept);
  const promotions = employees.filter((e) => e.promotion.eligible);
  const avg = Math.round(employees.reduce((s, e) => s + e.current.score, 0) / employees.length);

  return (
    <>
      <PageHead
        eyebrow="management"
        title="Team"
        sub="Live standings, levels and promotion readiness across the company."
        actions={
          <Select value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: 180 }}>
            <option>All</option>
            {departments.map((d) => <option key={d.name}>{d.name}</option>)}
          </Select>
        }
      />

      <div className="stat-grid">
        <StatCard label="Team average" value={avg} tone="var(--mint)" sub="All employees" />
        <StatCard label="Promotion ready" value={promotions.length} tone="var(--gold)" sub="3× consecutive Level A" />
        <StatCard label="Departments" value={departments.length} tone="var(--amber)" />
        <StatCard label="Top score" value={employees[0].current.score} tone="var(--sage)" sub={employees[0].name} />
      </div>

      <Card title={`Roster · ${rows.length}`}>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Score</th><th>Level</th><th>Points</th><th>Δ</th><th>Promotion</th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="td-name">
                      <span className="avatar-sm" style={{ background: levelColor(e.current.level) }}>{e.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                      <div><b>{e.name}</b><span>{e.role}</span></div>
                    </div>
                  </td>
                  <td>{e.dept}</td>
                  <td className="mono" style={{ color: levelColor(e.current.level), fontWeight: 600 }}>{e.current.score}</td>
                  <td><span className={`pill pill-${e.current.level.toLowerCase()}`}>Level {e.current.level}</span></td>
                  <td className="mono">+{fmt(e.current.points)}</td>
                  <td className={`mono ${e.current.delta >= 0 ? 'trend-up' : 'trend-down'}`}>{e.current.delta >= 0 ? '+' : ''}{e.current.delta}</td>
                  <td>{e.promotion.eligible
                    ? <span className="pill pill-ok">Ready</span>
                    : <span className="mono muted small">{e.promotion.scores.length}/3</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Promotion candidates">
        <ul className="list">
          {promotions.map((e) => (
            <li key={e.id}>
              <span className="l-label"><b style={{ color: 'var(--text)' }}>{e.name}</b> · {e.role}</span>
              <span className="l-value">{e.current.score} · Level A · 3/3</span>
            </li>
          ))}
          {promotions.length === 0 && <li><span className="l-label">No candidates this cycle.</span></li>}
        </ul>
      </Card>

      <div className="mono muted small" style={{ marginTop: 16 }}>You: {me.name} · {me.role} — viewing as {me.manager ? `reporting to ${me.manager}` : 'lead'}.</div>
    </>
  );
}
