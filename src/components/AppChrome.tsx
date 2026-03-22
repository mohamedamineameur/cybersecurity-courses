import type { PropsWithChildren } from 'react'
import type { AppLanguage, DeferredInstallPrompt, Route } from '../app/types'

type AppChromeProps = PropsWithChildren<{
  route: Route
  language: AppLanguage
  installPrompt: DeferredInstallPrompt | null
  isInstalled: boolean
  t: (key: string) => string
  onHome: () => void
  onQuizzes: () => void
  onAcronyms: () => void
  onInstall: () => void
  onLanguageChange: (language: AppLanguage) => void
}>

export function AppChrome({
  route,
  language,
  installPrompt,
  isInstalled,
  t,
  onHome,
  onQuizzes,
  onAcronyms,
  onInstall,
  onLanguageChange,
  children,
}: AppChromeProps) {
  const quizzesActive = route.name === 'quizzes' || route.name === 'quiz' || route.name === 'exam'

  return (
    <div className="appShell">
      <header className="topBar">
        <div
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
        >
          <div className="brandMark" aria-hidden="true">
            S+
          </div>
          <div className="brandText">
            <div className="brandTitle">{t('brand.title')}</div>
            <div className="brandSub">{t('brand.subtitle')}</div>
          </div>
        </div>

        <div className="topBarRight">
          {installPrompt && !isInstalled ? (
            <button className="btnPrimary installBtn" onClick={onInstall}>
              {t('pwa.install')}
            </button>
          ) : null}
          {isInstalled ? <span className="pill accent">{t('pwa.installed')}</span> : null}
          <div className="langSwitcher">
            <button
              className={language === 'fr' ? 'active' : ''}
              onClick={() => onLanguageChange('fr')}
              aria-label="Français"
            >
              FR
            </button>
            <button
              className={language === 'en' ? 'active' : ''}
              onClick={() => onLanguageChange('en')}
              aria-label="English"
            >
              EN
            </button>
          </div>
          <nav className="topNav">
            <button className={['navBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={onHome}>
              {t('nav.revise')}
            </button>
            <button className={['navBtn', quizzesActive ? 'active' : ''].join(' ')} onClick={onQuizzes}>
              {t('nav.quizzes')}
            </button>
            <button className={['navBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')} onClick={onAcronyms}>
              {t('nav.acronyms')}
            </button>
          </nav>
        </div>
      </header>

      <main className="main">{children}</main>

      <footer className="bottomBar" aria-label="Navigation">
        <button className={['bottomBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={onHome}>
          <span className="bottomIcon" aria-hidden="true">
            ⌁
          </span>
          <span className="bottomLabel">{t('nav.home')}</span>
        </button>
        <button className={['bottomBtn', quizzesActive ? 'active' : ''].join(' ')} onClick={onQuizzes}>
          <span className="bottomIcon" aria-hidden="true">
            ?!
          </span>
          <span className="bottomLabel">{t('nav.quizzes')}</span>
        </button>
        <button className={['bottomBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')} onClick={onAcronyms}>
          <span className="bottomIcon" aria-hidden="true">
            Aa
          </span>
          <span className="bottomLabel">{t('nav.acronyms')}</span>
        </button>
      </footer>
    </div>
  )
}
