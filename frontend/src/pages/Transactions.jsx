import { useMemo, useState } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import TransactionList from '../components/TransactionList';
import AddTransactionForm from '../components/AddTransactionForm';
import TransferForm from '../components/TransferForm';
import ReceiptForm from '../components/ReceiptForm';
import { compareTransactionsDesc } from '../lib/transform';

const buttonClass =
  'px-3 py-2 rounded-lg text-sm font-medium bg-bg-raised border border-bg-border text-text-primary hover:border-accent cursor-pointer transition-colors';

export default function Transactions({ transactions, metadata, balances, onSaved }) {
  const [modal, setModal] = useState(null);

  const sorted = useMemo(
    () => transactions.slice().sort(compareTransactionsDesc),
    [transactions],
  );

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
        <TransactionList transactions={sorted} />
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
