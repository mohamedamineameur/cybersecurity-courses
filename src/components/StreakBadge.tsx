import { motion } from 'framer-motion'

type StreakBadgeProps = {
  value: number
  label: string
  tone?: 'default' | 'hot'
}

export function StreakBadge({ value, label, tone = 'default' }: StreakBadgeProps) {
  return (
    <motion.div
      className={['streakBadge', tone].join(' ')}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
    >
      <motion.span
        className="streakBadgeValue"
        animate={tone === 'hot' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={tone === 'hot' ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.6 } : { duration: 0.2 }}
      >
        {value}
      </motion.span>
      <span className="streakBadgeLabel">{label}</span>
    </motion.div>
  )
}
