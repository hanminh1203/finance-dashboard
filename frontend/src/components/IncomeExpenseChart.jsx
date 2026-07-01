import { Bar } from 'react-chartjs-2';
import '../lib/chartSetup';
import { formatAUD } from '../lib/transform';

export default function IncomeExpenseChart({ months }) {
  const data = {
    labels: months.map((m) => m.month),
    datasets: [
      {
        label: 'Income',
        data: months.map((m) => m.income),
        backgroundColor: '#22C55E',
        borderRadius: 4,
        maxBarThickness: 28,
      },
      {
        label: 'Expense',
        data: months.map((m) => Math.abs(m.expense)),
        backgroundColor: '#F43F5E',
        borderRadius: 4,
        maxBarThickness: 28,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        backgroundColor: '#1C1C1F',
        borderColor: '#2A2A2E',
        borderWidth: 1,
        padding: 10,
        titleColor: '#F4F4F5',
        bodyColor: '#F4F4F5',
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatAUD(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#71717A' } },
      y: { grid: { color: '#1C1C1F' }, ticks: { color: '#71717A', callback: (v) => formatAUD(v) } },
    },
  };

  return (
    <div className="h-64 sm:h-80">
      <Bar data={data} options={options} />
    </div>
  );
}
