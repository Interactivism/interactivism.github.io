export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={className}
      style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', ...props.style }}
      {...props}
    >
      {children}
    </div>
  );
}
