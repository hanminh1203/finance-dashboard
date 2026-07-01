import { useState } from 'react';
import Card from './Card';
import { Field, inputClass, selectClass } from './FormField';
import { addTransfer } from '../lib/sheetsApi';
import { formatAUD } from '../lib/transform';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function TransferForm({ metadata, balances, token, onSaved }) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [fromSource, setFromSource] = useState('');
  const [toSource, setToSource] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const canSubmit = amount && fromSource && toSource && fromSource !== toSource && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await addTransfer(token, { date, amount, fromSource, toSource, comment });
      setStatus({ ok: true, msg: 'Transfer recorded (2 linked transactions).' });
      setAmount('');
      setComment('');
      onSaved?.();
    } catch (err) {
      setStatus({ ok: false, msg: err.message || String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card title="Transfer Between Sources" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <select value={fromSource} onChange={(e) => setFromSource(e.target.value)} className={selectClass} required>
              <option value="" disabled>Select source</option>
              {metadata.sources.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            {fromSource && (
              <p className="text-xs text-text-muted mt-1">Balance: {formatAUD(balances[fromSource] || 0)}</p>
            )}
          </Field>
          <Field label="To">
            <select value={toSource} onChange={(e) => setToSource(e.target.value)} className={selectClass} required>
              <option value="" disabled>Select source</option>
              {metadata.sources.filter((s) => s.name !== fromSource).map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} required />
          </Field>
          <Field label="Amount (AUD)">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <Field label="Comment (optional)">
          <input
            type="text"
            placeholder="e.g. Move to savings"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className={inputClass}
          />
        </Field>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors cursor-pointer"
        >
          {submitting ? 'Saving…' : 'Transfer'}
        </button>

        {fromSource && fromSource === toSource && (
          <p className="text-sm text-expense">Source and destination must differ.</p>
        )}
        {status && <p className={`text-sm ${status.ok ? 'text-income' : 'text-expense'}`}>{status.msg}</p>}
      </form>
    </Card>
  );
}
