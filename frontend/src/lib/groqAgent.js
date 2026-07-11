const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const RECEIPT_UNITS = ['kg', 'g', 'ml', 'l', 'piece'];

/**
 * Sends a natural-language message to Groq and returns structured JSON
 * describing a transaction, transfer, or "unknown" if it couldn't be parsed.
 */
export async function parseFinanceMessage({ apiKey, model, message, metadata }) {
  const sourceNames = metadata.sources.map((s) => s.name);
  const categoryList = metadata.categories.map(
    (c) => `${c.mainCategory} > ${c.subCategory} (${c.type})`
  );
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a finance assistant that extracts structured transaction data from natural language.
Return ONLY valid JSON (no markdown, no extra text) matching exactly one of these schemas:

Transaction: {"action":"transaction","date":"YYYY-MM-DD","amount":number,"type":"Income"|"Expense","source":"<one of sources>","subCategory":"<one of sub categories>","comment":"string"}
Transfer: {"action":"transfer","date":"YYYY-MM-DD","amount":number,"fromSource":"<source>","toSource":"<source>","comment":"string"}
Unknown: {"action":"unknown","reason":"string"}

Today's date is ${today}. Use it if the message doesn't mention a date. Resolve relative dates ("yesterday", "last Monday") against today.

Available sources (use EXACTLY as written): ${sourceNames.join(', ')}
Available categories, format "Main > Sub (Type)" (use the Sub value EXACTLY as written): ${categoryList.join('; ')}

Rules:
- amount must be a positive number (never negative).
- source/fromSource/toSource must exactly match one of the available sources.
- subCategory must exactly match one of the available sub categories, and its Type must match the transaction type (Income/Expense).
- If the message is a transfer between two of the user's own sources (e.g. "move", "transfer"), use the Transfer schema.
- If required info (amount, source, or category/destination) is missing, ambiguous, or doesn't match the available lists, return the Unknown schema with a short, specific reason.
- Do not invent sources or categories that aren't in the lists.`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Groq API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from Groq');

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Groq returned a non-JSON response');
  }
}

/**
 * Reads a File/Blob as a data-URL, optionally downscaling so the payload
 * stays within Groq vision limits.
 */
export async function fileToDataUrl(file, { maxEdge = 1536, quality = 0.85 } = {}) {
  const rawUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (!String(rawUrl).startsWith('data:image/')) {
    throw new Error('Selected file is not an image');
  }

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = rawUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1 && file.size < 3_500_000) return rawUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function normalizeUnit(unit) {
  const u = String(unit || '').trim().toLowerCase();
  if (RECEIPT_UNITS.includes(u)) return u;
  if (['pcs', 'pc', 'ea', 'each', 'unit', 'units', 'x'].includes(u)) return 'piece';
  if (['kilogram', 'kilograms', 'kgs'].includes(u)) return 'kg';
  if (['gram', 'grams', 'gm'].includes(u)) return 'g';
  if (['millilitre', 'milliliter', 'millilitres', 'milliliters', 'mls'].includes(u)) return 'ml';
  if (['litre', 'liter', 'litres', 'liters'].includes(u)) return 'l';
  return 'piece';
}

/**
 * Uses a Groq vision model to OCR/extract receipt fields from an image.
 * Returns form-ready values; caller should replace the whole form state.
 */
export async function extractReceiptFromImage({ apiKey, model, imageDataUrl, metadata }) {
  const visionModel = model || DEFAULT_VISION_MODEL;
  const sourceNames = metadata.sources.map((s) => s.name);
  const expenseCategories = metadata.categories.filter((c) => c.type === 'Expense');
  const categoryList = expenseCategories.map(
    (c) => `${c.mainCategory} > ${c.subCategory}`
  );
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt = `You extract structured receipt data from a receipt photo.
Return ONLY valid JSON matching this schema:
{
  "store": "string",
  "date": "YYYY-MM-DD",
  "subCategory": "string",
  "comment": "string",
  "sources": [{"source": "string", "amount": number}],
  "items": [{"name": "string", "amount": number, "unit": "kg"|"g"|"ml"|"l"|"piece", "money": number}]
}

Today's date is ${today}. Use it only if the receipt date is unreadable.
Available payment sources (use EXACTLY as written when you can infer one; otherwise use ""): ${sourceNames.join(', ') || '(none)'}
Available expense sub categories (use the Sub value EXACTLY as written): ${categoryList.join('; ') || '(none)'}

Rules:
- Read every purchasable line item. Skip tax-only / change / total / payment lines as items.
- items[].money is the line price paid (positive number). items[].amount is quantity/weight (default 1).
- items[].unit must be one of: kg, g, ml, l, piece. Prefer piece when unclear.
- Sum of items[].money should equal the receipt total (or as close as readable).
- sources: if payment method maps to an available source, use it; otherwise one entry with source "" and amount = receipt total.
- If split tender is visible, emit multiple sources whose amounts sum to the total.
- subCategory: best match from the available expense list based on store/items; "" if none fit.
- comment: short note (e.g. "groceries") or "".
- store: merchant name as printed.
- Never invent sources or sub categories that are not in the lists (blank is ok).
- All money/amount fields are positive numbers.`;

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the receipt fields from this image into the JSON schema.',
            },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Groq API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from Groq');

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq returned a non-JSON response');
  }

  const allowedSources = new Set(sourceNames);
  const allowedSubs = new Set(expenseCategories.map((c) => c.subCategory));

  const items = (Array.isArray(parsed.items) ? parsed.items : [])
    .map((it) => ({
      name: String(it?.name || '').trim(),
      amount: it?.amount === '' || it?.amount == null ? '' : String(it.amount),
      unit: normalizeUnit(it?.unit),
      money: it?.money === '' || it?.money == null ? '' : String(Math.abs(Number(it.money)) || ''),
    }))
    .filter((it) => it.name || it.money);

  const sources = (Array.isArray(parsed.sources) ? parsed.sources : [])
    .map((s) => {
      const raw = String(s?.source || '').trim();
      return {
        source: allowedSources.has(raw) ? raw : '',
        amount: s?.amount === '' || s?.amount == null ? '' : String(Math.abs(Number(s.amount)) || ''),
      };
    })
    .filter((s) => s.source || s.amount);

  const sub = String(parsed.subCategory || '').trim();
  const dateStr = String(parsed.date || '').trim();

  return {
    store: String(parsed.store || '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : today,
    subCategory: allowedSubs.has(sub) ? sub : '',
    comment: String(parsed.comment || '').trim(),
    sources: sources.length ? sources : [{ source: '', amount: '' }],
    items: items.length ? items : [{ name: '', amount: '', unit: 'piece', money: '' }],
  };
}
