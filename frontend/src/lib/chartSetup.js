import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "'IBM Plex Sans', sans-serif";
ChartJS.defaults.color = '#A1A1AA';
ChartJS.defaults.borderColor = '#2A2A2E';
