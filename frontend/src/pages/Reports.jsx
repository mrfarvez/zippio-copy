import PageHead from '../components/ui/PageHead';
import StatCard from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import BarChart from '../components/charts/BarChart';
import DoughnutChart from '../components/charts/DoughnutChart';
import { departments, employees, scoreOf, levelColor } from '../data/mock';

export default function Reports() {
  const levelDist = ['A', 'B', 'C', 'D', 'E'].map((l) => employees.filter((e) => e.current.level === l).length);
  const levelColors = ['#35D0A0', '#F4B740', '#F2924A', '#FF6B57', '#8B9AA8'];

  return (
    <>
      <PageHead eyebrow="management" title="Reports" sub="Aggregated view of performance across the organization." />

      <div className="stat-grid">
        <StatCard label="Headcount" value={employees.length} tone="var(--mint)" />
        <StatCard label="Avg score" value={Math.round(employees.reduce((s, e) => s + e.current.score, 0) / employees.length)} tone="var(--gold)" />
        <StatCard label="Level A" value={employees.filter((e) => e.current.level === 'A').length} tone="var(--sage)" />
        <StatCard label="Level E" value={employees.filter((e) => e.current.level === 'E').length} tone="var(--coral)" />
      </div>

      <div className="layout">
        <Card title="Score by department">
          <BarChart
            labels={departments.map((d) => d.name)}
            data={departments.map((d) => d.avg)}
            color={departments.map((d) => d.color)}
          />
        </Card>

        <Card title="Level distribution">
          <DoughnutChart labels={['A', 'B', 'C', 'D', 'E']} data={levelDist} colors={levelColors} center={{ value: employees.length, label: 'people' }} />
        </Card>
      </div>

      <Card title="Top performers">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>#</th><th>Employee</th><th>Department</th><th>Score</th><th>Level</th><th>3-cycle avg</th></tr></thead>
            <tbody>
              {employees.map((e) => {
                const avg3 = Math.round(e.cycles.slice(-3).map(scoreOf).reduce((s, x) => s + x, 0) / 3);
                return (
                  <tr key={e.id}>
                    <td className="mono">{e.rank}</td>
                    <td><div className="td-name"><span className="avatar-sm" style={{ background: levelColor(e.current.level) }}>{e.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><div><b>{e.name}</b><span>{e.role}</span></div></div></td>
                    <td>{e.dept}</td>
                    <td className="mono" style={{ color: levelColor(e.current.level), fontWeight: 600 }}>{e.current.score}</td>
                    <td><span className={`pill pill-${e.current.level.toLowerCase()}`}>Level {e.current.level}</span></td>
                    <td className="mono">{avg3}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
