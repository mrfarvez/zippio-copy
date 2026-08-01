import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './setup';

export default function DoughnutChart({ labels, data, colors, height = 240, center }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#16202B',
          borderWidth: 3,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 14 } },
          tooltip: { backgroundColor: '#1C2833', titleColor: '#F1F4F1', bodyColor: '#8B9AA8', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, padding: 12 },
        },
      },
      plugins: center ? [{
        id: 'center',
        afterDraw(chart) {
          const { ctx: c } = chart;
          const x = chart.chartArea.left + (chart.chartArea.right - chart.chartArea.left) / 2;
          const y = chart.chartArea.top + (chart.chartArea.bottom - chart.chartArea.top) / 2;
          c.save();
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.font = "700 26px 'Space Grotesk', sans-serif";
          c.fillStyle = '#F1F4F1';
          c.fillText(center.value, x, y - 8);
          c.font = "11px 'JetBrains Mono', monospace";
          c.fillStyle = '#8B9AA8';
          c.fillText(center.label, x, y + 16);
          c.restore();
        },
      }] : [],
    });
    return () => chart.destroy();
  }, [labels, data, colors, center]);

  return <div className="chart-box" style={{ height }}><canvas ref={ref} /></div>;
}
