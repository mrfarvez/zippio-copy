import { useState } from 'react';
import PageHead from '../components/ui/PageHead';
import { Card } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { employees, KPIS, lastCycle, scoreOf, levelOf, levelColor } from '../data/mock';

export default function Evaluate() {
  const toast = useToast();
  const [empId, setEmpId] = useState('emp-03');
  const emp = employees.find((e) => e.id === empId);
  const [cycle, setCycle] = useState(() => ({ ...lastCycle(emp) }));
  const [submitted, setSubmitted] = useState(false);

  const score = scoreOf(cycle);
  const level = levelOf(score);
  const changeEmp = (id) => {
    const e = employees.find((x) => x.id === id);
    setEmpId(id);
    setCycle({ ...lastCycle(e) });
    setSubmitted(false);
  };
  const setKpi = (key, v) => setCycle((c) => ({ ...c, [key]: Number(v) }));
  const submit = () => {
    setSubmitted(true);
    toast(`Evaluation submitted for ${emp.name} · ${score} pts (Level ${level})`);
  };

  return (
    <>
      <PageHead
        eyebrow="management"
        title="Evaluate"
        sub="Score the current cycle against each KPI. The total updates live."
        actions={
          <Select value={empId} onChange={(e) => changeEmp(e.target.value)} style={{ width: 220 }}>
            {employees.filter((e) => e.id !== 'emp-01' && e.id !== 'emp-07').map((e) => (
              <option key={e.id} value={e.id}>{e.name} · {e.dept}</option>
            ))}
          </Select>
        }
      />

      <div className="layout">
        <Card title={`${emp.name} · ${emp.role}`}>
          {KPIS.map((k) => (
            <div className="range-row" key={k.key}>
              <div className="range-info">
                <div className="kpi-name">{k.name}</div>
                <div className="kpi-w">weight ×{k.weight}%</div>
              </div>
              <input
                type="range" min={0} max={100} value={cycle[k.key] || 0}
                onChange={(e) => setKpi(k.key, e.target.value)}
                style={{ ['--val' ]: `${cycle[k.key] || 0}%`, background: `linear-gradient(90deg, ${k.color} ${cycle[k.key] || 0}%, var(--surface-2) ${cycle[k.key] || 0}%)` }}
              />
              <div className="range-val">{cycle[k.key] || 0}</div>
            </div>
          ))}
          <div className="form-foot">
            <span className="mono muted small">Auto-saves nothing — this is a live preview.</span>
            <Button onClick={submit} disabled={submitted}>{submitted ? 'Submitted' : 'Submit evaluation'}</Button>
          </div>
        </Card>

        <Card title="Live score">
          <div className="eval-summary">
            <div>
              <div className="eval-score-big" style={{ color: levelColor(level) }}>{score}</div>
              <div className="eval-score-meta">Level <b>{level}</b> · {score >= 90 ? 'promotion track on' : 'promotion track off'}</div>
            </div>
            <div className="eval-strip">
              {KPIS.map((k) => (
                <div className="mini-bar" key={k.key}>
                  <span className="mono muted small" style={{ width: 90 }}>{k.name}</span>
                  <div className="mini-track"><div className="mini-fill" style={{ width: `${cycle[k.key] || 0}%`, background: k.color }} /></div>
                  <span className="mono small">{cycle[k.key] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          {submitted && <div className="form-ok" style={{ display: 'block', marginTop: 20 }}>Saved for {emp.name}. The manager note field will be added with the backend.</div>}
        </Card>
      </div>
    </>
  );
}
