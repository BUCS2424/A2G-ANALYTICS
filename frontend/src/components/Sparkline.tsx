import { CategoryScale, Chart as ChartJS, Filler, LinearScale, LineElement, PointElement } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler)

export default function Sparkline({ data, color }: { data: number[]; color: string }) {
  return (
    <div className="kpi-sparkline">
      <Line
        data={{
          labels: data.map((_, i) => String(i)),
          datasets: [{ data, borderColor: color, backgroundColor: `${color}22`, fill: true, tension: 0.35, pointRadius: 0, borderWidth: 1.5 }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        }}
      />
    </div>
  )
}
