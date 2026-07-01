const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const TRANSACTION_SHEET = import.meta.env.VITE_TRANSACTION_SHEET || 'Transaction';
const METADATA_SHEET = import.meta.env.VITE_METADATA_SHEET || 'Metadata';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

let sheetIdCache = null; // numeric gid, cached per session

async function request(token, path, opts = {}) {
  const res = await fetch(`${BASE}/${SHEET_ID}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function encodeRange(range) {
  return encodeURIComponent(range);
}

/** Fetch all values from a sheet tab (A:Z is enough for our wide tables). */
async function getValues(token, sheetName) {
  const data = await request(token, `/values/${encodeRange(`${sheetName}!A1:Z`)}`);
  return data.values || [];
}

export async function getTransactionData(token) {
  const values = await getValues(token, TRANSACTION_SHEET);
  if (values.length < 2) return { headers: [], rows: [] };
  const headers = values[0].map((h) => String(h).trim());
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every((c) => c === '' || c == null)) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    obj.__row = i + 1;
    rows.push(obj);
  }
  return { headers, rows };
}

/**
 * Parses the Metadata sheet's stacked mini-tables by header name:
 *   "Name" / "Type"                          -> sources
 *   "Main Category" / "Sub category" / "Type" -> categories
 */
export async function getMetadata(token) {
  const values = await getValues(token, METADATA_SHEET);
  const sources = [];
  const categories = [];
  const seenSources = new Set();
  const seenCategories = new Set();

  for (let i = 0; i < values.length; i++) {
    const row = (values[i] || []).map((c) => String(c ?? '').trim());

    if (row[0] === 'Name' && row[1] === 'Type') {
      for (let j = i + 1; j < values.length; j++) {
        const r = values[j] || [];
        const name = String(r[0] ?? '').trim();
        if (!name) break;
        if (name === 'Main Category') break;
        const type = String(r[1] ?? '').trim();
        if (!seenSources.has(name)) {
          seenSources.add(name);
          sources.push({ name, type });
        }
      }
    }

    if (row[0] === 'Main Category' && (row[1] === 'Sub category' || row[1] === 'Sub Category')) {
      for (let j = i + 1; j < values.length; j++) {
        const r = values[j] || [];
        const main = String(r[0] ?? '').trim();
        const sub = String(r[1] ?? '').trim();
        if (!main && !sub) break;
        if (!main || !sub) continue;
        const type = String(r[2] ?? '').trim();
        const key = `${main}|${sub}`;
        if (!seenCategories.has(key)) {
          seenCategories.add(key);
          categories.push({ mainCategory: main, subCategory: sub, type });
        }
      }
    }
  }

  return { sources, categories };
}

async function getTransactionSheetGid(token) {
  if (sheetIdCache != null) return sheetIdCache;
  const data = await request(token, '?fields=sheets.properties');
  const sheet = data.sheets.find((s) => s.properties.title === TRANSACTION_SHEET);
  if (!sheet) throw new Error(`Sheet tab "${TRANSACTION_SHEET}" not found`);
  sheetIdCache = sheet.properties.sheetId;
  return sheetIdCache;
}

/**
 * Appends one row of raw data (columns A–E) to the Transaction sheet, then
 * copies the formulas from the row above (columns F onward — Main Category,
 * Type, Month, Balance) into the new row so those computed columns keep
 * working, exactly as if you'd dragged the formula down by hand.
 */
async function appendRow(token, [date, change, source, comment, subCategory]) {
  const appendRes = await request(
    token,
    `/values/${encodeRange(`${TRANSACTION_SHEET}!A:E`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values: [[date, change, source, comment, subCategory]] }),
    }
  );

  const updatedRange = appendRes.updates?.updatedRange || '';
  const match = updatedRange.match(/![A-Z]+(\d+):/);
  const newRow = match ? parseInt(match[1], 10) : null;

  if (newRow && newRow > 2) {
    await copyFormulasDown(token, newRow);
  }
  return newRow;
}

/** Copies columns F: from (newRow - 1) into newRow via a Sheets batchUpdate CopyPaste request. */
async function copyFormulasDown(token, newRow) {
  const gid = await getTransactionSheetGid(token);
  const source = {
    sheetId: gid,
    startRowIndex: newRow - 2, // 0-indexed, row above
    endRowIndex: newRow - 1,
    startColumnIndex: 5, // column F
    endColumnIndex: 26,
  };
  const destination = {
    sheetId: gid,
    startRowIndex: newRow - 1,
    endRowIndex: newRow,
    startColumnIndex: 5,
    endColumnIndex: 26,
  };
  try {
    await request(token, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: [{ copyPaste: { source, destination, pasteType: 'PASTE_FORMULA' } }],
      }),
    });
  } catch {
    // Non-fatal: if there are no formulas in those columns (e.g. plain values
    // or an ARRAYFORMULA that already auto-extends), this call may no-op or
    // fail harmlessly — the raw transaction row itself is already saved.
  }
}

export async function addTransaction(token, { date, amount, type, source, subCategory, comment }) {
  const abs = Math.abs(Number(amount));
  if (!abs || Number.isNaN(abs)) throw new Error('Invalid amount');
  if (!source) throw new Error('Source is required');
  const signed = type === 'Expense' ? -abs : abs;
  await appendRow(token, [date, signed, source, comment || '', subCategory || '']);
  return { added: 1 };
}

export async function addTransfer(token, { date, amount, fromSource, toSource, comment }) {
  const abs = Math.abs(Number(amount));
  if (!abs || Number.isNaN(abs)) throw new Error('Invalid amount');
  if (!fromSource || !toSource) throw new Error('Both sources are required');
  if (fromSource === toSource) throw new Error('Source and destination must differ');
  const note = comment || 'Exchange';
  // Sequential: each append must land after the previous row.
  await appendRow(token, [date, -abs, fromSource, note, 'Exchange (self)']);
  await appendRow(token, [date, abs, toSource, note, 'Exchange (self)']);
  return { added: 2 };
}
