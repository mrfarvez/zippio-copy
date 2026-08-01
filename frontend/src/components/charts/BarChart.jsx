import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './setup';

export default function BarChart({ labels, data, color = '#35D0A0', height = 280, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Score',
          data,
          backgroundColor: Array.isArray(color) ? color : data.map((_, i) => (Array.isArray(color) ? color[i] : color)),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 34,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1C2833', titleColor: '#F1F4F1', bodyColor: '#8B9AA8', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 12 },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono', monospace", size: 11 } } },
          y: { beginAtZero: true, max: 100, ticks: { font: { family: "'JetBrains Mono', monospace", size: 11 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [labels, data, color]);

  return <div className={`chart-box ${height === 200 ? 'sm' : ''} ${className}`} style={{ height }}><canvas ref={ref} /></div>;
}
