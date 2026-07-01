import { useMemo, useState } from 'react';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import NetWorthChart from '../components/NetWorthChart';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import CategoryDoughnut from '../components/CategoryDoughnut';
import TransactionList from '../components/TransactionList';
import { currentBalances, monthlySummary, netWorthTrend, categoryBreakdown } from '../lib/transform';

export default function Dashboard({ transactions }) {
  const [monthFilter, setMonthFilter] = useState('all');

  const balances = useMemo(() => currentBalances(transactions), [transactions]);
  const netWorth = useMemo(() => Object.values(balances).reduce((s, b) => s + b, 0), [balances]);
  const months = useMemo(() => monthlySummary(transactions), [transactions]);
  const trend = useMemo(() => netWorthTrend(transactions), [transactions]);
  const breakdown = useMemo(() => categoryBreakdown(transactions, monthFilter), [transactions, monthFilter]);
  const recent = useMemo(() => transactions.slice().sort((a, b) => b.date - a.date).slice(0, 8), [transactions]);

  const latestMonth = months[months.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Net Worth" value={netWorth} tone="accent" sublabel="Across all sources" />
        <StatCard
          label="This Month Income"
          value={latestMonth?.income || 0}
          tone="income"
          sublabel={latestMonth?.month}
        />
        <StatCard
          label="This Month Expense"
          value={latestMonth?.expense || 0}
          tone="expense"
          sublabel={latestMonth?.month}
        />
      </div>

      <Card title="Net Worth Trend">
        <NetWorthChart points={trend} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Income vs Expense by Month">
          <IncomeExpenseChart months={months} />
        </Card>

        <Card
          title="Spending by Category"
          action={
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-bg-raised border border-bg-border rounded-lg px-2 py-1 text-xs text-text-secondary cursor-pointer"
            >
              <option value="all">All time</option>
              {months.map((m) => (
                <option key={m.month} value={m.month}>{m.month}</option>
              ))}
            </select>
          }
        >
          <CategoryDoughnut breakdown={breakdown} />
        </Card>
      </div>

      <Card title="Recent Transactions">
        <TransactionList transactions={recent} />
      </Card>
    </div>
  );
}
