import { parseAmount } from './transform';

const SHEET_ID = import.meta.env.VITE_SHEET_ID;

// "Transactions" is written to ONLY (raw input rows). All reads for
// dashboard/analytics use "Computed_Transactions" instead, which already
// carries the calculated columns (Main Category, Type, Month, Balance, ...).
const TRANSACTIONS_TABLE = import.meta.env.VITE_TRANSACTIONS_TABLE || 'Transactions';
const COMPUTED_TRANSACTIONS_TABLE = import.meta.env.VITE_COMPUTED_TRANSACTIONS_TABLE || 'Computed_Transactions';
const INCOME_EXPENSE_TABLE = import.meta.env.VITE_INCOME_EXPENSE_TABLE || 'Income vs Expense by Month';
const CATEGORY_TABLE = import.meta.env.VITE_CATEGORY_TABLE || 'Category';
const SOURCES_TABLE = import.meta.env.VITE_SOURCES_TABLE || 'Sources';
// Written by the receipt-scanning chatbot flow only, after user confirmation.
const RECEIPT_TABLE = import.meta.env.VITE_RECEIPT_TABLE || 'Receipt';
const RECEIPT_ITEMS_TABLE = import.meta.env.VITE_RECEIPT_ITEMS_TABLE || 'Receipt_Items';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Raw input columns written by addTransaction/addTransfer, matched by header
// name within the "Transactions" table. Any other columns are left alone —
// as a real Sheets Table, calculated columns auto-extend on new rows.
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

/** Quotes a sheet title for A1 notation if it contains spaces or other special chars. */
function quoteSheetTitle(title) {
  return /^[A-Za-z0-9_]+$/.test(title) ? title : `'${title.replace(/'/g, "''")}'`;
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

/** A1 range for just the table's data rows (header excluded). */
function dataRangeA1(t) {
  const startCol = columnLetter(t.range.startColumnIndex);
  const endCol = columnLetter(t.range.endColumnIndex - 1);
  const startRow = t.range.startRowIndex + 2; // skip header row
  const endRow = t.range.endRowIndex;
  return `${quoteSheetTitle(t.sheetTitle)}!${startCol}${startRow}:${endCol}${endRow}`;
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

function findCol(headers, pattern) {
  return headers.findIndex((h) => pattern.test(String(h || '').trim()));
}

/**
 * Reads only the Computed_Transactions table's own range — not the whole
 * sheet, and not the raw Transactions table (which is write-only from the
 * app's perspective). This is the source for the dashboard trend chart,
 * per-source history, and the category breakdown chart.
 */
export async function getTransactionData(token) {
  const table = await getTable(token, COMPUTED_TRANSACTIONS_TABLE);
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
 * Reads the pre-aggregated "Income vs Expense by Month" table directly —
 * this feeds the left dashboard chart without the app re-deriving monthly
 * totals itself.
 */
export async function getIncomeExpenseByMonth(token) {
  const table = await getTable(token, INCOME_EXPENSE_TABLE);
  const values = await getValues(token, dataRangeA1(table));
  const headers = table.columns.map((c) => c.name);
  const idx = {
    month: findCol(headers, /^month$/i),
    income: findCol(headers, /^income$/i),
    expense: findCol(headers, /^expense$/i),
  };
  return values
    .filter((r) => r[idx.month])
    .map((r) => ({
      month: String(r[idx.month]).trim(),
      income: parseAmount(r[idx.income]),
      expense: parseAmount(r[idx.expense]),
    }));
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
    main: findCol(catHeaders, /^main category$/i),
    sub: findCol(catHeaders, /^sub ?category$/i),
    type: findCol(catHeaders, /^type$/i),
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
    name: findCol(srcHeaders, /^name$/i),
    type: findCol(srcHeaders, /^type$/i),
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
 * Appends one row of raw input data to the *Transactions* table (write-only
 * target — never read back from directly; the app reads Computed_Transactions
 * instead). Scoped to only the input columns; other columns in that row are
 * left untouched for the Table's own calculated-column auto-fill to handle.
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
  const appendRange = `${quoteSheetTitle(table.sheetTitle)}!${startCol}${startRow}:${endCol}`;

  await request(
    token,
    `/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [ordered] }) }
  );
}

/**
 * Generic append helper for simple tables whose input columns are
 * contiguous and cover exactly the columns being written (unlike
 * Transactions, these tables have no separate calculated columns to
 * preserve). Appends one or more rows in a single request.
 *
 * `headerNames` gives the order values are supplied in; rows are
 * re-ordered internally to match the table's actual left-to-right column
 * order before writing.
 */
async function appendRows(token, tableName, headerNames, rowsValues) {
  const table = await getTable(token, tableName);
  const colIndex = {};
  for (const name of headerNames) {
    const col = table.columns.find((c) => c.name === name);
    if (!col) throw new Error(`Column "${name}" not found in table "${tableName}"`);
    colIndex[name] = col.index;
  }
  const indices = headerNames.map((n) => colIndex[n]);
  const minCol = Math.min(...indices);
  const maxCol = Math.max(...indices);
  if (maxCol - minCol !== headerNames.length - 1) {
    throw new Error(`Input columns must be contiguous in table "${tableName}"`);
  }

  const orderedRows = rowsValues.map((values) =>
    headerNames
      .map((name, i) => ({ index: colIndex[name], value: values[i] }))
      .sort((a, b) => a.index - b.index)
      .map((x) => x.value)
  );

  const startCol = columnLetter(minCol);
  const endCol = columnLetter(maxCol);
  const startRow = table.range.startRowIndex + 2; // first data row
  const appendRange = `${quoteSheetTitle(table.sheetTitle)}!${startCol}${startRow}:${endCol}`;

  await request(
    token,
    `/values/${encodeURIComponent(appendRange)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: orderedRows }) }
  );
}

/**
 * Writes a confirmed, scanned receipt to the Receipt / Receipt_Items
 * tables. Generates a fresh Receipt ID (UUID) client-side, writes one row
 * to Receipt (Receipt ID, Total), then one row per line item to
 * Receipt_Items (Receipt ID, Name, Amount). This is independent of the
 * Transactions table — it does not create a transaction row.
 */
export async function addReceipt(token, { total, items }) {
  const totalNum = Math.abs(Number(total));
  if (!totalNum || Number.isNaN(totalNum)) throw new Error('Invalid receipt total');
  if (!Array.isArray(items) || items.length === 0) throw new Error('Receipt has no items');

  const receiptId = crypto.randomUUID();

  await appendRows(token, RECEIPT_TABLE, ['Receipt ID', 'Total'], [[receiptId, totalNum]]);

  const itemRows = items.map((it) => {
    const amount = Math.abs(Number(it.amount));
    if (!it.name || !amount || Number.isNaN(amount)) {
      throw new Error(`Invalid receipt item: ${JSON.stringify(it)}`);
    }
    return [receiptId, it.name, amount];
  });
  await appendRows(token, RECEIPT_ITEMS_TABLE, ['Receipt ID', 'Name', 'Amount'], itemRows);

  return { receiptId, itemsAdded: itemRows.length };
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