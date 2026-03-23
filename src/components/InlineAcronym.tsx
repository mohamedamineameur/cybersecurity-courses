import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

type InlineAcronymProps = {
  short: string
  expanded: string
}

export function InlineAcronym({ short, expanded }: InlineAcronymProps) {
  const [open, setOpen] = useState(false)

  return (
    <motion.span
      className={['acronymWrap', open ? 'open' : ''].join(' ')}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          setOpen(false)
        }
      }}
    >
      <motion.button
        type="button"
        className="acronym"
        title={expanded}
        aria-expanded={open}
        aria-label={`${short}: ${expanded}`}
        onClick={() => setOpen((value) => !value)}
        whileTap={{ scale: 0.95 }}
      >
        {short}
      </motion.button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.span
            className="acronymPopover"
            role="tooltip"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {expanded}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </motion.span>
  )
}
