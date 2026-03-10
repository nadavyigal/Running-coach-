interface TrendSparklineProps {
  data: number[]
  direction?: 'up-good' | 'down-good'
  width?: number
  height?: number
}

export function TrendSparkline({
  data,
  direction = 'up-good',
  width = 60,
  height = 20,
}: TrendSparklineProps) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const PAD = 2

  const points = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (width - PAD * 2)
    const y = PAD + (1 - (v - min) / range) * (height - PAD * 2)
    return { x, y }
  })

  const polyline = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Determine trend direction
  const first = data[0] ?? 0
  const last = data[data.length - 1] ?? 0
  const isImproving = direction === 'up-good' ? last > first : last < first
  const color = isImproving ? '#10b981' : '#f59e0b'

  const lastPoint = points[points.length - 1] ?? { x: width - 2, y: height / 2 }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="inline-block">
      <path
        d={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastPoint.x} cy={lastPoint.y} r="2" fill={color} />
    </svg>
  )
}
