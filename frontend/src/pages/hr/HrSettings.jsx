import { useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import { Card } from '../../components/ui/Card';
import { Field, Input } from '../../components/ui/Field';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { KPIS, currentMonth } from '../../data/mock';

export default function HrSettings() {
  const toast = useToast();
  const [form, setForm] = useState({
    org: 'Zippio',
    cycle: currentMonth,
    cadence: 'Monthly',
    periodStart: '1st',
    notifyDays: '5',
    weightsLocked: 'false',
  });

  const save = (section) => {
    toast(`${section} saved`);
  };

  return (
    <>
      <PageHead eyebrow="HR admin" title="Settings" sub="Organization-level configuration for scoring and the evaluation cycle." />

      <Card title="Organization">
        <div className="form-grid">
          <Field label="Organization name"><Input value={form.org} onChange={(e) => setForm({ ...form, org: e.target.value })} /></Field>
          <Field label="Active cycle"><Input value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} /></Field>
        </div>
        <Button variant="ghost" size="sm" onClick={() => save('Organization')}>Save org details</Button>
      </Card>

      <Card title="Cycle cadence">
        <div className="form-grid">
          <Field label="Cadence">
            <select className="input" value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })}>
              <option>Monthly</option><option>Quarterly</option><option>Yearly</option>
            </select>
          </Field>
          <Field label="Period opens on"><Input value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} /></Field>
        </div>
        <Button variant="ghost" size="sm" onClick={() => save('Cycle cadence')}>Save cadence</Button>
      </Card>

      <Card title="Scoring">
        <p className="muted small mb-20" style={{ marginBottom: 16 }}>
          {KPIS.map((k) => `${k.name} ×${k.weight}%`).join(' · ')} — weights are managed on the KPIs page.
        </p>
        <Field label="Notify managers days before close"><Input value={form.notifyDays} onChange={(e) => setForm({ ...form, notifyDays: e.target.value })} style={{ maxWidth: 120 }} /></Field>
        <Button variant="ghost" size="sm" onClick={() => save('Scoring')}>Save scoring settings</Button>
      </Card>

      <Card title="Danger zone">
        <p className="muted small" style={{ marginBottom: 16 }}>Export or archive the full audit trail. Deletion is handled by the backend.</p>
        <Button variant="danger" size="sm" onClick={() => toast('Export queued', 'warn')}>Export audit log</Button>
      </Card>
    </>
  );
}
