import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './setup';

export default function LineChart({ labels, series, height = 280, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          backgroundColor: s.fill !== false ? s.color + '22' : 'transparent',
          fill: s.fill !== false,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: s.points === false ? 0 : 3,
          pointHoverRadius: 5,
          pointBackgroundColor: s.color,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: series.length > 1, labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#1C2833',
            titleColor: '#F1F4F1',
            bodyColor: '#8B9AA8',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 12,
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono', monospace", size: 11 } } },
          y: {
            beginAtZero: true,
            ticks: { font: { family: "'JetBrains Mono', monospace", size: 11 } },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [labels, series]);

  return <div className={`chart-box ${height === 200 ? 'sm' : ''} ${className}`} style={{ height }}><canvas ref={ref} /></div>;
}
