# Page Override: Overview (Dashboard)

> **Hierarchy:** Overrides `../MASTER.md` for the `/` route.
> **Product shape:** Matches dashboard API from commit `9c76038` (table-first, no charts).

## Data source

- Props: `data` from `useFinanceData().dashboard` (`/api/dashboard`)
- Fields: `summary`, `months` (3 rolling months), `incomeBreakdown`, `expenseBreakdown`, `transactions` (current month only)

## Layout (top → bottom)

1. **PageHeader** — “Overview” + short description of current month + 3-month breakdowns
2. **KPI grid** — `1 / 2 / 4` columns (mobile / sm / xl):
   - Net Worth (`accent`)
   - This Month Income (`income`)
   - This Month Expense (`expense`)
   - This Month Saving (`income` if ≥ 0 else `expense`)
   - Sublabel on month KPIs: latest month key (`YYYY/MM`)
3. **Breakdown row** — two equal cards (stack on mobile):
   - Income Breakdown by Subcategory → `CategoryBreakdownTable`
   - Expense Breakdown by Subcategory → `CategoryBreakdownTable`
4. **This Month Transactions** — `TransactionList` (non-paginated list from API)

## CategoryBreakdownTable

- Columns: Subcategory + one column per month in `months`
- Empty cells: `-` (muted)
- Month-over-month: small up/down indicator (green / red) vs previous column
- Footer row: **Total** with bold amounts
- Horizontal scroll on narrow viewports (`min-w-[480px]`)

## Visual tokens (Quiet Ledger)

- Use `StatCard` tone bars, `Card` uppercase section titles, `tabular-money` for amounts
- Stagger entrance: `.stagger-children` on page root
- **No** Chart.js / doughnut / net-worth line on this page

## Loading skeleton

Mirror layout: header bar → 4 stat placeholders → 2 tall table placeholders → transaction block.

## Empty states

- Income table: “No income in the last three months”
- Expense table: “No expenses in the last three months”
- Transactions: “No transactions this month”
