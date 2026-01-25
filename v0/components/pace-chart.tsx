'use client'

import { useEffect, useId, useMemo, useState, type PointerEvent } from 'react'

import {
  calculateSegmentPaces,
  downsamplePaceData,
  smoothPaceData,
  type GPSPoint,
  type PaceData,
} from '@/lib/pace-calculations'

type PaceChartProps = {
  gpsPath: GPSPoint[]
}

type ChartPoint = {
  entry: PaceData
  x: number
  y: number
  elapsedMs: number
}

const VIEWBOX_WIDTH = 1000
const VIEWBOX_HEIGHT = 300
const PADDING = {
  top: 16,
  right: 24,
  bottom: 36,
  left: 52,
}
const PACE_STEP_MIN = 0.5
const MIN_GPS_POINTS = 10
const MAX_CHART_POINTS = 200

const formatPaceLabel = (paceMinPerKm: number): string => {
  if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) return '--:--'
  const totalSeconds = Math.round(paceMinPerKm * 60)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatElapsedTime = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const computeTimeTicks = (maxTimeMs: number): number[] => {
  if (maxTimeMs <= 0) return [0]

  const totalSeconds = maxTimeMs / 1000
  let interval: number

  if (totalSeconds <= 300) interval = 30000        // 30s for runs < 5min
  else if (totalSeconds <= 1800) interval = 60000  // 1min for runs < 30min
  else if (totalSeconds <= 3600) interval = 300000 // 5min for runs < 1hr
  else interval = 600000                           // 10min for longer runs

  const ticks: number[] = []
  for (let t = 0; t <= maxTimeMs; t += interval) {
    ticks.push(t)
  }
  return ticks
}

const getNearestIndex = (target: number, values: number[]): number => {
  let low = 0
  let high = values.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = values[mid]
    if (value === undefined) return mid
    if (value === target) return mid
    if (value < target) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (low <= 0) return 0
  if (low >= values.length) return values.length - 1
  const lower = values[low - 1]
  const upper = values[low]
  if (lower === undefined || upper === undefined) return low - 1
  return target - lower <= upper - target ? low - 1 : low
}

export function PaceChart({ gpsPath }: PaceChartProps) {
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
    if (processedData.length === 0) {
      return {
        points: [] as ChartPoint[],
        elapsedTimes: [] as number[],
        minPace: 0,
        maxPace: 0,
        maxTimeMs: 0,
        paceTicks: [] as number[],
        timeTicks: [] as number[],
      }
    }

    const paceValues = processedData
      .map((entry) => entry.paceMinPerKm)
      .filter((value) => Number.isFinite(value))
    if (paceValues.length === 0) {
      return {
        points: [] as ChartPoint[],
        elapsedTimes: [] as number[],
        minPace: 0,
        maxPace: 0,
        maxTimeMs: 0,
        paceTicks: [] as number[],
        timeTicks: [] as number[],
      }
    }

    const minPace = Math.min(...paceValues)
    const maxPace = Math.max(...paceValues)

    // Calculate time range from timestamps
    const startTime = processedData[0]?.timestamp.getTime() ?? 0
    const maxTimeMs = (processedData.at(-1)?.timestamp.getTime() ?? 0) - startTime

    const paceMin = Math.floor(minPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const paceMax = Math.ceil(maxPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const normalizedMax = paceMax === paceMin ? paceMin + PACE_STEP_MIN : paceMax

    const paceTicks: number[] = []
    for (let pace = paceMin; pace <= normalizedMax + 1e-6; pace += PACE_STEP_MIN) {
      paceTicks.push(Number(pace.toFixed(2)))
    }

    // Calculate time ticks instead of distance ticks
    const timeTicks = computeTimeTicks(maxTimeMs)

    const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
    const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
    const paceRange = normalizedMax - paceMin

    const scaleX = (timestamp: Date) => {
      const elapsedMs = timestamp.getTime() - startTime
      if (maxTimeMs <= 0) return PADDING.left
      return PADDING.left + (elapsedMs / maxTimeMs) * plotWidth
    }

    const scaleY = (paceMinPerKm: number) => {
      const ratio = paceRange > 0 ? (paceMinPerKm - paceMin) / paceRange : 0
      return PADDING.top + (1 - ratio) * plotHeight
    }

    const points = processedData.map((entry) => {
      const elapsedMs = entry.timestamp.getTime() - startTime
      return {
        entry,
        x: scaleX(entry.timestamp),
        y: scaleY(entry.paceMinPerKm),
        elapsedMs,
      }
    })

    return {
      points,
      elapsedTimes: points.map((point) => point.elapsedMs),
      minPace: paceMin,
      maxPace: normalizedMax,
      maxTimeMs,
      paceTicks,
      timeTicks,
    }
  }, [processedData])

  if (isPreparing && gpsPath.length > 0) {
    return <div className="h-[300px] w-full animate-pulse rounded-lg bg-gray-100" />
  }

  if (!gpsPath || gpsPath.length === 0) {
    return (
      <div className="h-[300px] w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-600">
        GPS data unavailable
      </div>
    )
  }

  if (gpsPath.length < MIN_GPS_POINTS || processedData.length < MIN_GPS_POINTS - 1) {
    return (
      <div className="h-[300px] w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-600">
        Insufficient data for chart
      </div>
    )
  }

  if (chartMetrics.points.length === 0 || chartMetrics.maxTimeMs <= 0) {
    return (
      <div className="h-[300px] w-full rounded-lg border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-600">
        Insufficient data for chart
      </div>
    )
  }

  const activePoint = supportsHover && hoverIndex !== null
    ? chartMetrics.points[hoverIndex]
    : activeIndex !== null
      ? chartMetrics.points[activeIndex]
      : null

  const pathD = chartMetrics.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
  const paceRange = chartMetrics.maxPace - chartMetrics.minPace

  const scaleY = (paceMinPerKm: number) => {
    const ratio = paceRange > 0 ? (paceMinPerKm - chartMetrics.minPace) / paceRange : 0
    return PADDING.top + (1 - ratio) * plotHeight
  }

  const handlePointerPosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return null
    const relativeX = event.clientX - rect.left
    const viewBoxX = (relativeX / rect.width) * VIEWBOX_WIDTH
    const clampedX = Math.max(PADDING.left, Math.min(viewBoxX, VIEWBOX_WIDTH - PADDING.right))
    const timeRatio = (clampedX - PADDING.left) / plotWidth
    const targetTimeMs = timeRatio * chartMetrics.maxTimeMs
    return getNearestIndex(targetTimeMs, chartMetrics.elapsedTimes)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!supportsHover || event.pointerType === 'touch') return
    const index = handlePointerPosition(event)
    if (index === null) return
    setHoverIndex(index)
  }

  const handlePointerLeave = () => {
    if (!supportsHover) return
    setHoverIndex(null)
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const index = handlePointerPosition(event)
    if (index === null) return
    setActiveIndex(index)
  }

  // Generate area path for gradient fill
  const firstPoint = chartMetrics.points[0]
  const lastPoint = chartMetrics.points[chartMetrics.points.length - 1]
  const plotBottom = VIEWBOX_HEIGHT - PADDING.bottom
  const areaPathD = firstPoint && lastPoint
    ? `${pathD} L ${lastPoint.x} ${plotBottom} L ${firstPoint.x} ${plotBottom} Z`
    : ''

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-[300px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Pace chart"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={PADDING.left}
              y={PADDING.top}
              width={plotWidth}
              height={plotHeight}
            />
          </clipPath>
          <linearGradient id={`${clipId}-gradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotWidth}
          height={plotHeight}
          className="fill-white"
        />

        {chartMetrics.paceTicks.map((pace) => {
          const y = scaleY(pace)
          return (
            <g key={`pace-${pace}`}>
              <line
                x1={PADDING.left}
                x2={VIEWBOX_WIDTH - PADDING.right}
                y1={y}
                y2={y}
                className="stroke-gray-200"
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-500 text-[12px]"
              >
                {formatPaceLabel(pace)}
              </text>
            </g>
          )
        })}

        {chartMetrics.timeTicks.map((timeMs) => {
          const x = chartMetrics.maxTimeMs > 0
            ? PADDING.left + (timeMs / chartMetrics.maxTimeMs) * plotWidth
            : PADDING.left
          return (
            <text
              key={`time-${timeMs}`}
              x={x}
              y={VIEWBOX_HEIGHT - 10}
              textAnchor="middle"
              className="fill-gray-500 text-[12px]"
            >
              {formatElapsedTime(timeMs)}
            </text>
          )
        })}

        <g clipPath={`url(#${clipId})`}>
          {areaPathD && (
            <path d={areaPathD} fill={`url(#${clipId}-gradient)`} />
          )}
          <path d={pathD} className="fill-none stroke-blue-500" strokeWidth={2} />
        </g>

        {supportsHover && hoverIndex !== null && chartMetrics.points[hoverIndex] && (
          <line
            x1={chartMetrics.points[hoverIndex].x}
            x2={chartMetrics.points[hoverIndex].x}
            y1={PADDING.top}
            y2={VIEWBOX_HEIGHT - PADDING.bottom}
            className="stroke-gray-300"
            strokeDasharray="4 4"
          />
        )}

        {activePoint && (
          <>
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={4}
              className="fill-blue-600"
            />
            <g>
              <rect
                x={Math.min(
                  activePoint.x + 12,
                  VIEWBOX_WIDTH - PADDING.right - 180
                )}
                y={Math.max(activePoint.y - 28, PADDING.top)}
                width={180}
                height={22}
                rx={6}
                className="fill-gray-900/80"
              />
              <text
                x={Math.min(
                  activePoint.x + 20,
                  VIEWBOX_WIDTH - PADDING.right - 172
                )}
                y={Math.max(activePoint.y - 12, PADDING.top + 14)}
                className="fill-white text-[12px]"
              >
                {formatPaceLabel(activePoint.entry.paceMinPerKm)} min/km at{' '}
                {formatElapsedTime(activePoint.elapsedMs)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
