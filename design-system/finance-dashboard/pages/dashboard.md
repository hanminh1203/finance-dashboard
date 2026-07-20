# Page Override: Overview (Dashboard)

> See also `frontend/design-system/finance-dashboard/pages/dashboard.md` (canonical for implementation).

Extends `../MASTER.md`. Dashboard is **table-first** (no charts), fed by `/api/dashboard`.

## Layout

1. PageHeader
2. Four StatCards: Net Worth, Income, Expense, Saving (current month)
3. Two CategoryBreakdownTable cards (income / expense, last 3 months)
4. This Month Transactions

## Motion

- Stagger fade-up on first paint (`.stagger-children`)
