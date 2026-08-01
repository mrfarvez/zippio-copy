import { Card } from '../components/ui/Card';
import StatCard from '../components/ui/StatCard';
import { KpiBreakdown } from '../components/ui/KpiBar';
import Ladder from '../components/ui/Ladder';
import Dial from '../components/ui/Dial';
import PageHead from '../components/ui/PageHead';
import LineChart from '../components/charts/LineChart';
import { me, KPIS, MONTHS, lastCycle, scoreOf, levelColor, employees, fmt, currentMonth, notifications } from '../data/mock';

export default function Dashboard() {
  const scores = MONTHS.map((_, i) => scoreOf(me.cycles[i]));
  const scoreColor = levelColor(me.current.level);

  return (
    <>
      <PageHead
        eyebrow={`${currentMonth} cycle · approved`}
        title={`Good day, ${me.name.split(' ')[0]}.`}
        sub="Here's how your effort is adding up."
      />

      <div className="stat-grid">
        <StatCard label="Current score" value={me.current.score} tone={scoreColor} sub={`Level ${me.current.level} · ${me.current.delta >= 0 ? '+' : ''}${me.current.delta} vs last cycle`} />
        <StatCard label="Points this cycle" value={`+${fmt(me.current.points)}`} tone="var(--mint)" sub="Score ×4 + level bonus" />
        <StatCard label="Lifetime points" value={fmt(me.current.total)} tone="var(--gold)" sub="Since Jan 2024" />
        <StatCard label="Company rank" value={`#${me.rank}`} tone="var(--amber)" sub="of 10 in standings" />
      </div>

      <div className="layout cols-3">
        <Card title="This cycle">
          <div className="dial-wrap">
            <div style={{ position: 'relative' }}>
              <Dial score={me.current.score} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div className="dial-score">{me.current.score}</div>
                <div className="dial-grade" style={{ color: scoreColor }}>Level {me.current.level}</div>
              </div>
            </div>
          </div>
          <div className="dial-foot" style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span>Points <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>+{fmt(me.current.points)}</b></span>
            <span>Bonus <b style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmt(me.bonus)}</b></span>
          </div>
        </Card>

        <Card title="Score breakdown">
          <KpiBreakdown kpis={KPIS} cycle={lastCycle(me)} />
        </Card>

        <Card title="Level ladder">
          <Ladder active={me.current.level} />
        </Card>
      </div>

      <div className="layout">
        <Card title={`Score trend · ${MONTHS[0]}–${MONTHS[MONTHS.length - 1]}`}>
          <LineChart labels={MONTHS} series={[{ label: 'Score', data: scores, color: '#35D0A0' }]} />
        </Card>

        <Card title="Updates">
          <ul className="list">
            {notifications.map((n, i) => (
              <li key={i}>
                <span className="l-label">{n.text}</span>
                <span className="l-value">{n.time}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Standings">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Employee</th><th>Department</th><th>Score</th><th>Level</th><th>Points</th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} style={e.id === me.id ? { background: 'rgba(53,208,160,0.06)' } : {}}>
                  <td className="mono">{e.rank}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
