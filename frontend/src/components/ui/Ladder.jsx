const LADDER = [
  { l: 'A', h: 100, min: '90–100', c: '#35D0A0', d: 'Outstanding' },
  { l: 'B', h: 86, min: '80–89', c: '#F4B740', d: 'High performer' },
  { l: 'C', h: 70, min: '70–79', c: '#F2924A', d: 'Consistent' },
  { l: 'D', h: 52, min: '60–69', c: '#FF6B57', d: 'Developing' },
  { l: 'E', h: 35, min: '<60', c: '#8B9AA8', d: 'Needs support' },
];

export default function Ladder({ active, height = 200, showDesc = true }) {
  return (
    <div className="stair-wrap" style={{ height }}>
      {LADDER.map((s) => (
        <div key={s.l} className={`step ${s.l === active ? 'active' : ''}`} style={{ height: `${s.h}%`, background: s.c }}>
          {s.l}
          <span className="range">{s.min}</span>
          {showDesc && <span className="level-desc">{s.d}</span>}
        </div>
      ))}
    </div>
  );
}
