import {
  Chart,
  PieController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(
  PieController,
  ArcElement,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  Filler,
);

export default Chart;
