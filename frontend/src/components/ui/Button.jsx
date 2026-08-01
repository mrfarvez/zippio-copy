export default function Button({ variant = 'primary', size = '', as: Comp = 'button', className = '', children, ...rest }) {
  const cls = { primary: 'btn-primary', ghost: 'btn-ghost', mint: 'btn-mint', danger: 'btn-danger' }[variant] || 'btn-ghost';
  return (
    <Comp className={`${cls} ${size === 'sm' ? 'btn-sm' : ''} ${className}`.trim()} {...rest}>
      {children}
    </Comp>
  );
}
