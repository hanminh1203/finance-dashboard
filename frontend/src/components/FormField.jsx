export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-secondary mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full bg-bg-raised border border-bg-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:border-accent transition-colors outline-none';

export const selectClass = inputClass + ' cursor-pointer';
