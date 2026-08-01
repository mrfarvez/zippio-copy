import { useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { KPIS } from '../../data/mock';

export default function HrKpis() {
  const toast = useToast();
  const [rows, setRows] = useState(KPIS.map((k) => ({ ...k })));
  const total = rows.reduce((s, r) => s + (r.weight || 0), 0);

  const setWeight = (key, v) => setRows((r) => r.map((x) => (x.key === key ? { ...x, weight: Number(v) } : x)));
  const save = () => {
    if (total !== 100) return;
    toast('KPI weights saved');
  };

  return (
    <>
      <PageHead eyebrow="HR admin" title="KPI weights" sub="Distribution must sum to exactly 100. Changes apply from the next cycle." />

      <Card title={`Current weights · total ${total}${total === 100 ? ' ✓' : ` (need ${100 - total})`}`}>
        <ul className="list">
          {rows.map((k) => (
            <li key={k.key}>
              <span className="l-label"><span className="logo-mark" style={{ background: k.color, width: 12, height: 12, display: 'inline-block', marginRight: 10, verticalAlign: 'middle' }} />{k.name}</span>
              <span className="flex gap-sm" style={{ gap: 10 }}>
                <input
                  type="number" min={0} max={100} value={k.weight}
                  onChange={(e) => setWeight(k.key, e.target.value)}
                  style={{ width: 80, background: 'var(--surface-2)', border: '1px solid var(--line)', color: 'var(--text)', padding: '8px 10px', borderRadius: 8, fontFamily: 'var(--mono)' }}
                />
                <span className="mono muted">%</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="form-foot">
          <span className={`mono small ${total === 100 ? 'trend-up' : 'trend-down'}`}>{total === 100 ? 'Balanced — save enabled' : `Weights out of balance by ${100 - total}`}</span>
          <Button onClick={save} disabled={total !== 100}>Save weights</Button>
        </div>
      </Card>
    </>
  );
}
