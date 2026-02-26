"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"

interface AnimatedMetricValueProps {
  value: number
  durationMs?: number
  decimals?: number
  formatter?: (value: number) => string
  className?: string
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function AnimatedMetricValue({
  value,
  durationMs = 420,
  decimals = 0,
  formatter,
  className,
}: AnimatedMetricValueProps) {
  const prefersReducedMotion = useReducedMotion()
  const [displayValue, setDisplayValue] = useState(value)
  const previousValueRef = useRef(value)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!Number.isFinite(value)) return

    if (prefersReducedMotion) {
      previousValueRef.current = value
      return
    }

    const startValue = previousValueRef.current
    if (Math.abs(startValue - value) < 0.0001) {
      previousValueRef.current = value
      return
    }

    const startTime = performance.now()
    const delta = value - startValue

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs)
      const eased = easeOutCubic(progress)
      const nextValue = startValue + delta * eased
      setDisplayValue(nextValue)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        setDisplayValue(value)
        previousValueRef.current = value
      }
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [durationMs, prefersReducedMotion, value])

  const computedValue = prefersReducedMotion ? value : displayValue
  const roundedValue = useMemo(() => Number(computedValue.toFixed(decimals)), [computedValue, decimals])
  const content = formatter ? formatter(roundedValue) : roundedValue.toLocaleString()

  return <span className={className}>{content}</span>
}
