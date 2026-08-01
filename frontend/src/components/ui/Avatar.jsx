import { initials } from '../../data/mock';

export default function Avatar({ name, background, size = 34, fontSize }) {
  return (
    <span
      className="tag-avatar"
      style={{
        width: size,
        height: size,
        fontSize: fontSize || Math.round(size * 0.33),
        background: background || 'linear-gradient(135deg, var(--mint), var(--gold))',
      }}
    >
      {initials(name)}
    </span>
  );
}
