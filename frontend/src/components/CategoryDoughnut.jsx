import { Doughnut } from 'react-chartjs-2';
import '../lib/chartSetup';
import { formatAUD } from '../lib/transform';

const PALETTE = ['#2563EB', '#22C55E', '#F59E0B', '#F43F5E', '#A855F7', '#06B6D4', '#EC4899', '#84CC16', '#71717A'];

export default function CategoryDoughnut({ breakdown }) {
  const top = breakdown.slice(0, 8);
  const rest = breakdown.slice(8);
  const restTotal = rest.reduce((s, c) => s + c.amount, 0);
  const labels = top.map((c) => c.category).concat(restTotal > 0 ? ['Other'] : []);
  const values = top.map((c) => c.amount).concat(restTotal > 0 ? [restTotal] : []);

  const data = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: PALETTE,
        borderColor: '#151517',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', color: '#A1A1AA' },
      },
      tooltip: {
        backgroundColor: '#1C1C1F',
        borderColor: '#2A2A2E',
        borderWidth: 1,
        padding: 10,
        titleColor: '#F4F4F5',
        bodyColor: '#F4F4F5',
        callbacks: { label: (ctx) => `${ctx.label}: ${formatAUD(ctx.parsed)}` },
      },
    },
  };

  if (values.length === 0) {
    return <div className="h-64 flex items-center justify-center text-text-muted text-sm">No expenses this period</div>;
  }

  return (
    <div className="h-64 sm:h-72">
      <Doughnut data={data} options={options} />
    </div>
  );
}
