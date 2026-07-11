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
const RECEIPT_TABLE = import.meta.env.VITE_RECEIPT_TABLE || 'Receipt';
const RECEIPT_ITEMS_TABLE = import.meta.env.VITE_RECEIPT_ITEMS_TABLE || 'Receipt_Items';
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Raw input columns written by addTransaction/addTransfer, matched by header
// name within the "Transactions" table. Any other columns are left alone —
// as a real Sheets Table, calculated columns auto-extend on new rows.
const INPUT_COLUMNS = ['Date', 'Change', 'Source', 'Comment', 'Sub category'];
const RECEIPT_COLUMNS = ['Receipt ID', 'Date', 'Total'];
const RECEIPT_ITEM_COLUMNS = ['Receipt ID', 'Name', 'Amount', 'Unit', 'Money'];
const RECEIPT_TX_COLUMNS = ['Date', 'Change', 'Source', 'Comment', 'Sub category', 'Receipt ID'];

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
 * Appends one or more rows to a Sheets Table, scoped to the named columns.
 * Other columns in those rows are left untouched for calculated-column
 * auto-fill. Column names must be contiguous in the table.
 */
async function appendRows(token, tableName, columnNames, rows) {
  if (!rows.length) return;
  const table = await getTable(token, tableName);
  const colIndex = {};
  for (const name of columnNames) {
    const col = table.columns.find((c) => c.name === name);
    if (!col) throw new Error(`Column "${name}" not found in table "${tableName}"`);
    colIndex[name] = col.index;
  }
  const indices = columnNames.map((n) => colIndex[n]);
  const minCol = Math.min(...indices);
  const maxCol = Math.max(...indices);
  if (maxCol - minCol !== columnNames.length - 1) {
    throw new Error(`Columns must be contiguous in table "${tableName}"`);
  }

  // Re-order each row's values to match actual column order left-to-right.
  const orderedRows = rows.map((values) =>
    columnNames
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

async function appendRow(token, values) {
  await appendRows(token, TRANSACTIONS_TABLE, INPUT_COLUMNS, [values]);
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

/**
 * Saves a receipt + its line items, then one expense transaction per payment
 * source (all linked by Receipt ID). Receipt Total = sum of item Money.
 * Source amounts must sum to that total.
 */
export async function addReceipt(token, { date, store, subCategory, comment, sources, items }) {
  if (!date) throw new Error('Date is required');
  if (!store?.trim()) throw new Error('Store is required');
  if (!subCategory) throw new Error('Sub category is required');
  if (!Array.isArray(items) || items.length === 0) throw new Error('At least one item is required');
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('At least one payment source is required');

  const normalizedItems = items.map((it, i) => {
    const name = String(it.name || '').trim();
    const amount = Number(it.amount);
    const unit = String(it.unit || '').trim();
    const money = Math.abs(Number(it.money));
    if (!name) throw new Error(`Item ${i + 1}: name is required`);
    if (!unit) throw new Error(`Item ${i + 1}: unit is required`);
    if (!money || Number.isNaN(money)) throw new Error(`Item ${i + 1}: invalid money`);
    if (Number.isNaN(amount)) throw new Error(`Item ${i + 1}: invalid amount`);
    return { name, amount, unit, money };
  });

  const normalizedSources = sources.map((s, i) => {
    const source = String(s.source || '').trim();
    const amount = Math.abs(Number(s.amount));
    if (!source) throw new Error(`Source ${i + 1}: source is required`);
    if (!amount || Number.isNaN(amount)) throw new Error(`Source ${i + 1}: invalid amount`);
    return { source, amount };
  });

  const total = Math.round(normalizedItems.reduce((sum, it) => sum + it.money, 0) * 100) / 100;
  const sourceTotal = Math.round(normalizedSources.reduce((sum, s) => sum + s.amount, 0) * 100) / 100;
  if (Math.abs(total - sourceTotal) > 0.009) {
    throw new Error(`Source amounts (${sourceTotal}) must equal items total (${total})`);
  }

  const receiptId = crypto.randomUUID();
  const commentText = `${store.trim()} : ${comment || ''}`.trim();

  await appendRows(token, RECEIPT_TABLE, RECEIPT_COLUMNS, [[receiptId, date, total]]);
  await appendRows(
    token,
    RECEIPT_ITEMS_TABLE,
    RECEIPT_ITEM_COLUMNS,
    normalizedItems.map((it) => [receiptId, it.name, it.amount, it.unit, it.money])
  );
  await appendRows(
    token,
    TRANSACTIONS_TABLE,
    RECEIPT_TX_COLUMNS,
    normalizedSources.map((s) => [
      date,
      -s.amount,
      s.source,
      commentText,
      subCategory,
      receiptId,
    ])
  );

  return { receiptId, total, items: normalizedItems.length, transactions: normalizedSources.length };
}