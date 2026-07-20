export default function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-1">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}
