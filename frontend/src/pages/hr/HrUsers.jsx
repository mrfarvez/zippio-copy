import { useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import StatCard from '../../components/ui/StatCard';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { Field, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { users, roles } from '../../data/mock';

export default function HrUsers() {
  const toast = useToast();
  const [rows, setRows] = useState(users);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'employee' });

  const active = rows.filter((u) => u.status === 'Active').length;

  const add = () => {
    if (!form.name || !form.email) return;
    setRows((r) => [{ ...form, status: 'Active', last: 'Just now' }, ...r]);
    setOpen(false);
    setForm({ name: '', email: '', role: 'employee' });
    toast(`Created user ${form.email}`);
  };
  const toggleRole = (email) => setRows((r) => r.map((u) => {
    if (u.email !== email) return u;
    const ri = roles.findIndex((x) => x.key === u.role);
    return { ...u, role: roles[(ri + 1) % roles.length].key };
  }));
  const toggleStatus = (email) => {
    setRows((r) => r.map((u) => (u.email === email ? { ...u, status: u.status === 'Active' ? 'Suspended' : 'Active' } : u)));
    toast(`Updated access for ${email}`, 'warn');
  };

  return (
    <>
      <PageHead
        eyebrow="HR admin"
        title="Users & access"
        sub="RBAC across the four roles. Toggle status to revoke login access."
        actions={<Button onClick={() => setOpen(true)}>+ Create user</Button>}
      />

      <div className="stat-grid">
        <StatCard label="Total users" value={rows.length} tone="var(--mint)" />
        <StatCard label="Active" value={active} tone="var(--sage)" />
        <StatCard label="Roles" value={roles.length} tone="var(--gold)" />
      </div>

      <Card>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last active</th><th></th></tr></thead>
            <tbody>
              {rows.map((u) => {
                const role = roles.find((r) => r.key === u.role);
                return (
                  <tr key={u.email}>
                    <td><div className="td-name"><span className="avatar-sm" style={{ background: role.color }}>{u.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span><div><b>{u.name}</b><span>{u.email}</span></div></div></td>
                    <td><span className="mono" style={{ color: role.color }}>{u.role}</span></td>
                    <td>{u.status === 'Active' ? <span className="pill pill-ok">Active</span> : <span className="pill pill-danger">Suspended</span>}</td>
                    <td className="muted small">{u.last}</td>
                    <td>
                      <div className="flex" style={{ gap: 8 }}>
                        <button className="btn-ghost btn-sm" onClick={() => toggleRole(u.email)}>Rotate role</button>
                        <button className="btn-danger btn-sm" onClick={() => toggleStatus(u.email)}>{u.status === 'Active' ? 'Suspend' : 'Restore'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Create user" sub="A temporary password will be emailed on the backend.">
        <Field label="Full name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@zippio.io" /></Field>
        <Field label="Role" required>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={add} disabled={!form.name || !form.email}>Create</Button>
        </div>
      </Modal>
    </>
  );
}
