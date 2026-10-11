import { useId } from 'react';
type WeightPoint = { measured_on: string; kg: number };

export function WeightTrend({ entries, playerName }: { entries: WeightPoint[]; playerName: string }) {
  const gradientId = useId().replaceAll(':', '');
  if (!entries.length) return <div className="weight-empty"><span aria-hidden="true">◯</span><p>{playerName} has no weight observations yet.</p></div>;

  const values = entries.map((entry) => Number(entry.kg));
  const min = Math.min(...values); const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.22, 0.5); const low = min - padding; const high = max + padding;
  const coords = entries.map((entry, index) => ({
    x: entries.length === 1 ? 40 : 40 + index * (620 / (entries.length - 1)),
    y: 210 - ((Number(entry.kg) - low) / (high - low)) * 170,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${coords[0]!.x},220 ${line} ${coords.at(-1)!.x},220`;
  const ticks = [high, (high + low) / 2, low];

  return <div className="weight-chart-shell">
    <figure className="weight-trend-figure">
      <svg viewBox="0 0 700 260" role="img" aria-labelledby="weight-chart-title weight-chart-description" preserveAspectRatio="none">
        <title id="weight-chart-title">{playerName}'s weight trend</title>
        <desc id="weight-chart-description">{entries.length} dated measurements, from {entries[0]?.measured_on} to {entries.at(-1)?.measured_on}. The chart is shared with both club members.</desc>
        <defs><linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--forest)" stopOpacity=".18"/><stop offset="100%" stopColor="var(--forest)" stopOpacity="0"/></linearGradient></defs>
        {ticks.map((value, index) => { const y = 35 + index * 85; return <g key={index}><line className="chart-gridline" x1="40" y1={y} x2="660" y2={y}/><text className="chart-axis" x="30" y={y - 7} textAnchor="end">{value.toFixed(1)}</text></g>; })}
        {coords.length > 1 && <polygon points={area} fill={`url(#${gradientId})`} />}
        {coords.length > 1 && <polyline className="weight-trend-line" points={line} />}
        {coords.map((point, index) => <circle className="weight-point" key={entries[index]?.measured_on} cx={point.x} cy={point.y} r={coords.length === 1 ? 7 : 4.5}><title>{entries[index]?.measured_on}: {Number(entries[index]?.kg).toFixed(2)} kg</title></circle>)}
        <text className="chart-date" x="40" y="248">{entries[0]?.measured_on}</text>
        <text className="chart-date" x="660" y="248" textAnchor="end">{entries.at(-1)?.measured_on}</text>
      </svg>
    </figure>
    <div className="weight-table-wrap"><table><caption className="sr-only">Your private weight measurements</caption><thead><tr><th>Date</th><th>Weight (kg)</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.measured_on}><td>{entry.measured_on}</td><td className="score">{Number(entry.kg).toFixed(2)}</td></tr>)}</tbody></table></div>
  </div>;
}
