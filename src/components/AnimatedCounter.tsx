import { animate, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

type AnimatedCounterProps = {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export function AnimatedCounter({
  value,
  duration = 0.9,
  prefix = '',
  suffix = '',
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const isInView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (!isInView) return
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    })
    return () => controls.stop()
  }, [duration, isInView, value])

  return (
    <span ref={ref} className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  )
}
