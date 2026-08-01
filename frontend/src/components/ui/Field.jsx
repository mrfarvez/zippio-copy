export function Field({ label, required, children, className = '', hint }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label>{label} {required && <span className="req">*</span>}</label>
      )}
      {children}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  );
}

export function Input(props) {
  return <input className="input" {...props} />;
}

export function Select({ children, ...rest }) {
  return <select className="input" {...rest}>{children}</select>;
}

export function Textarea(props) {
  return <textarea className="input" {...props} />;
}
