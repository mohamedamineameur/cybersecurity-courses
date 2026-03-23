import { AnimatePresence, motion } from 'framer-motion'

type ToastTone = 'success' | 'info' | 'warning'

export type ToastState = {
  id: number
  title?: string
  message: string
  tone: ToastTone
  icon?: string
  badge?: string
}

type ToastViewportProps = {
  toast: ToastState | null
}

export function ToastViewport({ toast }: ToastViewportProps) {
  return (
    <div className="toastViewport" aria-live="polite" aria-atomic="true">
      <AnimatePresence mode="wait">
        {toast ? (
          <motion.div
            key={toast.id}
            className={['toast', toast.tone].join(' ')}
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            <span className="toastIcon" aria-hidden="true">
              {toast.icon ?? (toast.tone === 'success' ? '✓' : toast.tone === 'warning' ? '!' : 'i')}
            </span>
            <span className="toastBody">
              {toast.title ? <span className="toastTitle">{toast.title}</span> : null}
              <span className="toastMessage">{toast.message}</span>
            </span>
            {toast.badge ? <span className="toastBadge">{toast.badge}</span> : null}
            <motion.span
              className="toastProgress"
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 2.55, ease: 'linear' }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
