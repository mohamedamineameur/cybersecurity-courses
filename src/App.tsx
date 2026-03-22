import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
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
  DeferredInstallPrompt,
  FlatTopicEntry,
  MockExamQuestion,
  MockExamState,
  QuizStoredState,
  SavedMockExamSession,
} from './app/types'
import { AppChrome } from './components/AppChrome'
import { Quiz } from './components/Quiz'
import { AcronymsPage } from './pages/AcronymsPage'
import { HomePage } from './pages/HomePage'
import { MockExamPage } from './pages/MockExamPage'
import { QuizHubPage } from './pages/QuizHubPage'
import { TopicPage } from './pages/TopicPage'

function App() {
  const route = useHashRoute()
  const { data: course, err } = useCourseData()
  const [query, setQuery] = useState('')
  const [language, setLanguageState] = useLocalStorageState<AppLanguage>('appLanguageV1', 'fr')
  const [doneTopics, setDoneTopics] = useLocalStorageState<Record<string, number>>('doneTopicsV1', {})
  const [quizScores, setQuizScores] = useLocalStorageState<Record<string, { best: number; total: number; at: number }>>('quizScoresV1', {})
  const [quizStates, setQuizStates] = useLocalStorageState<Record<string, QuizStoredState>>('quizStatesV1', {})
  const [mockExamState, setMockExamState] = useLocalStorageState<MockExamState | null>('mockExamStateV1', null)
  const [mockExamHistory, setMockExamHistory] = useLocalStorageState<SavedMockExamSession[]>('mockExamHistoryV1', [])
  const [reviewMockExam, setReviewMockExam] = useState<SavedMockExamSession | null>(null)
  const [installPrompt, setInstallPrompt] = useState<DeferredInstallPrompt | null>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    const nav = navigator as Navigator & { standalone?: boolean }
    return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  })

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(normalizeLanguage(nextLanguage))
  }, [setLanguageState])

  const normalizedLanguage = normalizeLanguage(language)
  const t = useMemo(() => createTranslator(normalizedLanguage), [normalizedLanguage])
  const i18nValue = useMemo(
    () => ({ language: normalizedLanguage, setLanguage, t }),
    [normalizedLanguage, setLanguage, t],
  )

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

  const openHome = useCallback(() => setHashRoute({ name: 'home' }), [])
  const openQuizzes = useCallback(() => setHashRoute({ name: 'quizzes' }), [])
  const openAcronyms = useCallback(() => setHashRoute({ name: 'acronyms' }), [])
  const openTopic = useCallback((subsectionId: string, topicId: string) => {
    setHashRoute({ name: 'topic', subsectionId, topicId })
  }, [])
  const openQuiz = useCallback((subsectionId: string, topicId: string) => {
    setHashRoute({ name: 'quiz', subsectionId, topicId })
  }, [])

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
    setHashRoute({ name: 'exam' })
  }, [mockExamPool, setMockExamState])

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
    setHashRoute({ name: 'exam' })
  }, [])

  const closeSavedMockExam = useCallback(() => {
    setReviewMockExam(null)
    setHashRoute({ name: 'quizzes' })
  }, [])

  const installApp = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstallPrompt(null)
  }, [installPrompt])

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
  }, [mockExamState, setMockExamHistory])

  const page = !course ? (
    <div className="panel">
      <div className="muted">{t('loading')}</div>
      {err ? <div className="error">{t('error')}: {err}</div> : null}
    </div>
  ) : route.name === 'acronyms' ? (
    <AcronymsPage entries={acronyms?.entries ?? []} />
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
        setHashRoute({ name: 'exam' })
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
      onStartNew={startMockExam}
      onBackToHub={openQuizzes}
      onChooseAnswer={answerShownMockExamQuestion}
      onGoToQuestion={navigateShownMockExam}
      onSubmit={submitShownMockExam}
      onClear={clearMockExam}
      onCloseSavedReview={closeSavedMockExam}
    />
  ) : route.name === 'quiz' && current?.topic.quiz?.length ? (
    <Quiz
      key={currentQuizKey ?? `${current.sub.id}::${current.topic.id}`}
      quiz={current.topic.quiz}
      storedState={currentQuizKey ? quizStates[currentQuizKey] : undefined}
      onSaveState={saveCurrentQuizState}
      onComplete={completeCurrentQuiz}
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
        setDoneTopics((prev) => {
          const next = { ...prev }
          if (next[key]) delete next[key]
          else next[key] = Date.now()
          return next
        })
      }}
      onStartQuiz={() => openQuiz(current.sub.id, current.topic.id)}
    />
  ) : (
    <HomePage
      course={course}
      query={query}
      onQuery={setQuery}
      completionPct={completionPct}
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
        t={t}
        onHome={openHome}
        onQuizzes={openQuizzes}
        onAcronyms={openAcronyms}
        onInstall={() => void installApp()}
        onLanguageChange={setLanguage}
      >
        {page}
      </AppChrome>
    </AppI18nContext.Provider>
  )
}

export default App
