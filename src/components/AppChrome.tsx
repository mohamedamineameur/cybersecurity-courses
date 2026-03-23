import { LayoutGroup, motion } from 'framer-motion'
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'
import type { AppLanguage, DeferredInstallPrompt, Route, UXPreferences } from '../app/types'

type AppChromeProps = PropsWithChildren<{
  route: Route
  language: AppLanguage
  installPrompt: DeferredInstallPrompt | null
  isInstalled: boolean
  preferences: UXPreferences
  t: (key: string) => string
  onHome: () => void
  onQuizzes: () => void
  onAcronyms: () => void
  onInstall: () => void
  onLanguageChange: (language: AppLanguage) => void
  onToggleSound: () => void
  onToggleFunAnimations: () => void
}>

export function AppChrome({
  route,
  language,
  installPrompt,
  isInstalled,
  preferences,
  t,
  onHome,
  onQuizzes,
  onAcronyms,
  onInstall,
  onLanguageChange,
  onToggleSound,
  onToggleFunAnimations,
  children,
}: AppChromeProps) {
  const quizzesActive = route.name === 'quizzes' || route.name === 'quiz' || route.name === 'exam'
  const [isCompact, setIsCompact] = useState(false)
  const activeNav = useMemo(() => {
    if (route.name === 'home') return 0
    if (quizzesActive) return 1
    return 2
  }, [quizzesActive, route.name])

  useEffect(() => {
    const onScroll = () => setIsCompact(window.scrollY > 22)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="appShell">
      <motion.header
        className={['topBar', isCompact ? 'compact' : ''].join(' ')}
        animate={{
          paddingTop: isCompact ? 12 : 16,
          paddingBottom: isCompact ? 12 : 16,
        }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        <motion.div
          className="brand"
          onClick={onHome}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onHome()
            }
          }}
          role="button"
          tabIndex={0}
          whileHover={{ y: -1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <motion.div
            className="brandMark"
            aria-hidden="true"
            animate={{
              scale: isCompact ? 0.92 : 1,
              rotate: isCompact ? -3 : 0,
            }}
            transition={{ type: 'spring', stiffness: 340, damping: 24 }}
          >
            S+
          </motion.div>
          <div className="brandText">
            <div className="brandTitle">{t('brand.title')}</div>
            <div className="brandSub">{t('brand.subtitle')}</div>
          </div>
        </motion.div>

        <div className="topBarRight">
          {installPrompt && !isInstalled ? (
            <motion.button className="btnPrimary installBtn" onClick={onInstall} whileTap={{ scale: 0.96 }}>
              {t('pwa.install')}
            </motion.button>
          ) : null}
          {isInstalled ? <span className="pill accent">{t('pwa.installed')}</span> : null}
          <div className="funControls" aria-label="Fun controls">
            <button
              className={['funToggle', preferences.soundEnabled ? 'active' : ''].join(' ')}
              onClick={onToggleSound}
              type="button"
              aria-pressed={preferences.soundEnabled}
            >
              <span aria-hidden="true">{preferences.soundEnabled ? '♪' : '·'}</span>
              <span>{language === 'en' ? 'Sound' : 'Son'}</span>
            </button>
            <button
              className={['funToggle', preferences.funAnimationsEnabled ? 'active' : ''].join(' ')}
              onClick={onToggleFunAnimations}
              type="button"
              aria-pressed={preferences.funAnimationsEnabled}
            >
              <span aria-hidden="true">{preferences.funAnimationsEnabled ? '★' : '·'}</span>
              <span>{language === 'en' ? 'Fun' : 'Fun'}</span>
            </button>
          </div>
          <div className="langSwitcher">
            <motion.button
              className={language === 'fr' ? 'active' : ''}
              onClick={() => onLanguageChange('fr')}
              aria-label="Français"
              whileTap={{ scale: 0.96 }}
            >
              FR
            </motion.button>
            <motion.button
              className={language === 'en' ? 'active' : ''}
              onClick={() => onLanguageChange('en')}
              aria-label="English"
              whileTap={{ scale: 0.96 }}
            >
              EN
            </motion.button>
          </div>
          <LayoutGroup id="top-nav">
            <nav className="topNav">
              <button className={['navBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={onHome}>
                {route.name === 'home' ? <motion.span layoutId="topNavActiveBg" className="navActiveBg" /> : null}
                <span className="navBtnLabel">{t('nav.revise')}</span>
              </button>
              <button className={['navBtn', quizzesActive ? 'active' : ''].join(' ')} onClick={onQuizzes}>
                {quizzesActive ? <motion.span layoutId="topNavActiveBg" className="navActiveBg" /> : null}
                <span className="navBtnLabel">{t('nav.quizzes')}</span>
              </button>
              <button className={['navBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')} onClick={onAcronyms}>
                {route.name === 'acronyms' ? <motion.span layoutId="topNavActiveBg" className="navActiveBg" /> : null}
                <span className="navBtnLabel">{t('nav.acronyms')}</span>
              </button>
            </nav>
          </LayoutGroup>
        </div>
      </motion.header>

      <main className="main">{children}</main>

      <footer className="bottomBar" aria-label="Navigation">
        <motion.span
          className="bottomActivePill"
          animate={{
            x: activeNav === 0 ? '0%' : activeNav === 1 ? 'calc(100% + var(--bottom-gap))' : 'calc(200% + (var(--bottom-gap) * 2))',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
        <button className={['bottomBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={onHome}>
          <motion.span
            className="bottomIcon"
            aria-hidden="true"
            animate={route.name === 'home' ? { y: [0, -4, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            ⌁
          </motion.span>
          <motion.span className="bottomLabel" animate={{ opacity: route.name === 'home' ? 1 : 0.72 }}>
            {t('nav.home')}
          </motion.span>
        </button>
        <button className={['bottomBtn', quizzesActive ? 'active' : ''].join(' ')} onClick={onQuizzes}>
          <motion.span
            className="bottomIcon"
            aria-hidden="true"
            animate={quizzesActive ? { y: [0, -4, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            ?!
          </motion.span>
          <motion.span className="bottomLabel" animate={{ opacity: quizzesActive ? 1 : 0.72 }}>
            {t('nav.quizzes')}
          </motion.span>
        </button>
        <button className={['bottomBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')} onClick={onAcronyms}>
          <motion.span
            className="bottomIcon"
            aria-hidden="true"
            animate={route.name === 'acronyms' ? { y: [0, -4, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
            transition={{ duration: 0.45 }}
          >
            Aa
          </motion.span>
          <motion.span className="bottomLabel" animate={{ opacity: route.name === 'acronyms' ? 1 : 0.72 }}>
            {t('nav.acronyms')}
          </motion.span>
        </button>
      </footer>
    </div>
  )
}
