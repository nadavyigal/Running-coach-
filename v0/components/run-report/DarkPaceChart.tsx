'use client'

import { useEffect, useId, useMemo, useState, type PointerEvent } from 'react'
import { Activity } from 'lucide-react'
import {
  calculateSegmentPaces,
  downsamplePaceData,
  smoothPaceData,
  type GPSPoint,
  type PaceData,
} from '@/lib/pace-calculations'

interface DarkPaceChartProps {
  gpsPath: GPSPoint[]
}

type ChartPoint = {
  entry: PaceData
  x: number
  y: number
  distanceKm: number
}

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 300
const PADDING = { top: 16, right: 24, bottom: 36, left: 52 }
const PACE_STEP_MIN = 0.5
const MIN_GPS_POINTS = 10
const MAX_CHART_POINTS = 200

const TEAL = '#40DCBE'
const GRID_COLOR = 'rgba(255,255,255,0.06)'
const AXIS_COLOR = 'rgba(255,255,255,0.3)'

function formatPaceLabel(paceMinPerKm: number): string {
  if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) return '--:--'
  const totalSeconds = Math.round(paceMinPerKm * 60)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return '0'
  return distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm).toString()
}

function computeDistanceTicks(maxDistanceKm: number): number[] {
  if (maxDistanceKm <= 0) return [0]
  let interval: number
  if (maxDistanceKm <= 1) interval = 0.2
  else if (maxDistanceKm <= 5) interval = 0.5
  else if (maxDistanceKm <= 10) interval = 1
  else if (maxDistanceKm <= 21) interval = 2
  else interval = 5
  const ticks: number[] = []
  for (let d = 0; d <= maxDistanceKm; d += interval) {
    ticks.push(Number(d.toFixed(2)))
  }
  return ticks
}

function getNearestIndex(target: number, values: number[]): number {
  let low = 0
  let high = values.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = values[mid]
    if (value === undefined) return mid
    if (value === target) return mid
    if (value < target) low = mid + 1
    else high = mid - 1
  }
  if (low <= 0) return 0
  if (low >= values.length) return values.length - 1
  const lower = values[low - 1]
  const upper = values[low]
  if (lower === undefined || upper === undefined) return low - 1
  return target - lower <= upper - target ? low - 1 : low
}

export function DarkPaceChart({ gpsPath }: DarkPaceChartProps) {
  const clipId = useId()
  const [isPreparing, setIsPreparing] = useState(true)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [supportsHover, setSupportsHover] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(hover: hover)')
    const update = () => setSupportsHover(media.matches)
    update()
    if (media.addEventListener) {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }
    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setIsPreparing(true)
    const handle = window.requestAnimationFrame(() => setIsPreparing(false))
    return () => window.cancelAnimationFrame(handle)
  }, [gpsPath])

  const processedData = useMemo(() => {
    const raw = calculateSegmentPaces(gpsPath)
    if (raw.length === 0) return []
    const smoothed = smoothPaceData(raw, 3)
    return downsamplePaceData(smoothed, MAX_CHART_POINTS)
  }, [gpsPath])

  const chartMetrics = useMemo(() => {
    const empty = {
      points: [] as ChartPoint[], distances: [] as number[],
      minPace: 0, maxPace: 0, maxDistanceKm: 0,
      paceTicks: [] as number[], distanceTicks: [] as number[],
    }
    if (processedData.length === 0) return empty
    const paceValues = processedData.map(e => e.paceMinPerKm).filter(v => Number.isFinite(v))
    if (paceValues.length === 0) return empty

    const minPace = Math.min(...paceValues)
    const maxPace = Math.max(...paceValues)
    const maxDistanceKm = processedData.at(-1)?.distanceKm ?? 0
    const paceMin = Math.floor(minPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const paceMax = Math.ceil(maxPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const normalizedMax = paceMax === paceMin ? paceMin + PACE_STEP_MIN : paceMax

    const paceTicks: number[] = []
    for (let pace = paceMin; pace <= normalizedMax + 1e-6; pace += PACE_STEP_MIN) {
      paceTicks.push(Number(pace.toFixed(2)))
    }
    const distanceTicks = computeDistanceTicks(maxDistanceKm)

    const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
    const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
    const paceRange = normalizedMax - paceMin

    const scaleX = (d: number) =>
      maxDistanceKm <= 0 ? PADDING.left : PADDING.left + (d / maxDistanceKm) * plotWidth
    const scaleY = (p: number) =>
      PADDING.top + (paceRange > 0 ? (p - paceMin) / paceRange : 0) * plotHeight

    const points = processedData.map(entry => ({
      entry, distanceKm: entry.distanceKm,
      x: scaleX(entry.distanceKm), y: scaleY(entry.paceMinPerKm),
    }))

    return {
      points, distances: points.map(p => p.distanceKm),
      minPace: paceMin, maxPace: normalizedMax,
      maxDistanceKm, paceTicks, distanceTicks,
    }
  }, [processedData])

  if (!gpsPath || gpsPath.length < MIN_GPS_POINTS) return null
  if (isPreparing) {
    return (
      <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
        <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
      </div>
    )
  }
  if (chartMetrics.points.length === 0 || chartMetrics.maxDistanceKm <= 0) return null

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
  const paceRange = chartMetrics.maxPace - chartMetrics.minPace
  const scaleY = (p: number) =>
    PADDING.top + (paceRange > 0 ? (p - chartMetrics.minPace) / paceRange : 0) * plotHeight

  const pathD = chartMetrics.points
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ')
  const first = chartMetrics.points[0]
  const last = chartMetrics.points[chartMetrics.points.length - 1]
  const plotBottom = VIEWBOX_HEIGHT - PADDING.bottom
  const areaPathD = first && last
    ? `${pathD} L ${last.x} ${plotBottom} L ${first.x} ${plotBottom} Z`
    : ''

  const activePoint = supportsHover && hoverIndex !== null
    ? chartMetrics.points[hoverIndex]
    : activeIndex !== null ? chartMetrics.points[activeIndex] : null

  const handlePointerPosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return null
    const viewBoxX = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH
    const clampedX = Math.max(PADDING.left, Math.min(viewBoxX, VIEWBOX_WIDTH - PADDING.right))
    const targetDist = ((clampedX - PADDING.left) / plotWidth) * chartMetrics.maxDistanceKm
    return getNearestIndex(targetDist, chartMetrics.distances)
  }

  return (
    <div className="mx-4 bg-slate-900/60 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-[#40DCBE]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[#40DCBE]/70">
          Pace Over Distance
        </span>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-64 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Pace chart"
        onPointerMove={e => {
          if (!supportsHover || e.pointerType === 'touch') return
          const idx = handlePointerPosition(e)
          if (idx !== null) setHoverIndex(idx)
        }}
        onPointerLeave={() => supportsHover && setHoverIndex(null)}
        onPointerDown={e => {
          const idx = handlePointerPosition(e)
          if (idx !== null) setActiveIndex(idx)
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PADDING.left} y={PADDING.top} width={plotWidth} height={plotHeight} />
          </clipPath>
          <linearGradient id={`${clipId}-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity="0.15" />
            <stop offset="100%" stopColor={TEAL} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Plot background */}
        <rect
          x={PADDING.left} y={PADDING.top}
          width={plotWidth} height={plotHeight}
          fill="rgba(15,23,42,0.4)"
        />

        {/* Horizontal grid lines + pace labels */}
        {chartMetrics.paceTicks.map(pace => {
          const y = scaleY(pace)
          return (
            <g key={`pace-${pace}`}>
              <line x1={PADDING.left} x2={VIEWBOX_WIDTH - PADDING.right} y1={y} y2={y}
                stroke={GRID_COLOR} />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end"
                fill={AXIS_COLOR} fontSize={12}>
                {formatPaceLabel(pace)}
              </text>
            </g>
          )
        })}

        {/* Distance axis labels */}
        {chartMetrics.distanceTicks.map(d => {
          const x = chartMetrics.maxDistanceKm > 0
            ? PADDING.left + (d / chartMetrics.maxDistanceKm) * plotWidth
            : PADDING.left
          return (
            <text key={`dist-${d}`} x={x} y={VIEWBOX_HEIGHT - 10} textAnchor="middle"
              fill={AXIS_COLOR} fontSize={12}>
              {formatDistance(d)}
            </text>
          )
        })}

        {/* Area fill + pace line */}
        <g clipPath={`url(#${clipId})`}>
          {areaPathD && <path d={areaPathD} fill={`url(#${clipId}-grad)`} />}
          <path d={pathD} fill="none" stroke={TEAL} strokeWidth={2} />
        </g>

        {/* Hover crosshair */}
        {supportsHover && hoverIndex !== null && chartMetrics.points[hoverIndex] && (
          <line
            x1={chartMetrics.points[hoverIndex].x} x2={chartMetrics.points[hoverIndex].x}
            y1={PADDING.top} y2={VIEWBOX_HEIGHT - PADDING.bottom}
            stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4"
          />
        )}

        {/* Active point tooltip */}
        {activePoint && (
          <>
            <circle cx={activePoint.x} cy={activePoint.y} r={4} fill={TEAL} />
            <rect
              x={Math.min(activePoint.x + 12, VIEWBOX_WIDTH - PADDING.right - 190)}
              y={Math.max(activePoint.y - 28, PADDING.top)}
              width={190} height={24} rx={6}
              fill="rgba(15,23,42,0.9)"
              stroke="rgba(64,220,190,0.3)" strokeWidth={1}
            />
            <text
              x={Math.min(activePoint.x + 20, VIEWBOX_WIDTH - PADDING.right - 182)}
              y={Math.max(activePoint.y - 11, PADDING.top + 15)}
              fill="white" fontSize={12}
            >
              {formatPaceLabel(activePoint.entry.paceMinPerKm)} min/km · {formatDistance(activePoint.distanceKm)}km
            </text>
          </>
        )}
      </svg>
    </div>
  )
}
