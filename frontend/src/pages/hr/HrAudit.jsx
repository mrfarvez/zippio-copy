import { useState } from 'react';
import PageHead from '../../components/ui/PageHead';
import { Card } from '../../components/ui/Card';
import { auditLogs } from '../../data/mock';

export default function HrAudit() {
  const [rows] = useState(auditLogs);

  return (
    <>
      <PageHead eyebrow="HR admin" title="Audit log" sub="Every evaluation, approval and permission change is recorded here." />

      <Card>
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={i}>
                  <td className="mono muted small" style={{ whiteSpace: 'nowrap' }}>{a.time}</td>
                  <td><b style={{ fontSize: 13 }}>{a.actor}</b></td>
                  <td>{a.action}</td>
                  <td className="muted">{a.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
