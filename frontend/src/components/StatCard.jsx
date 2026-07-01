import { formatAUD } from '../lib/transform';

export default function StatCard({ label, value, tone = 'default', sublabel }) {
  const toneClass = {
    default: 'text-text-primary',
    income: 'text-income',
    expense: 'text-expense',
    accent: 'text-accent',
  }[tone];

  return (
    <div className="bg-bg-surface border border-bg-border rounded-xl p-5 shadow-card">
      <div className="text-sm text-text-secondary mb-1">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{formatAUD(value)}</div>
      {sublabel && <div className="text-xs text-text-muted mt-1">{sublabel}</div>}
    </div>
  );
}
