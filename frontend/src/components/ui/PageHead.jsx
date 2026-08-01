export default function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <div className="page-head">
      <div className="page-title">
        {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
