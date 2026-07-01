import { formatAUD } from '../lib/transform';

const TYPE_LABEL = { Liquid: 'Liquid', Saving: 'Savings', Giftcard: 'Gift card' };

export default function SourceGrid({ balances, sourceTypes, onSelect, selected }) {
  const entries = Object.entries(balances).sort((a, b) => b[1] - a[1]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {entries.map(([source, balance]) => {
        const type = sourceTypes[source];
        const isActive = selected === source;
        return (
          <button
            key={source}
            onClick={() => onSelect(source)}
            className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
              isActive
                ? 'border-accent bg-accent-muted/30'
                : 'border-bg-border bg-bg-surface hover:border-bg-border hover:bg-bg-raised'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-text-primary truncate">{source}</span>
              {type && (
                <span className="text-[10px] uppercase tracking-wide text-text-muted bg-bg-raised px-1.5 py-0.5 rounded">
                  {TYPE_LABEL[type] || type}
                </span>
              )}
            </div>
            <div className={`text-lg font-semibold tabular-nums ${balance < 0 ? 'text-expense' : 'text-text-primary'}`}>
              {formatAUD(balance)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
