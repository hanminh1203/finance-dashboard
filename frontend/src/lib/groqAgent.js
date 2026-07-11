const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
 * Sends a receipt photo to a vision-capable Groq model and returns
 * structured JSON: { total, items: [{ name, amount }] }.
 *
 * `imageDataUrl` must be a base64 data URL (e.g. "data:image/jpeg;base64,...").
 * Note: Groq's vision-capable model names change over time — verify the
 * current one in Groq's docs/console if VITE_GROQ_VISION_MODEL's default
 * here is no longer available.
 */
export async function parseReceiptImage({ apiKey, model, imageDataUrl }) {
  const systemPrompt = `You are a receipt-scanning assistant. Look at the receipt image and extract structured data.
Return ONLY valid JSON (no markdown, no extra text) matching exactly this schema:

{"total": number, "items": [{"name": string, "amount": number}]}

Rules:
- "total" is the final total amount actually paid (after tax/discounts), as a positive number.
- "items" is every line item on the receipt with its name and price, each a positive number.
- Use the item names as printed on the receipt (cleaned up if garbled), do not invent items.
- If a field truly cannot be read, omit that item rather than guessing wildly.
- If the image is not a readable receipt at all, return {"total": 0, "items": []}.`;

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
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the total and line items from this receipt.' },
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

  const total = Number(parsed.total) || 0;
  const items = Array.isArray(parsed.items)
    ? parsed.items
        .map((it) => ({ name: String(it.name || '').trim(), amount: Number(it.amount) || 0 }))
        .filter((it) => it.name && it.amount > 0)
    : [];

  return { total, items };
}
