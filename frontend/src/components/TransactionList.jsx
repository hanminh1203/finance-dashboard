import { useState } from 'react';
import Modal from './Modal';
import ReceiptView from './ReceiptView';
import { formatAUD, formatDateShort } from '../lib/transform';

const viewBtnClass =
  'px-2 py-1 rounded-md border border-bg-border bg-bg-raised text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer';

export default function TransactionList({ transactions, emptyLabel = 'No transactions yet' }) {
  const [viewReceiptId, setViewReceiptId] = useState(null);

  if (transactions.length === 0) {
    return <div className="text-text-muted text-sm py-8 text-center">{emptyLabel}</div>;
  }

  return (
    <>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted border-b border-bg-border">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Comment</th>
              <th className="py-2 pr-4 font-medium hidden sm:table-cell">Category</th>
              <th className="py-2 pr-4 font-medium hidden md:table-cell">Source</th>
              <th className="py-2 pl-4 font-medium text-right">Amount</th>
              <th className="py-2 pl-4 font-medium text-right">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => (
              <tr key={i} className="border-b border-bg-border/60 hover:bg-bg-raised/40 transition-colors">
                <td className="py-2.5 pr-4 text-text-secondary whitespace-nowrap">{formatDateShort(t.date)}</td>
                <td className="py-2.5 pr-4 text-text-primary max-w-[200px] truncate">{t.comment || '—'}</td>
                <td className="py-2.5 pr-4 text-text-secondary hidden sm:table-cell whitespace-nowrap">{t.subCategory || '—'}</td>
                <td className="py-2.5 pr-4 text-text-secondary hidden md:table-cell whitespace-nowrap">{t.source}</td>
                <td className={`py-2.5 pl-4 text-right font-medium tabular-nums whitespace-nowrap ${
                  t.change < 0 ? 'text-expense' : t.type === 'Income' ? 'text-income' : 'text-text-secondary'
                }`}>
                  {formatAUD(t.change)}
                </td>
                <td className="py-2.5 pl-4 text-right whitespace-nowrap">
                  {t.receiptId ? (
                    <button
                      type="button"
                      className={viewBtnClass}
                      onClick={() => setViewReceiptId(t.receiptId)}
                    >
                      View
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewReceiptId && (
        <Modal title="Receipt" onClose={() => setViewReceiptId(null)} maxWidth="max-w-2xl">
          <ReceiptView receiptId={viewReceiptId} onClose={() => setViewReceiptId(null)} />
        </Modal>
      )}
    </>
  );
}
