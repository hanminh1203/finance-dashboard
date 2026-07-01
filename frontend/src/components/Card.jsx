export default function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-bg-surface border border-bg-border rounded-xl shadow-card p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
