import { useEffect, useRef, useState } from 'react';
import Card from './Card';
import { inputClass } from './FormField';
import { parseFinanceMessage, parseReceiptImage } from '../lib/groqAgent';
import { addTransaction, addTransfer, addReceipt } from '../lib/sheetsApi';
import { formatAUD } from '../lib/transform';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile';
// Vision-capable model, used only for receipt image scanning. Text chat
// keeps using GROQ_MODEL above. Verify this default is still a live Groq
// model name if receipt scanning starts failing with a model-not-found error.
const GROQ_VISION_MODEL = import.meta.env.VITE_GROQ_VISION_MODEL || 'llama-3.2-90b-vision-preview';

const WELCOME = 'Tell me about a transaction or transfer, e.g. "Spent $45 on groceries at Woolworths from Commonwealth today" or "Transfer $200 from Commonwealth to ING Savings". Or tap the receipt icon to scan a photo of a receipt.';

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
}

export default function ChatBot({ metadata, token, onSaved }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: WELCOME }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingReceipt, setPendingReceipt] = useState(null); // { total, items } awaiting confirm/reject
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy, pendingReceipt]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    if (!GROQ_API_KEY) {
      setMessages((m) => [
        ...m,
        { role: 'user', text },
        { role: 'assistant', error: true, text: 'VITE_GROQ_API_KEY is not set. Add it to frontend/.env.' },
      ]);
      setInput('');
      return;
    }

    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setBusy(true);

    try {
      const parsed = await parseFinanceMessage({ apiKey: GROQ_API_KEY, model: GROQ_MODEL, message: text, metadata });

      if (parsed.action === 'transaction') {
        const { date, amount, type, source, subCategory, comment } = parsed;
        if (!amount || !type || !source || !subCategory) {
          throw new Error('Could not extract amount, type, source, and category from that. Try being more specific.');
        }
        await addTransaction(token, { date, amount, type, source, subCategory, comment });
        onSaved?.();
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: `✅ Added ${type.toLowerCase()} of ${formatAUD(Math.abs(amount))} — "${source}" / ${subCategory}${
              comment ? ` ("${comment}")` : ''
            } on ${date}.`,
          },
        ]);
      } else if (parsed.action === 'transfer') {
        const { date, amount, fromSource, toSource, comment } = parsed;
        if (!amount || !fromSource || !toSource) {
          throw new Error('Could not extract amount, source, and destination for that transfer. Try being more specific.');
        }
        await addTransfer(token, { date, amount, fromSource, toSource, comment });
        onSaved?.();
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text: `✅ Transferred ${formatAUD(amount)} from "${fromSource}" to "${toSource}" on ${date} (2 linked transactions recorded).`,
          },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            error: true,
            text: parsed.reason || "I couldn't understand that as a transaction or transfer. Include an amount, a source, and a category.",
          },
        ]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', error: true, text: `❌ ${err.message || String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  function handleReceiptButtonClick() {
    if (busy || pendingReceipt) return;
    fileInputRef.current?.click();
  }

  async function handleReceiptFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    if (!GROQ_API_KEY) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', error: true, text: 'VITE_GROQ_API_KEY is not set. Add it to frontend/.env.' },
      ]);
      return;
    }

    setMessages((m) => [...m, { role: 'user', text: `📷 Uploaded receipt: ${file.name}` }]);
    setBusy(true);

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const { total, items } = await parseReceiptImage({
        apiKey: GROQ_API_KEY,
        model: GROQ_VISION_MODEL,
        imageDataUrl,
      });

      if (!total || items.length === 0) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            error: true,
            text: "❌ Couldn't read a total and line items from that photo. Try a clearer, well-lit shot of the full receipt.",
          },
        ]);
        return;
      }

      const lines = items.map((it) => `• ${it.name} — ${formatAUD(it.amount)}`).join('\n');
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `Here's what I found:\n\n${lines}\n\nTotal: ${formatAUD(total)}\n\nAdd this to Receipt / Receipt_Items?`,
        },
      ]);
      setPendingReceipt({ total, items });
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', error: true, text: `❌ ${err.message || String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  async function handleReceiptConfirm(confirmed) {
    if (!pendingReceipt || busy) return;

    if (!confirmed) {
      setPendingReceipt(null);
      setMessages((m) => [...m, { role: 'assistant', text: 'Okay, discarded that receipt. Nothing was saved.' }]);
      return;
    }

    setBusy(true);
    try {
      const { total, items } = pendingReceipt;
      const { receiptId } = await addReceipt(token, { total, items });
      setPendingReceipt(null);
      onSaved?.();
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `✅ Saved receipt (${items.length} item${items.length === 1 ? '' : 's'}, total ${formatAUD(
            total
          )}) — Receipt ID ${receiptId}.`,
        },
      ]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', error: true, text: `❌ ${err.message || String(err)}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Finance Assistant" className="max-w-2xl mx-auto flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-accent text-white'
                  : m.error
                  ? 'bg-expense/10 text-expense border border-expense/30'
                  : 'bg-bg-raised text-text-primary'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {pendingReceipt && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm bg-bg-raised text-text-primary flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleReceiptConfirm(true)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-income/20 text-income hover:bg-income/30 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
              >
                Yes, add it
              </button>
              <button
                type="button"
                onClick={() => handleReceiptConfirm(false)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-expense/20 text-expense hover:bg-expense/30 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors cursor-pointer"
              >
                No, discard
              </button>
            </div>
          </div>
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm bg-bg-raised text-text-muted">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleReceiptFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleReceiptButtonClick}
          disabled={busy || !!pendingReceipt}
          aria-label="Scan a receipt photo"
          title="Scan a receipt photo"
          className="px-3 py-2.5 rounded-lg bg-bg-raised text-text-secondary hover:text-text-primary hover:bg-bg-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l1.5-3h15l1.5 3M3 7.5v10.5A1.5 1.5 0 004.5 19.5h15a1.5 1.5 0 001.5-1.5V7.5M3 7.5h18M12 10.5a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
          </svg>
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Paid $32 for coffee with Cash yesterday"
          className={inputClass + ' flex-1'}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium transition-colors cursor-pointer"
        >
          Send
        </button>
      </form>
    </Card>
  );
}