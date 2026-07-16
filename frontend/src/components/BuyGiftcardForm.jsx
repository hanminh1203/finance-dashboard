import { useRef, useState } from 'react';
import { Field, inputClass, selectClass } from './FormField';
import { buyGiftcard } from '../lib/api';
import { formatAUD } from '../lib/transform';

const todayISO = () => new Date().toISOString().slice(0, 10);

const cancelClass =
  'px-3 py-2.5 rounded-lg border border-bg-border bg-bg-raised text-text-secondary hover:text-text-primary font-medium transition-colors cursor-pointer';
const submitClass =
  'px-3 py-2.5 rounded-lg border border-bg-border bg-bg-raised text-text-primary hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer';
const primaryClass =
  'px-3 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors cursor-pointer';

export default function BuyGiftcardForm({ metadata, balances, onSaved, onClose }) {
  const [shop, setShop] = useState('');
  const [date, setDate] = useState(todayISO());
  const [balance, setBalance] = useState('');
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const closeAfterRef = useRef(false);

  const paymentSources = (metadata.sources || []).filter((s) => s.name !== 'Giftcard');
  const canSubmit = shop.trim() && balance && source && !submitting;

  function resetForm() {
    setShop('');
    setDate(todayISO());
    setBalance('');
    setSource('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    const shouldClose = closeAfterRef.current;
    closeAfterRef.current = false;
    setSubmitting(true);
    setStatus(null);
    try {
      await buyGiftcard({ shop: shop.trim(), date, balance, source });
      setStatus({ ok: true, msg: 'Giftcard purchased (2 linked transactions).' });
      onSaved?.();
      if (shouldClose) {
        onClose?.();
      } else {
        resetForm();
      }
    } catch (err) {
      setStatus({ ok: false, msg: err.message || String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Shop">
        <input
          type="text"
          placeholder="e.g. Woolworths"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          className={inputClass}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Balance (AUD)">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className={inputClass}
            required
          />
        </Field>
      </div>

      <Field label="Payment source">
        <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass} required>
          <option value="" disabled>Select a source</option>
          {paymentSources.map((s) => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
        {source && (
          <p className="text-xs text-text-muted mt-1">Balance: {formatAUD(balances[source] || 0)}</p>
        )}
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button type="button" onClick={() => onClose?.()} className={cancelClass}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          onClick={() => { closeAfterRef.current = false; }}
          className={submitClass}
        >
          {submitting ? 'Saving…' : 'Submit'}
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          onClick={() => { closeAfterRef.current = true; }}
          className={primaryClass}
        >
          {submitting ? 'Saving…' : 'Submit and Close'}
        </button>
      </div>

      {status && (
        <p className={`text-sm ${status.ok ? 'text-income' : 'text-expense'}`}>{status.msg}</p>
      )}
    </form>
  );
}
