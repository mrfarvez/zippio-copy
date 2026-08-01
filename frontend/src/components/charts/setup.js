import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#8B9AA8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.08)';
