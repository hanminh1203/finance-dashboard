import { useState } from 'react';
import Modal from './Modal';
import ReceiptView from './ReceiptView';
import { formatAUD, formatDateShort } from '../lib/transform';

const viewBtnClass =
  'px-2 py-1 rounded-md border border-bg-border bg-bg-raised text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer';

const pageBtnClass =
  'px-3 py-1.5 rounded-md border border-bg-border bg-bg-raised text-xs text-text-secondary hover:text-text-primary hover:border-accent transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-bg-border disabled:hover:text-text-secondary';

export default function TransactionList({
  transactions,
  emptyLabel = 'No transactions yet',
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  loading = false,
}) {
  const [viewReceiptId, setViewReceiptId] = useState(null);

  const paginated = Number.isFinite(pageSize) && pageSize > 0 && total != null;
  const safePage = paginated ? Math.min(Math.max(1, page || 1), Math.max(1, totalPages || 1)) : 1;
  const pages = paginated ? Math.max(1, totalPages || 1) : 1;

  if (!loading && transactions.length === 0) {
    return <div className="text-text-muted text-sm py-8 text-center">{emptyLabel}</div>;
  }

  const from = paginated && total > 0 ? (safePage - 1) * pageSize + 1 : transactions.length ? 1 : 0;
  const to = paginated && total > 0 ? Math.min(safePage * pageSize, total) : transactions.length;

  return (
    <>
      <div className={`overflow-x-auto scrollbar-thin ${loading ? 'opacity-60' : ''}`}>
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

      {paginated && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-bg-border">
          <p className="text-xs text-text-muted tabular-nums">
            {total === 0 ? '0 of 0' : `${from}–${to} of ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={pageBtnClass}
              disabled={loading || safePage <= 1}
              onClick={() => onPageChange?.(safePage - 1)}
            >
              Previous
            </button>
            <span className="text-xs text-text-secondary tabular-nums px-1">
              Page {safePage} of {pages}
            </span>
            <button
              type="button"
              className={pageBtnClass}
              disabled={loading || safePage >= pages}
              onClick={() => onPageChange?.(safePage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {viewReceiptId && (
        <Modal title="Receipt" onClose={() => setViewReceiptId(null)} maxWidth="max-w-2xl">
          <ReceiptView receiptId={viewReceiptId} onClose={() => setViewReceiptId(null)} />
        </Modal>
      )}
    </>
  );
}
