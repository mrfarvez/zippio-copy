export default function Modal({ open, onClose, title, sub, children, footer }) {
  return (
    <div className={`modal-bg ${open ? 'open' : ''}`} onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {sub && <div className="modal-sub">{sub}</div>}
        {children}
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}
