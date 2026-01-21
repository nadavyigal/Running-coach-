'use client'

import { useEffect, useId, useMemo, useState, type PointerEvent } from 'react'

import {
  calculateSegmentPaces,
  downsamplePaceData,
  smoothPaceData,
  type GPSPoint,
  type PaceData,
  type UserPaces,
} from '@/lib/pace-calculations'

type PaceChartProps = {
  gpsPath: GPSPoint[]
  userPaces?: UserPaces
}

type ChartPoint = {
  entry: PaceData
  x: number
  y: number
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

const formatDistanceLabel = (distanceKm: number): string =>
  `${distanceKm.toFixed(1)}km`

const getNearestIndex = (target: number, distances: number[]): number => {
  let low = 0
  let high = distances.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const value = distances[mid]
    if (value === undefined) return mid
    if (value === target) return mid
    if (value < target) {
      low = mid + 1
    } else {
      high = mid - 1
    }
  }

  if (low <= 0) return 0
  if (low >= distances.length) return distances.length - 1
  const lower = distances[low - 1]
  const upper = distances[low]
  if (lower === undefined || upper === undefined) return low - 1
  return target - lower <= upper - target ? low - 1 : low
}

export function PaceChart({ gpsPath, userPaces }: PaceChartProps) {
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
        distances: [] as number[],
        minPace: 0,
        maxPace: 0,
        maxDistance: 0,
        paceTicks: [] as number[],
        distanceTicks: [] as number[],
      }
    }

    const paceValues = processedData
      .map((entry) => entry.paceMinPerKm)
      .filter((value) => Number.isFinite(value))
    if (paceValues.length === 0) {
      return {
        points: [] as ChartPoint[],
        distances: [] as number[],
        minPace: 0,
        maxPace: 0,
        maxDistance: 0,
        paceTicks: [] as number[],
        distanceTicks: [] as number[],
      }
    }

    const minPace = Math.min(...paceValues)
    const maxPace = Math.max(...paceValues)
    const maxDistance = processedData.at(-1)?.distanceKm ?? 0

    const paceMin = Math.floor(minPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const paceMax = Math.ceil(maxPace / PACE_STEP_MIN) * PACE_STEP_MIN
    const normalizedMax = paceMax === paceMin ? paceMin + PACE_STEP_MIN : paceMax

    const paceTicks: number[] = []
    for (let pace = paceMin; pace <= normalizedMax + 1e-6; pace += PACE_STEP_MIN) {
      paceTicks.push(Number(pace.toFixed(2)))
    }

    const distanceTicks: number[] = []
    const maxLabel = Math.floor(maxDistance)
    for (let km = 0; km <= maxLabel; km += 1) {
      distanceTicks.push(km)
    }

    const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
    const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
    const paceRange = normalizedMax - paceMin

    const scaleX = (distanceKm: number) => {
      if (maxDistance <= 0) return PADDING.left
      return PADDING.left + (distanceKm / maxDistance) * plotWidth
    }

    const scaleY = (paceMinPerKm: number) => {
      const ratio = paceRange > 0 ? (paceMinPerKm - paceMin) / paceRange : 0
      return PADDING.top + (1 - ratio) * plotHeight
    }

    const points = processedData.map((entry) => ({
      entry,
      x: scaleX(entry.distanceKm),
      y: scaleY(entry.paceMinPerKm),
    }))

    return {
      points,
      distances: points.map((point) => point.entry.distanceKm),
      minPace: paceMin,
      maxPace: normalizedMax,
      maxDistance,
      paceTicks,
      distanceTicks,
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

  if (chartMetrics.points.length === 0 || chartMetrics.maxDistance <= 0) {
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
    const distanceRatio = (clampedX - PADDING.left) / plotWidth
    const targetDistance = distanceRatio * chartMetrics.maxDistance
    return getNearestIndex(targetDistance, chartMetrics.distances)
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

  const zoneRects = userPaces
    ? [
        {
          from: chartMetrics.minPace,
          to: Math.min(userPaces.tempoPace, chartMetrics.maxPace),
          className: 'fill-red-200/40',
        },
        {
          from: Math.max(userPaces.tempoPace, chartMetrics.minPace),
          to: Math.min(userPaces.easyPace, chartMetrics.maxPace),
          className: 'fill-yellow-200/40',
        },
        {
          from: Math.max(userPaces.easyPace, chartMetrics.minPace),
          to: chartMetrics.maxPace,
          className: 'fill-green-200/40',
        },
      ].filter((zone) => zone.to > zone.from)
    : []

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
        </defs>

        <rect
          x={PADDING.left}
          y={PADDING.top}
          width={plotWidth}
          height={plotHeight}
          className="fill-white"
        />

        {zoneRects.map((zone, index) => {
          const yTop = scaleY(zone.from)
          const yBottom = scaleY(zone.to)
          return (
            <rect
              key={`zone-${index}`}
              x={PADDING.left}
              y={yTop}
              width={plotWidth}
              height={Math.max(0, yBottom - yTop)}
              className={zone.className}
            />
          )
        })}

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

        {chartMetrics.distanceTicks.map((km) => {
          const x = PADDING.left + (km / chartMetrics.maxDistance) * plotWidth
          return (
            <text
              key={`distance-${km}`}
              x={x}
              y={VIEWBOX_HEIGHT - 10}
              textAnchor="middle"
              className="fill-gray-500 text-[12px]"
            >
              {km}km
            </text>
          )
        })}

        <g clipPath={`url(#${clipId})`}>
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
                  VIEWBOX_WIDTH - PADDING.right - 170
                )}
                y={Math.max(activePoint.y - 28, PADDING.top)}
                width={170}
                height={22}
                rx={6}
                className="fill-gray-900/80"
              />
              <text
                x={Math.min(
                  activePoint.x + 20,
                  VIEWBOX_WIDTH - PADDING.right - 162
                )}
                y={Math.max(activePoint.y - 12, PADDING.top + 14)}
                className="fill-white text-[12px]"
              >
                {formatPaceLabel(activePoint.entry.paceMinPerKm)} min/km at{' '}
                {formatDistanceLabel(activePoint.entry.distanceKm)}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
