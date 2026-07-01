import { useMemo, useState } from 'react';
import Card from './Card';
import { Field, inputClass, selectClass } from './FormField';
import { addTransaction } from '../lib/sheetsApi';

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AddTransactionForm({ metadata, token, onSaved }) {
  const [type, setType] = useState('Expense');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const categoryOptions = useMemo(
    () => metadata.categories.filter((c) => c.type === type),
    [metadata.categories, type]
  );

  const canSubmit = amount && source && subCategory && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await addTransaction(token, { date, amount, type, source, subCategory, comment });
      setStatus({ ok: true, msg: 'Transaction added.' });
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
    <Card title="Add Transaction" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 bg-bg-raised rounded-lg">
          {['Expense', 'Income'].map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => { setType(t); setSubCategory(''); }}
              className={`py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                type === t
                  ? t === 'Income' ? 'bg-income/20 text-income' : 'bg-expense/20 text-expense'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
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

        <Field label="Source">
          <select value={source} onChange={(e) => setSource(e.target.value)} className={selectClass} required>
            <option value="" disabled>Select a source</option>
            {metadata.sources.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Category">
          <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className={selectClass} required>
            <option value="" disabled>Select a category</option>
            {categoryOptions.map((c) => (
              <option key={`${c.mainCategory}-${c.subCategory}`} value={c.subCategory}>
                {c.mainCategory} — {c.subCategory}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Comment (optional)">
          <input
            type="text"
            placeholder="e.g. Woolworths groceries"
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
          {submitting ? 'Saving…' : `Add ${type}`}
        </button>

        {status && (
          <p className={`text-sm ${status.ok ? 'text-income' : 'text-expense'}`}>{status.msg}</p>
        )}
      </form>
    </Card>
  );
}
