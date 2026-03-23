import { AnimatePresence, motion } from 'framer-motion'
import type { CelebrationKind } from '../app/types'

type CelebrationEvent = {
  id: number
  kind: CelebrationKind
  title: string
  label?: string
}

type CelebrationBurstProps = {
  event: CelebrationEvent | null
  enabled: boolean
}

const kindIcon: Record<CelebrationKind, string> = {
  success: '✓',
  milestone: '★',
  combo: 'x',
  complete: '↑',
  achievement: '+',
}

function particlesFor(kind: CelebrationKind) {
  const count = kind === 'combo' ? 10 : 14
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count
    const distance = kind === 'complete' ? 72 : 58
    return {
      id: index,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance * 0.72,
      rotate: index * 22,
    }
  })
}

export function CelebrationBurst({ event, enabled }: CelebrationBurstProps) {
  if (!enabled) return null

  return (
    <div className="celebrationViewport" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {event ? (
          <motion.div
            key={event.id}
            className={['celebrationBurst', event.kind].join(' ')}
            initial={{ opacity: 0, y: 18, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.96 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="celebrationCore">
              <div className="celebrationIcon" aria-hidden="true">
                {kindIcon[event.kind]}
              </div>
              <div className="celebrationText">
                <div className="celebrationTitle">{event.title}</div>
                {event.label ? <div className="celebrationLabel">{event.label}</div> : null}
              </div>
            </div>
            <div className="celebrationParticles" aria-hidden="true">
              {particlesFor(event.kind).map((particle) => (
                <motion.span
                  key={particle.id}
                  className="celebrationParticle"
                  initial={{ opacity: 0.95, x: 0, y: 0, rotate: 0, scale: 0.5 }}
                  animate={{
                    opacity: 0,
                    x: particle.x,
                    y: particle.y,
                    rotate: particle.rotate,
                    scale: 1,
                  }}
                  transition={{ duration: 0.75, ease: 'easeOut' }}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export type { CelebrationEvent }
