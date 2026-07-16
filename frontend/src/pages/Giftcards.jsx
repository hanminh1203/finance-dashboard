import { useEffect, useState } from 'react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import BuyGiftcardForm from '../components/BuyGiftcardForm';
import UseGiftcardForm from '../components/UseGiftcardForm';
import { getGiftcards } from '../lib/api';
import { formatAUD, formatDateShort } from '../lib/transform';

const buttonClass =
  'px-3 py-2 rounded-lg text-sm font-medium bg-bg-raised border border-bg-border text-text-primary hover:border-accent cursor-pointer transition-colors';

const actionClass =
  'px-2.5 py-1 rounded-md text-xs font-medium bg-bg-raised border border-bg-border text-text-primary hover:border-accent cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export default function Giftcards({ metadata, balances, onSaved, listVersion }) {
  const [modal, setModal] = useState(null);
  const [useCard, setUseCard] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getGiftcards();
        if (cancelled) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listVersion]);

  function closeModal() {
    setModal(null);
    setUseCard(null);
  }

  function handleSaved() {
    onSaved?.();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setModal('buy')} className={buttonClass}>
          Buy giftcard
        </button>
      </div>

      <Card title="Giftcards">
        {error && <div className="mb-3 text-sm text-expense">{error}</div>}
        {loading && rows.length === 0 ? (
          <p className="text-sm text-text-muted py-4">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No giftcards yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-bg-border">
                  <th className="py-2 pr-3 font-medium">Shop</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium text-right">Balance</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="border-b border-bg-border/60 last:border-0">
                    <td className="py-2.5 pr-3 text-text-primary">{g.shop}</td>
                    <td className="py-2.5 pr-3 text-text-secondary">{formatDateShort(g.date)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums text-text-primary">
                      {formatAUD(g.balance)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        className={actionClass}
                        disabled={!(Number(g.balance) > 0)}
                        onClick={() => {
                          setUseCard(g);
                          setModal('use');
                        }}
                      >
                        Use
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal === 'buy' && (
        <Modal title="Buy giftcard" onClose={closeModal} maxWidth="max-w-lg">
          <BuyGiftcardForm
            metadata={metadata}
            balances={balances}
            onSaved={handleSaved}
            onClose={closeModal}
          />
        </Modal>
      )}

      {modal === 'use' && useCard && (
        <Modal title={`Use — ${useCard.shop}`} onClose={closeModal} maxWidth="max-w-lg">
          <UseGiftcardForm
            giftcard={useCard}
            metadata={metadata}
            onSaved={handleSaved}
            onClose={closeModal}
          />
        </Modal>
      )}
    </div>
  );
}
