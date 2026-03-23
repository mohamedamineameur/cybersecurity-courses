import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import './App.css'
import { createAudioEngine } from './app/audio'
import { AppI18nContext, createTranslator, normalizeLanguage } from './app/i18n'
import {
  MOCK_EXAM_DURATION_MS,
  MOCK_EXAM_QUESTION_COUNT,
  areMockExamStatesEqual,
  areQuizStatesEqual,
  buildMockExamPool,
  buildMockExamQuestions,
  clamp,
  computeMockExamScore,
  findTopic,
  getAcronyms,
  setHashRoute,
  toSavedMockExamSession,
  topicKey,
  topicText,
  useCourseData,
  useHashRoute,
  useLocalStorageState,
} from './app/helpers'
import type {
  AppLanguage,
  AppSoundCue,
  CelebrationKind,
  DeferredInstallPrompt,
  FlatTopicEntry,
  MockExamQuestion,
  MockExamState,
  QuizStoredState,
  Route,
  SavedMockExamSession,
  UXPreferences,
} from './app/types'

import { AppChrome } from './components/AppChrome'
import { CelebrationBurst, type CelebrationEvent } from './components/CelebrationBurst'
import { LoadingSkeletonPage } from './components/LoadingSkeletonPage'
import { Quiz } from './components/Quiz'
import { ToastViewport, type ToastState } from './components/ToastViewport'
import { AcronymsPage } from './pages/AcronymsPage'
import { HomePage } from './pages/HomePage'
import { MockExamPage } from './pages/MockExamPage'
import { QuizHubPage } from './pages/QuizHubPage'
import { TopicPage } from './pages/TopicPage'

function getRouteDepth(route: Route) {
  switch (route.name) {
    case 'home':
      return 0
    case 'acronyms':
    case 'quizzes':
      return 1
    case 'topic':
      return 2
    case 'quiz':
    case 'exam':
      return 3
    default:
      return 0
  }
}

function compareRouteDirection(prevRoute: Route, nextRoute: Route): 1 | -1 {
  const prevDepth = getRouteDepth(prevRoute)
  const nextDepth = getRouteDepth(nextRoute)
  if (nextDepth === prevDepth) return 1
  return nextDepth > prevDepth ? 1 : -1
}

function forceScrollTop() {
  window.scrollTo(0, 0)
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
}

function App() {
  const route = useHashRoute()
  const { data: course, err } = useCourseData()
  const audioEngine = useMemo(() => createAudioEngine(), [])
  const [query, setQuery] = useState('')
  const [language, setLanguageState] = useLocalStorageState<AppLanguage>('appLanguageV1', 'fr')
  const [preferences, setPreferences] = useLocalStorageState<UXPreferences>('uxPreferencesV1', {
    soundEnabled: true,
    funAnimationsEnabled: true,
  })
  const [doneTopics, setDoneTopics] = useLocalStorageState<Record<string, number>>('doneTopicsV1', {})
  const [quizScores, setQuizScores] = useLocalStorageState<Record<string, { best: number; total: number; at: number }>>('quizScoresV1', {})
  const [quizStates, setQuizStates] = useLocalStorageState<Record<string, QuizStoredState>>('quizStatesV1', {})
  const [mockExamState, setMockExamState] = useLocalStorageState<MockExamState | null>('mockExamStateV1', null)
  const [mockExamHistory, setMockExamHistory] = useLocalStorageState<SavedMockExamSession[]>('mockExamHistoryV1', [])
  const [reviewMockExam, setReviewMockExam] = useState<SavedMockExamSession | null>(null)
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null)
  const [pageDirection, setPageDirection] = useState<1 | -1>(1)
  const [timeSnapshot, setTimeSnapshot] = useState(() => Date.now())
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  })
  const lastSavedExamToastId = useRef<string | null>(toSavedMockExamSession(mockExamState)?.id ?? null)
  const highestMilestoneRef = useRef(0)
  const milestoneReadyRef = useRef(false)

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage))
  }, [setLanguageState])

  const normalizedLanguage = normalizeLanguage(language)
  const t = useMemo(() => createTranslator(normalizedLanguage), [normalizedLanguage])
  const i18nValue = useMemo(
    () => ({ language: normalizedLanguage, setLanguage, t }),
    [normalizedLanguage, setLanguage, t],
  )
  const pageKey = route.name === 'topic' || route.name === 'quiz'
    ? `${route.name}:${route.subsectionId}:${route.topicId}`
    : route.name
  const funEnabled = preferences.funAnimationsEnabled && !prefersReducedMotion

  const showToast = useCallback((input: string | Omit<ToastState, 'id'>, tone: 'success' | 'info' | 'warning' = 'success') => {
    if (typeof input === 'string') {
      setToast({ id: Date.now(), message: input, tone })
      return
    }
    setToast({ id: Date.now(), ...input })
  }, [])

  const playSound = useCallback((cue: AppSoundCue) => {
    void audioEngine.play(cue, preferences.soundEnabled)
  }, [audioEngine, preferences.soundEnabled])

  const triggerCelebration = useCallback((kind: CelebrationKind, title: string, label?: string) => {
    if (!funEnabled) return
    setCelebration({
      id: Date.now(),
      kind,
      title,
      label,
    })
  }, [funEnabled])

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as DeferredInstallPrompt)
    }

    const onAppInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const timer = window.setInterval(() => setTimeSnapshot(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!celebration) return
    const timer = window.setTimeout(() => setCelebration(null), 1100)
    return () => window.clearTimeout(timer)
  }, [celebration])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setPrefersReducedMotion(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const primeAudio = () => {
      void audioEngine.unlock()
    }
    window.addEventListener('pointerdown', primeAudio, { once: true, passive: true })
    window.addEventListener('keydown', primeAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', primeAudio)
      window.removeEventListener('keydown', primeAudio)
    }
  }, [audioEngine])

  useEffect(() => {
    forceScrollTop()
    const frame = window.requestAnimationFrame(() => {
      forceScrollTop()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pageKey])

  const acronyms = getAcronyms()
  const acronymMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!acronyms) return map
    for (const entry of acronyms.entries) {
      const key = entry.acronym.toUpperCase()
      if (!map.has(key)) map.set(key, entry.spelledOut)
    }
    return map
  }, [acronyms])

  const flatTopics = useMemo(() => {
    if (!course) return []
    const list: FlatTopicEntry[] = []
    for (const section of course.sections) {
      for (const sub of section.subsections) {
        for (const topic of sub.topics) {
          list.push({ section, sub, topic, text: topicText(topic) })
        }
      }
    }
    return list
  }, [course])

  const totalTopics = flatTopics.length
  const doneCount = Object.keys(doneTopics).length
  const completionPct = totalTopics ? Math.round((doneCount / totalTopics) * 100) : 0
  const completionMilestones = useMemo(() => [25, 50, 75, 100].filter((milestone) => completionPct >= milestone), [completionPct])
  const nextMilestone = useMemo(() => [25, 50, 75, 100].find((milestone) => completionPct < milestone) ?? null, [completionPct])
  const recentTopicStreak = useMemo(
    () => Object.values(doneTopics).filter((doneAt) => timeSnapshot - doneAt < 45 * 60 * 1000).length,
    [doneTopics, timeSnapshot],
  )
  const quizTopics = useMemo(() => flatTopics.filter(({ topic }) => Boolean(topic.quiz?.length)), [flatTopics])
  const recentDoneTopics = useMemo(() => {
    return flatTopics
      .filter(({ sub, topic }) => Boolean(doneTopics[topicKey(sub.id, topic.id)]))
      .sort((a, b) => (doneTopics[topicKey(b.sub.id, b.topic.id)] ?? 0) - (doneTopics[topicKey(a.sub.id, a.topic.id)] ?? 0))
      .slice(0, 3)
  }, [flatTopics, doneTopics])
  const nextTodoTopics = useMemo(() => {
    return flatTopics
      .filter(({ sub, topic }) => !doneTopics[topicKey(sub.id, topic.id)])
      .slice(0, 3)
  }, [flatTopics, doneTopics])

  const mockExamPool = useMemo(() => buildMockExamPool(quizTopics), [quizTopics])
  const mockExamQuestionMap = useMemo(() => new Map(mockExamPool.map((question) => [question.id, question])), [mockExamPool])
  const shownMockExamState = reviewMockExam ?? mockExamState
  const mockExamQuestions = useMemo(
    () => (shownMockExamState ? shownMockExamState.questionIds.map((id) => mockExamQuestionMap.get(id)).filter(Boolean) as MockExamQuestion[] : []),
    [mockExamQuestionMap, shownMockExamState],
  )

  const current = course && (route.name === 'topic' || route.name === 'quiz') ? findTopic(course, route.subsectionId, route.topicId) : null
  const currentQuizKey = current ? topicKey(current.sub.id, current.topic.id) : null

  useEffect(() => {
    const highestReachedMilestone = completionMilestones[completionMilestones.length - 1] ?? 0
    if (!milestoneReadyRef.current) {
      highestMilestoneRef.current = highestReachedMilestone
      milestoneReadyRef.current = true
      return
    }
    if (highestReachedMilestone <= highestMilestoneRef.current) return
    highestMilestoneRef.current = highestReachedMilestone
    const title = normalizedLanguage === 'en' ? 'Milestone reached' : 'Palier atteint'
    const message = normalizedLanguage === 'en'
      ? `You reached ${highestReachedMilestone}% progress.`
      : `Tu as atteint ${highestReachedMilestone}% de progression.`
    playSound('milestone')
    window.setTimeout(() => {
      showToast({ title, message, tone: 'success', icon: '★', badge: `${highestReachedMilestone}%` })
      triggerCelebration('milestone', title, `${highestReachedMilestone}%`)
    }, 0)
  }, [completionMilestones, normalizedLanguage, playSound, showToast, triggerCelebration])

  const navigateTo = useCallback((nextRoute: Route, direction?: 1 | -1) => {
    setPageDirection(direction ?? compareRouteDirection(route, nextRoute))
    forceScrollTop()
    playSound('tap')
    setHashRoute(nextRoute)
  }, [playSound, route])

  const openHome = useCallback(() => navigateTo({ name: 'home' }, -1), [navigateTo])
  const openQuizzes = useCallback(() => navigateTo({ name: 'quizzes' }), [navigateTo])
  const openAcronyms = useCallback(() => navigateTo({ name: 'acronyms' }), [navigateTo])
  const openTopic = useCallback((subsectionId: string, topicId: string) => {
    navigateTo({ name: 'topic', subsectionId, topicId }, 1)
  }, [navigateTo])
  const openQuiz = useCallback((subsectionId: string, topicId: string) => {
    navigateTo({ name: 'quiz', subsectionId, topicId }, 1)
  }, [navigateTo])

  const toggleSound = useCallback(() => {
    const nextEnabled = !preferences.soundEnabled
    setPreferences((current) => ({ ...current, soundEnabled: !current.soundEnabled }))
    showToast({
      title: normalizedLanguage === 'en' ? 'Sound' : 'Son',
      message: nextEnabled
        ? (normalizedLanguage === 'en' ? 'Light sounds enabled.' : 'Sons legers actives.')
        : (normalizedLanguage === 'en' ? 'Sounds muted.' : 'Sons coupes.'),
      tone: 'info',
      icon: nextEnabled ? '♪' : '·',
    })
    if (nextEnabled) {
      void audioEngine.unlock()
      void audioEngine.play('tap', true)
    }
  }, [audioEngine, normalizedLanguage, preferences.soundEnabled, setPreferences, showToast])

  const toggleFunAnimations = useCallback(() => {
    const nextEnabled = !preferences.funAnimationsEnabled
    setPreferences((current) => ({ ...current, funAnimationsEnabled: !current.funAnimationsEnabled }))
    showToast({
      title: normalizedLanguage === 'en' ? 'Fun mode' : 'Mode fun',
      message: nextEnabled
        ? (normalizedLanguage === 'en' ? 'Celebrations enabled.' : 'Celebrations activees.')
        : (normalizedLanguage === 'en' ? 'Celebrations reduced.' : 'Celebrations reduites.'),
      tone: 'info',
      icon: nextEnabled ? '★' : '·',
    })
  }, [normalizedLanguage, preferences.funAnimationsEnabled, setPreferences, showToast])

  const saveCurrentQuizState = (next: QuizStoredState) => {
    if (!currentQuizKey) return
    setQuizStates((prev) => {
      const prevState = prev[currentQuizKey]
      if (areQuizStatesEqual(prevState, next)) return prev
      return { ...prev, [currentQuizKey]: next }
    })
  }

  const completeCurrentQuiz = (score: number, total: number, next: QuizStoredState) => {
    if (!currentQuizKey) return
    const previousBest = quizScores[currentQuizKey]?.best ?? 0

    setQuizStates((prev) => {
      const prevState = prev[currentQuizKey]
      if (areQuizStatesEqual(prevState, next)) return prev
      return { ...prev, [currentQuizKey]: next }
    })

    const nextAt = next.lastCompletedAt ?? Date.now()
    setQuizScores((prev) => {
      const prevScore = prev[currentQuizKey]
      const best = Math.max(prevScore?.best ?? 0, score)
      if (prevScore?.best === best && prevScore?.total === total && prevScore?.at === nextAt) return prev
      return { ...prev, [currentQuizKey]: { best, total, at: nextAt } }
    })

    if (score > previousBest) {
      showToast({
        title: normalizedLanguage === 'en' ? 'New personal best' : 'Nouveau record perso',
        message: normalizedLanguage === 'en'
          ? `You improved to ${score}/${total}.`
          : `Tu progresses a ${score}/${total}.`,
        tone: 'success',
        icon: '↑',
        badge: 'PB',
      })
      triggerCelebration('achievement', normalizedLanguage === 'en' ? 'Personal best' : 'Record perso', `${score}/${total}`)
      playSound(score === total ? 'celebration' : 'complete')
      return
    }

    playSound(score === total ? 'celebration' : 'complete')
  }

  const startMockExam = useCallback(() => {
    setReviewMockExam(null)
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const selectedQuestions = buildMockExamQuestions(mockExamPool, MOCK_EXAM_QUESTION_COUNT, seed)
    if (!selectedQuestions.length) return

    const startedAt = Date.now()
    const nextState: MockExamState = {
      seed,
      startedAt,
      endsAt: startedAt + MOCK_EXAM_DURATION_MS,
      idx: 0,
      questionIds: selectedQuestions.map((question) => question.id),
      answers: Array.from({ length: selectedQuestions.length }, () => null),
    }

    setMockExamState(nextState)
    navigateTo({ name: 'exam' }, 1)
    showToast(normalizedLanguage === 'en' ? 'Mock exam started.' : 'Examen blanc demarre.')
  }, [mockExamPool, navigateTo, normalizedLanguage, setMockExamState, showToast])

  const updateMockExamState = useCallback((updater: (prev: MockExamState) => MockExamState) => {
    setMockExamState((prev) => {
      if (!prev) return prev
      const next = updater(prev)
      if (areMockExamStatesEqual(prev, next)) return prev
      return next
    })
  }, [setMockExamState])

  const answerMockExamQuestion = useCallback((questionIdx: number, answer: string) => {
    updateMockExamState((prev) => {
      if (prev.submittedAt || prev.answers[questionIdx] === answer) return prev
      const answers = [...prev.answers]
      answers[questionIdx] = answer
      return { ...prev, answers }
    })
  }, [updateMockExamState])

  const navigateMockExam = useCallback((questionIdx: number) => {
    updateMockExamState((prev) => ({ ...prev, idx: clamp(questionIdx, 0, prev.questionIds.length - 1) }))
  }, [updateMockExamState])

  const submitMockExam = useCallback(() => {
    updateMockExamState((prev) => {
      if (prev.submittedAt) return prev
      const score = computeMockExamScore(prev.questionIds, prev.answers, mockExamQuestionMap)
      return {
        ...prev,
        submittedAt: Date.now(),
        score,
      }
    })
  }, [mockExamQuestionMap, updateMockExamState])

  const clearMockExam = useCallback(() => {
    setMockExamState(null)
  }, [setMockExamState])

  const openSavedMockExam = useCallback((saved: SavedMockExamSession) => {
    setReviewMockExam({ ...saved, idx: 0 })
    navigateTo({ name: 'exam' }, 1)
    showToast(normalizedLanguage === 'en' ? 'Saved session opened.' : 'Session sauvegardee ouverte.', 'info')
  }, [navigateTo, normalizedLanguage, showToast])

  const closeSavedMockExam = useCallback(() => {
    setReviewMockExam(null)
    navigateTo({ name: 'quizzes' }, -1)
  }, [navigateTo])

  const installApp = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null)
      showToast(normalizedLanguage === 'en' ? 'App installed.' : 'Application installee.')
    }
  }, [installPrompt, normalizedLanguage, showToast])

  const answerShownMockExamQuestion = useCallback((questionIdx: number, answer: string) => {
    if (reviewMockExam) return
    answerMockExamQuestion(questionIdx, answer)
  }, [answerMockExamQuestion, reviewMockExam])

  const navigateShownMockExam = useCallback((questionIdx: number) => {
    if (reviewMockExam) {
      setReviewMockExam((prev) => (prev ? { ...prev, idx: clamp(questionIdx, 0, prev.questionIds.length - 1) } : prev))
      return
    }
    navigateMockExam(questionIdx)
  }, [navigateMockExam, reviewMockExam])

  const submitShownMockExam = useCallback(() => {
    if (reviewMockExam) return
    submitMockExam()
  }, [reviewMockExam, submitMockExam])

  useEffect(() => {
    const saved = toSavedMockExamSession(mockExamState)
    if (!saved) return
    setMockExamHistory((prev) => [saved, ...prev.filter((item) => item.id !== saved.id)])
    if (lastSavedExamToastId.current !== saved.id) {
      lastSavedExamToastId.current = saved.id
      playSound(saved.score / saved.questionIds.length >= 0.8 ? 'celebration' : 'complete')
      window.setTimeout(() => {
        triggerCelebration(
          saved.score / saved.questionIds.length >= 0.8 ? 'complete' : 'achievement',
          normalizedLanguage === 'en' ? 'Exam submitted' : 'Examen valide',
          `${saved.score}/${saved.questionIds.length}`,
        )
        showToast(
          {
            title: normalizedLanguage === 'en' ? 'Mock exam finished' : 'Examen blanc termine',
            message: normalizedLanguage === 'en'
              ? `Score ${saved.score}/${saved.questionIds.length}.`
              : `Score ${saved.score}/${saved.questionIds.length}.`,
            tone: 'success',
            icon: '★',
            badge: `${Math.round((saved.score / saved.questionIds.length) * 100)}%`,
          }
        )
      }, 0)
    }
  }, [mockExamState, normalizedLanguage, playSound, setMockExamHistory, showToast, triggerCelebration])

  const page = !course ? (
    err ? (
      <div className="panel">
        <div className="muted">{t('loading')}</div>
        <div className="error">{t('error')}: {err}</div>
      </div>
    ) : (
      <LoadingSkeletonPage />
    )
  ) : route.name === 'acronyms' ? (
    <AcronymsPage
      entries={acronyms?.entries ?? []}
      onCopy={(label) => {
        playSound('tap')
        showToast(
          normalizedLanguage === 'en'
            ? `${label} copied to clipboard.`
            : `${label} copie dans le presse-papiers.`
        )
      }}
    />
  ) : route.name === 'quizzes' ? (
    <QuizHubPage
      quizzes={quizTopics}
      quizScores={quizScores}
      quizStates={quizStates}
      mockExamState={mockExamState}
      mockExamHistory={mockExamHistory}
      mockExamQuestionCount={Math.min(MOCK_EXAM_QUESTION_COUNT, mockExamPool.length)}
      onStartMockExam={startMockExam}
      onResumeMockExam={() => {
        setReviewMockExam(null)
        navigateTo({ name: 'exam' }, 1)
        showToast(normalizedLanguage === 'en' ? 'Mock exam resumed.' : 'Examen blanc repris.', 'info')
      }}
      onOpenSavedMockExam={openSavedMockExam}
      onOpenQuiz={openQuiz}
      onOpenTopic={openTopic}
    />
  ) : route.name === 'exam' ? (
    <MockExamPage
      state={shownMockExamState}
      questions={mockExamQuestions}
      isSavedReview={Boolean(reviewMockExam)}
      funEnabled={funEnabled}
      onStartNew={startMockExam}
      onBackToHub={openQuizzes}
      onChooseAnswer={answerShownMockExamQuestion}
      onGoToQuestion={navigateShownMockExam}
      onSubmit={submitShownMockExam}
      onClear={clearMockExam}
      onCloseSavedReview={closeSavedMockExam}
      onPlaySound={playSound}
      onCelebrate={triggerCelebration}
    />
  ) : route.name === 'quiz' && current?.topic.quiz?.length ? (
    <Quiz
      key={currentQuizKey ?? `${current.sub.id}::${current.topic.id}`}
      quiz={current.topic.quiz}
      bestScore={currentQuizKey ? quizScores[currentQuizKey] : undefined}
      storedState={currentQuizKey ? quizStates[currentQuizKey] : undefined}
      onSaveState={saveCurrentQuizState}
      onComplete={completeCurrentQuiz}
      onNotify={showToast}
      onPlaySound={playSound}
      onCelebrate={triggerCelebration}
      funEnabled={funEnabled}
      onBackToTopic={() => openTopic(current.sub.id, current.topic.id)}
      onViewAllQuizzes={openQuizzes}
      sectionId={current.section.id}
      subsectionId={current.sub.id}
      topicId={current.topic.id}
    />
  ) : route.name === 'topic' && current ? (
    <TopicPage
      section={current.section}
      subsection={current.sub}
      topic={current.topic}
      doneAt={doneTopics[topicKey(current.sub.id, current.topic.id)]}
      bestQuiz={quizScores[topicKey(current.sub.id, current.topic.id)]}
      acronymMap={acronymMap}
      onBack={openHome}
      onToggleDone={() => {
        const key = topicKey(current.sub.id, current.topic.id)
        const markingDone = !doneTopics[key]
        const updatedDoneCount = markingDone ? doneCount + 1 : Math.max(doneCount - 1, 0)
        const updatedRecentStreak = markingDone ? recentTopicStreak + 1 : Math.max(recentTopicStreak - 1, 0)
        setDoneTopics((prev) => {
          const next = { ...prev }
          if (next[key]) delete next[key]
          else next[key] = Date.now()
          return next
        })
        if (markingDone) {
          playSound(updatedRecentStreak >= 3 ? 'milestone' : 'success')
          if (updatedRecentStreak >= 3) {
            triggerCelebration(
              'combo',
              normalizedLanguage === 'en' ? 'Study streak' : 'Serie de revision',
              normalizedLanguage === 'en' ? `${updatedRecentStreak} topics in a row` : `${updatedRecentStreak} sujets d'affilee`,
            )
          } else {
            triggerCelebration(
              'success',
              normalizedLanguage === 'en' ? 'Topic completed' : 'Sujet termine',
              normalizedLanguage === 'en' ? `${updatedDoneCount}/${totalTopics} topics done` : `${updatedDoneCount}/${totalTopics} sujets valides`,
            )
          }
        } else {
          playSound('tap')
        }
        showToast(
          markingDone
            ? {
              title: normalizedLanguage === 'en' ? 'Topic completed' : 'Sujet termine',
              message: normalizedLanguage === 'en'
                ? 'Topic marked as done.'
                : 'Sujet marque comme termine.',
              tone: 'success',
              icon: '✓',
              badge: updatedRecentStreak >= 3 ? `x${updatedRecentStreak}` : undefined,
            }
            : {
              title: normalizedLanguage === 'en' ? 'Progress updated' : 'Progression mise a jour',
              message: normalizedLanguage === 'en'
                ? 'Topic removed from done list.'
                : 'Sujet retire des elements termines.',
              tone: 'info',
              icon: '·',
            }
        )
      }}
      onStartQuiz={() => openQuiz(current.sub.id, current.topic.id)}
    />
  ) : (
    <HomePage
      course={course}
      query={query}
      onQuery={setQuery}
      completionPct={completionPct}
      completionMilestones={completionMilestones}
      nextMilestone={nextMilestone}
      recentTopicStreak={recentTopicStreak}
      funEnabled={funEnabled}
      doneCount={doneCount}
      totalTopics={totalTopics}
      recentDoneTopics={recentDoneTopics}
      nextTodoTopics={nextTodoTopics}
      doneTopics={doneTopics}
      quizScores={quizScores}
      onOpenTopic={openTopic}
    />
  )

  return (
    <AppI18nContext.Provider value={i18nValue}>
      <AppChrome
        route={route}
        language={normalizedLanguage}
        installPrompt={installPrompt}
        isInstalled={isInstalled}
        preferences={preferences}
        t={t}
        onHome={openHome}
        onQuizzes={openQuizzes}
        onAcronyms={openAcronyms}
        onInstall={() => void installApp()}
        onLanguageChange={setLanguage}
        onToggleSound={toggleSound}
        onToggleFunAnimations={toggleFunAnimations}
      >
        <LayoutGroup id="page-layout">
          <AnimatePresence mode="wait" custom={pageDirection}>
            <motion.div
              key={pageKey}
              className="pageTransition"
              custom={pageDirection}
              initial={{ opacity: 0, x: pageDirection > 0 ? 48 : -48, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: pageDirection > 0 ? -36 : 36, scale: 0.99 }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
            >
              {page}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>
      </AppChrome>
      <CelebrationBurst event={celebration} enabled={funEnabled} />
      <ToastViewport toast={toast} />
    </AppI18nContext.Provider>
  )
}

export default App
