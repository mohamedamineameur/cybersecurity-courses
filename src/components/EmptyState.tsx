import { motion } from 'framer-motion'

type EmptyStateProps = {
  icon: string
  title: string
  body: string
}

export function EmptyState({ icon, title, body }: EmptyStateProps) {
  return (
    <motion.div
      className="emptyState"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <motion.div
        className="emptyStateIcon"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      >
        {icon}
      </motion.div>
      <div className="emptyStateTitle">{title}</div>
      <div className="muted">{body}</div>
    </motion.div>
  )
}
