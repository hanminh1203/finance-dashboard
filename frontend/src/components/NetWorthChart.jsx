import { Line } from 'react-chartjs-2';
import '../lib/chartSetup';
import { formatAUD, formatDateShort } from '../lib/transform';

export default function NetWorthChart({ points }) {
  const data = {
    labels: points.map((p) => formatDateShort(p.date)),
    datasets: [
      {
        label: 'Net worth',
        data: points.map((p) => p.total),
        borderColor: '#2563EB',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1C1C1F',
        borderColor: '#2A2A2E',
        borderWidth: 1,
        padding: 10,
        titleColor: '#F4F4F5',
        bodyColor: '#F4F4F5',
        callbacks: {
          label: (ctx) => formatAUD(ctx.parsed.y),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, color: '#71717A' },
      },
      y: {
        grid: { color: '#1C1C1F' },
        ticks: {
          color: '#71717A',
          callback: (v) => formatAUD(v),
        },
      },
    },
  };

  return (
    <div className="h-64 sm:h-80">
      <Line data={data} options={options} />
    </div>
  );
}
