import { useEffect, useState } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import TransactionList from '../components/TransactionList';
import AddTransactionForm from '../components/AddTransactionForm';
import TransferForm from '../components/TransferForm';
import ReceiptForm from '../components/ReceiptForm';
import { getTransactionData } from '../lib/api';
import { normalizeRows } from '../lib/transform';

const buttonClass =
  'px-3 py-2 rounded-lg text-sm font-medium bg-bg-raised border border-bg-border text-text-primary hover:border-accent cursor-pointer transition-colors';

export default function Transactions({ metadata, balances, onSaved, listVersion }) {
  const [modal, setModal] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(0);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTransactionData({ page });
        if (cancelled) return;
        setRows(normalizeRows(data.rows, metadata.categories, { sort: false }));
        setPageSize(data.pageSize);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        if (data.page !== page) setPage(data.page);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, listVersion, metadata.categories]);

  function closeModal() {
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModal('add')} className={buttonClass}>
          Add Transaction
        </button>
        <button type="button" onClick={() => setModal('transfer')} className={buttonClass}>
          Transfers
        </button>
        <button type="button" onClick={() => setModal('receipt')} className={buttonClass}>
          Add Receipt
        </button>
      </div>

      <Card title="All Transactions">
        {error && <div className="mb-3 text-sm text-expense">{error}</div>}
        <TransactionList
          transactions={rows}
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          loading={loading}
        />
      </Card>

      {modal === 'add' && (
        <Modal title="Add Transaction" onClose={closeModal} maxWidth="max-w-lg">
          <AddTransactionForm key="add" metadata={metadata} onSaved={onSaved} onClose={closeModal} />
        </Modal>
      )}
      {modal === 'transfer' && (
        <Modal title="Transfer Between Sources" onClose={closeModal} maxWidth="max-w-lg">
          <TransferForm
            key="transfer"
            metadata={metadata}
            balances={balances}
            onSaved={onSaved}
            onClose={closeModal}
          />
        </Modal>
      )}
      {modal === 'receipt' && (
        <Modal title="Add Receipt" onClose={closeModal} maxWidth="max-w-2xl">
          <ReceiptForm key="receipt" metadata={metadata} onSaved={onSaved} onClose={closeModal} />
        </Modal>
      )}
    </div>
  );
}
