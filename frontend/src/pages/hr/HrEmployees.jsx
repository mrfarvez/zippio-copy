import { useEffect, useMemo, useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import StatCard from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { api } from '../../api';
import { departments, levelColor, fmt } from '../../data/mock';

const EMPTY = { name: '', role: '', dept: '', joined: '2026', comment: '' };

export default function HrEmployees() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { api.employees.list().then(setRows); }, []);

  const filtered = useMemo(() => rows.filter((r) =>
    (r.name.toLowerCase().includes(q.toLowerCase()) || r.dept.toLowerCase().includes(q.toLowerCase()))
  ), [rows, q]);

  const save = () => {
    if (!form.name) return;
    setRows((r) => [{ ...form, id: `emp-${r.length + 1}`, manager: 'Sadia Rahman' }, ...r]);
    setOpen(false);
    setForm(EMPTY);
    toast(`Added ${form.name}`);
  };
  const remove = (id) => {
    setRows((r) => r.filter((x) => x.id !== id));
    toast('Employee removed', 'danger');
  };

  return (
    <>
      <PageHead
        eyebrow="HR admin"
        title="Employees"
        sub="Manage the roster. KPI scores are read-only here — they come from evaluations."
        actions={
          <>
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
            <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>+ Add employee</Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard label="Total" value={rows.length} tone="var(--mint)" />
        <StatCard label="Departments" value={departments.length} tone="var(--gold)" />
        <StatCard label="Avg score" value={rows.length ? Math.round(rows.reduce((s, e) => s + e.current.score, 0) / rows.length) : 0} tone="var(--amber)" />
      </div>

      <Card>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Employee</th><th>Role</th><th>Department</th><th>Score</th><th>Level</th><th>Points</th><th></th></tr></thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td><div className="td-name"><span className="avatar-sm" style={{ background: levelColor(e.current.level) }}>{e.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><div><b>{e.name}</b><span>{e.joined}</span></div></div></td>
                  <td>{e.role}</td>
                  <td>{e.dept}</td>
                  <td className="mono" style={{ color: levelColor(e.current.level), fontWeight: 600 }}>{e.current.score}</td>
                  <td><span className={`pill pill-${e.current.level.toLowerCase()}`}>Level {e.current.level}</span></td>
                  <td className="mono">+{fmt(e.current.points)}</td>
                  <td><button className="btn-danger btn-sm" onClick={() => remove(e.id)}>Remove</button></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="muted" style={{ textAlign: 'center' }}>No matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add employee" sub="They'll appear in the roster immediately.">
        <div className="form-grid">
          <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Saima Karim" /></Field>
          <Field label="Role" required><Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="e.g. Backend Engineer" /></Field>
          <Field label="Department" required>
            <Select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.name}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="Joined"><Input value={form.joined} onChange={(e) => setForm({ ...form, joined: e.target.value })} /></Field>
        </div>
        <Field label="Note"><Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="Optional note" /></Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={!form.name || !form.role || !form.dept}>Save employee</Button>
        </div>
      </Modal>
    </>
  );
}
