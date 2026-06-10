'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  from: number
  to: number
  duration?: number
  decimals?: number
  suffix?: string
}

export function AnimatedCounter({
  from,
  to,
  duration = 1200,
  decimals = 1,
  suffix = '',
}: AnimatedCounterProps) {
  const [value, setValue] = useState(from)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = null
    setValue(from)

    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (to - from) * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [from, to, duration])

  return (
    <>
      {value.toFixed(decimals)}
      {suffix}
    </>
  )
}
