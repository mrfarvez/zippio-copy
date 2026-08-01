import { useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { departments as seed, employees, levelColor } from '../../data/mock';

export default function HrDepartments() {
  const toast = useToast();
  const [depts, setDepts] = useState(seed);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim() || depts.some((d) => d.name.toLowerCase() === name.trim().toLowerCase())) return;
    const dept = { name: name.trim(), head: '—', color: '#35D0A0', members: [], avg: null };
    setDepts([...depts, dept]);
    setOpen(false);
    setName('');
    toast(`Department ${dept.name} created`);
  };

  return (
    <>
      <PageHead
        eyebrow="HR admin"
        title="Departments"
        sub="Groups, heads and average scores."
        actions={<Button onClick={() => setOpen(true)}>+ New department</Button>}
      />

      <div className="grid-cards">
        {depts.map((d) => {
          const mem = employees.filter((e) => e.dept === d.name);
          const avg = mem.length ? Math.round(mem.reduce((s, e) => s + e.current.score, 0) / mem.length) : null;
          return (
            <Card key={d.name}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span className="logo-mark" style={{ background: d.color, width: 14, height: 14 }} />
                <b style={{ fontSize: 15 }}>{d.name}</b>
              </div>
              <ul className="list">
                <li><span className="l-label">Head</span><span className="l-value">{d.head || '—'}</span></li>
                <li><span className="l-label">Members</span><span className="l-value">{mem.length}</span></li>
                <li><span className="l-label">Avg score</span><span className="l-value" style={{ color: avg != null ? levelColor(avg >= 90 ? 'A' : avg >= 80 ? 'B' : avg >= 70 ? 'C' : avg >= 60 ? 'D' : 'E') : 'var(--muted)' }}>{avg != null ? avg : '—'}</span></li>
              </ul>
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New department" sub="Heads are assigned from the Users page.">
        <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Marketing" /></Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={add} disabled={!name.trim()}>Create</Button>
        </div>
      </Modal>
    </>
  );
}
