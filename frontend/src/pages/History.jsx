import PageHead from '../components/ui/PageHead';
import { Card } from '../components/ui/Card';
import LineChart from '../components/charts/LineChart';
import { me, KPIS, MONTHS, scoreOf, pointsOf, levelOf, levelColor, fmt } from '../data/mock';

export default function History() {
  const scores = MONTHS.map((_, i) => scoreOf(me.cycles[i]));
  const points = MONTHS.map((_, i) => pointsOf(me.cycles[i]));

  return (
    <>
      <PageHead
        eyebrow="cycle history"
        title="Your trajectory"
        sub="Every monthly cycle, scored against the five KPIs."
      />

      <Card title={`Score trend · ${MONTHS[0]}–${MONTHS[MONTHS.length - 1]}`}>
        <LineChart
          labels={MONTHS}
          series={[
            { label: 'Score', data: scores, color: '#35D0A0' },
            { label: 'Points', data: points, color: '#F4B740', fill: false, points: false },
          ]}
        />
      </Card>

      <Card title="All cycles">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Cycle</th>
                {KPIS.map((k) => <th key={k.key}>{k.name}</th>)}
                <th>Score</th>
                <th>Level</th>
                <th>Points</th>
                <th>Manager note</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const c = me.cycles[i];
                const s = scoreOf(c);
                const lv = levelOf(s);
                return (
                  <tr key={m}>
                    <td className="mono">{m} 2026</td>
                    {KPIS.map((k) => <td key={k.key} className="mono">{c[k.key]}</td>)}
                    <td className="mono" style={{ color: levelColor(lv), fontWeight: 600 }}>{s}</td>
                    <td><span className={`pill pill-${lv.toLowerCase()}`}>Level {lv}</span></td>
                    <td className="mono">+{fmt(pointsOf(c))}</td>
                    <td style={{ color: 'var(--muted)' }}>{c.comment}</td>
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
