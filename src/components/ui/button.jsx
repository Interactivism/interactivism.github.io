export function Button({ children, onClick, className = '', size, variant, ...props }) {
  return (
    <button
      onClick={onClick}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
        cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff',
        color: '#374151',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
