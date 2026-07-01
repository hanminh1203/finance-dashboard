const SHEET_ID = import.meta.env.VITE_SHEET_ID;
const TRANSACTIONS_TABLE = import.meta.env.VITE_TRANSACTIONS_TABLE || 'Transactions';
const CATEGORY_TABLE = import.meta.env.VITE_CATEGORY_TABLE || 'Category';
const SOURCES_TABLE = import.meta.env.VITE_SOURCES_TABLE || 'Sources';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Raw input columns written by addTransaction/addTransfer, matched by header
// name within whichever table is configured as TRANSACTIONS_TABLE. Any other
// columns in that table (Main Category, Type, Month, Balance, ...) are left
// alone — as a real Sheets "Table", it auto-extends its own formula columns
// when a new row is added, so we never touch them.
const INPUT_COLUMNS = ['Date', 'Change', 'Source', 'Comment', 'Sub category'];

let tablesCache = null; // { [tableName]: TableInfo }, cached for the session

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

function columnLetter(index) {
  // 0-based column index -> A1 column letters (0 -> A, 25 -> Z, 26 -> AA, ...)
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Loads Table metadata (name, sheet, range, column names) for every table in
 * the spreadsheet in a single lightweight request — this is metadata only,
 * no cell values, so it's cheap regardless of how much data the sheet holds.
 */
async function getTables(token) {
  if (tablesCache) return tablesCache;
  const data = await request(
    token,
    '?fields=sheets(properties(sheetId,title),tables(name,range,columnProperties))'
  );
  const byName = {};
  for (const sheet of data.sheets || []) {
    for (const table of sheet.tables || []) {
      byName[table.name] = {
        sheetId: sheet.properties.sheetId,
        sheetTitle: sheet.properties.title,
        range: table.range, // GridRange: 0-indexed, endRow/endColumn exclusive
        columns: (table.columnProperties || [])
          .map((c, i) => ({ index: c.columnIndex ?? i, name: c.columnName }))
          .sort((a, b) => a.index - b.index),
      };
    }
  }
  tablesCache = byName;
  return byName;
}

async function getTable(token, tableName) {
  const tables = await getTables(token);
  const t = tables[tableName];
  if (!t) throw new Error(`Table "${tableName}" not found. Did you run Convert to Table on it?`);
  return t;
}

/** A1 range for the whole table including its header row. */
function fullRangeA1(t) {
  const startCol = columnLetter(t.range.startColumnIndex);
  const endCol = columnLetter(t.range.endColumnIndex - 1);
  const startRow = t.range.startRowIndex + 1;
  const endRow = t.range.endRowIndex; // exclusive already -> inclusive last row
  return `${t.sheetTitle}!${startCol}${startRow}:${endCol}${endRow}`;
}

/** A1 range for just the table's data rows (header excluded). */
function dataRangeA1(t) {
  const startCol = columnLetter(t.range.startColumnIndex);
  const endCol = columnLetter(t.range.endColumnIndex - 1);
  const startRow = t.range.startRowIndex + 2; // skip header row
  const endRow = t.range.endRowIndex;
  return `${t.sheetTitle}!${startCol}${startRow}:${endCol}${endRow}`;
}

async function getValues(token, a1Range) {
  const data = await request(token, `/values/${encodeURIComponent(a1Range)}`);
  return data.values || [];
}

async function batchGetValues(token, a1Ranges) {
  const qs = a1Ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const data = await request(token, `/values:batchGet?${qs}`);
  return data.valueRanges.map((vr) => vr.values || []);
}

/**
 * Reads only the Transactions table's own range — not the whole sheet.
 */
export async function getTransactionData(token) {
  const table = await getTable(token, TRANSACTIONS_TABLE);
  const values = await getValues(token, dataRangeA1(table));
  const headers = table.columns.map((c) => c.name);
  const headerStartRow = table.range.startRowIndex + 2; // first data row, 1-indexed

  const rows = [];
  values.forEach((row, i) => {
    if (!row || row.every((c) => c === '' || c == null)) return;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    obj.__row = headerStartRow + i;
    rows.push(obj);
  });
  return { headers, rows };
}

/**
 * Reads the Category and Sources tables in a single batched request, using
 * each table's own defined range (still no full-sheet reads).
 */
export async function getMetadata(token) {
  const [categoryTable, sourcesTable] = await Promise.all([
    getTable(token, CATEGORY_TABLE),
    getTable(token, SOURCES_TABLE),
  ]);

  const [categoryValues, sourcesValues] = await batchGetValues(token, [
    dataRangeA1(categoryTable),
    dataRangeA1(sourcesTable),
  ]);

  const catHeaders = categoryTable.columns.map((c) => c.name);
  const catIdx = {
    main: catHeaders.findIndex((h) => /^main category$/i.test(h)),
    sub: catHeaders.findIndex((h) => /^sub ?category$/i.test(h)),
    type: catHeaders.findIndex((h) => /^type$/i.test(h)),
  };
  const categories = categoryValues
    .filter((r) => r[catIdx.main] && r[catIdx.sub])
    .map((r) => ({
      mainCategory: String(r[catIdx.main]).trim(),
      subCategory: String(r[catIdx.sub]).trim(),
      type: catIdx.type >= 0 ? String(r[catIdx.type] || '').trim() : '',
    }));

  const srcHeaders = sourcesTable.columns.map((c) => c.name);
  const srcIdx = {
    name: srcHeaders.findIndex((h) => /^name$/i.test(h)),
    type: srcHeaders.findIndex((h) => /^type$/i.test(h)),
  };
  const sources = sourcesValues
    .filter((r) => r[srcIdx.name])
    .map((r) => ({
      name: String(r[srcIdx.name]).trim(),
      type: srcIdx.type >= 0 ? String(r[srcIdx.type] || '').trim() : '',
    }));

  return { sources, categories };
}

/**
 * Appends one row of raw input data to the Transactions table, scoped to
 * only the input columns (Date..Sub category) — other columns in the row
 * (Main Category, Type, Month, Balance, ...) are left untouched, and the
 * Table's own auto-fill (Convert to Table's calculated-column behavior)
 * fills them in.
 */
async function appendRow(token, values) {
  const table = await getTable(token, TRANSACTIONS_TABLE);
  const colIndex = {};
  for (const name of INPUT_COLUMNS) {
    const col = table.columns.find((c) => c.name === name);
    if (!col) throw new Error(`Column "${name}" not found in table "${TRANSACTIONS_TABLE}"`);
    colIndex[name] = col.index;
  }
  const indices = INPUT_COLUMNS.map((n) => colIndex[n]);
  const minCol = Math.min(...indices);
  const maxCol = Math.max(...indices);
  if (maxCol - minCol !== INPUT_COLUMNS.length - 1) {
    throw new Error('Input columns must be contiguous in the Transactions table');
  }

  // Re-order the provided values to match actual column order left-to-right.
  const ordered = INPUT_COLUMNS
    .map((name, i) => ({ index: colIndex[name], value: values[i] }))
    .sort((a, b) => a.index - b.index)
    .map((x) => x.value);

  const startCol = columnLetter(minCol);
  const endCol = columnLetter(maxCol);
  const startRow = table.range.startRowIndex + 2; // first data row
  const appendRange = `${table.sheetTitle}!${startCol}${startRow}:${endCol}`;

  await request(
    token,
    `/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [ordered] }) }
  );
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