export default function Table({ head, children, className = '' }) {
  return (
    <div className={`table-scroll ${className}`}>
      <table className="table">
        <thead>
          <tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }) {
  return <td className={className}>{children}</td>;
}

export function ScoreCell({ score, level }) {
  const tone = { A: '--mint', B: '--gold', C: '--amber', D: '--coral', E: '--muted' }[level] || '--muted';
  return (
    <td>
      <span className="mono"><b style={{ color: `var(${tone})` }}>{score}</b> <span style={{ color: `var(${tone})` }}>{level}</span></span>
    </td>
  );
}
