import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useTranslate } from '../app/i18n'
import { clamp, formatDuration } from '../app/helpers'
import type { AppSoundCue, CelebrationKind, MockExamQuestion, MockExamState } from '../app/types'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { EmptyState } from '../components/EmptyState'
import { StreakBadge } from '../components/StreakBadge'

type MockExamPageProps = {
  state: MockExamState | null
  questions: MockExamQuestion[]
  isSavedReview: boolean
  funEnabled?: boolean
  onStartNew: () => void
  onBackToHub: () => void
  onChooseAnswer: (questionIdx: number, answer: string) => void
  onGoToQuestion: (questionIdx: number) => void
  onSubmit: () => void
  onClear: () => void
  onCloseSavedReview: () => void
  onPlaySound?: (cue: AppSoundCue) => void
  onCelebrate?: (kind: CelebrationKind, title: string, label?: string) => void
}

function ExamScoreRing({ score, total }: { score: number; total: number }) {
  const progress = total ? score / total : 0
  const radius = 48
  const circumference = 2 * Math.PI * radius

  return (
    <div className="scoreRingWrap">
      <svg className="scoreRing" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="scoreRingTrack" />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          className="scoreRingValue"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="scoreRingCenter">
        <AnimatedCounter value={score} className="scoreRingValueText" />
        <span className="muted small">/ {total}</span>
      </div>
    </div>
  )
}

export function MockExamPage({
  state,
  questions,
  isSavedReview,
  funEnabled = true,
  onStartNew,
  onBackToHub,
  onChooseAnswer,
  onGoToQuestion,
  onSubmit,
  onClear,
  onCloseSavedReview,
  onPlaySound,
  onCelebrate,
}: MockExamPageProps) {
  const { t } = useTranslate()
  const [now, setNow] = useState(state?.startedAt ?? 0)
  const [questionDirection, setQuestionDirection] = useState<1 | -1>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitTimerRef = useRef<number | null>(null)
  const lastSubmissionRef = useRef<number | null>(null)

  useEffect(() => {
    if (!state || state.submittedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (!state || state.submittedAt) return
    if (Date.now() >= state.endsAt) onSubmit()
  }, [now, onSubmit, state])

  useEffect(() => () => {
    if (submitTimerRef.current) window.clearTimeout(submitTimerRef.current)
  }, [])

  useEffect(() => {
    if (!state?.submittedAt || state.submittedAt === lastSubmissionRef.current || isSavedReview) return
    lastSubmissionRef.current = state.submittedAt
    const totalQuestions = state.questionIds.length
    const ratio = totalQuestions ? (state.score ?? 0) / totalQuestions : 0
    onPlaySound?.(ratio >= 0.8 ? 'celebration' : 'complete')
    if (funEnabled) {
      onCelebrate?.(ratio >= 0.8 ? 'complete' : 'achievement', ratio >= 0.8 ? 'Excellent' : 'Termine', `${state.score ?? 0}/${totalQuestions}`)
    }
  }, [funEnabled, isSavedReview, onCelebrate, onPlaySound, state])

  if (!state || !questions.length) {
    return (
      <div className="stack">
        <section className="panel">
          <EmptyState icon="?" title={t('mockExam.emptyTitle')} body={t('mockExam.emptyBody')} />
          <div className="actionsRow">
            <button className="btnPrimary" onClick={onStartNew}>
              {t('mockExam.startExam')}
            </button>
            <button className="btnSecondary" onClick={onBackToHub}>
              {t('mockExam.backToQuizHub')}
            </button>
          </div>
        </section>
      </div>
    )
  }

  const total = questions.length
  const idx = clamp(state.idx, 0, total - 1)
  const current = questions[idx]
  const picked = state.answers[idx] ?? null
  const answeredCount = state.answers.filter((answer) => answer !== null).length
  const remainingMs = Math.max(0, state.endsAt - now)
  const isSubmitted = Boolean(state.submittedAt)
  const isCorrect = picked !== null && picked === current.quiz.correctAnswer
  const timerTone = isSubmitted
    ? 'done'
    : remainingMs <= 2 * 60 * 1000
      ? 'critical'
      : remainingMs <= 10 * 60 * 1000
        ? 'danger'
        : remainingMs <= 20 * 60 * 1000
          ? 'warn'
          : 'safe'

  const submitWithTransition = () => {
    if (isSubmitted || isSavedReview || isSubmitting) return
    setIsSubmitting(true)
    onPlaySound?.('complete')
    submitTimerRef.current = window.setTimeout(() => {
      onSubmit()
      setIsSubmitting(false)
    }, 420)
  }

  const goToQuestion = (nextQuestionIdx: number) => {
    setQuestionDirection(nextQuestionIdx > idx ? 1 : -1)
    onGoToQuestion(nextQuestionIdx)
  }

  return (
    <div className="stack">
      <motion.section
        className="heroCard small"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="heroGlow examHeroGlow" aria-hidden="true" />
        <div className="heroInner">
          <div className="heroKicker">{t('mockExam.kicker')}</div>
          <h1 className="heroTitle">{t('mockExam.title')}</h1>
          <p className="heroSubtitle">{t('mockExam.subtitle')}</p>
          <div className="heroStats">
            <div className="stat">
              <div className="statTop">
                <div className="pill">{t('mockExam.remaining')}</div>
                <div className="statPct">{formatDuration(isSubmitted ? 0 : remainingMs)}</div>
              </div>
              <div className="progress big" aria-label={t('quiz.progress')}>
                <motion.div
                  className="bar"
                  animate={{ width: `${Math.round((answeredCount / total) * 100)}%` }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                />
              </div>
              <div className="muted">{t('mockExam.answeredCount', { answered: answeredCount, total })}</div>
              {funEnabled ? (
                <div className="heroRewardRow">
                  <StreakBadge value={answeredCount} label="rep" tone={answeredCount >= Math.ceil(total * 0.6) ? 'hot' : 'default'} />
                </div>
              ) : null}
            </div>
            <div className="stat side">
              <div className="pill">{t('mockExam.format')}</div>
              <div className="statPct">{total}</div>
              <div className="muted">{t('mockExam.multipleChoiceOnly')}</div>
            </div>
          </div>
        </div>
      </motion.section>

      {isSavedReview ? (
        <motion.section className="panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="topicTop">
            <div>
              <h2>{t('mockExam.reviewBanner')}</h2>
              <div className="muted">
                {state.submittedAt ? `${t('mockExam.finishedAt')}: ${new Date(state.submittedAt).toLocaleString()}` : ''}
              </div>
            </div>
            <button className="btnSecondary" onClick={onCloseSavedReview}>
              {t('mockExam.closeReview')}
            </button>
          </div>
        </motion.section>
      ) : null}

      <AnimatePresence>
        {isSubmitted ? (
          <motion.section
            className="panel examResultPanel"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="quizScoreSummary">
              <div>
                <h2>{t('mockExam.resultTitle')}</h2>
                <p className="muted">{t('mockExam.resultScore', { score: state.score ?? 0, total })}</p>
                <div className="topicBottom">
                  <span className="badge ok">{t('mockExam.finishedAt')}: {state.submittedAt ? new Date(state.submittedAt).toLocaleString() : '-'}</span>
                  <span className="badge">{t('mockExam.answeredCount', { answered: answeredCount, total })}</span>
                </div>
              </div>
              <ExamScoreRing score={state.score ?? 0} total={total} />
            </div>
            <div className="actionsRow">
              <button className="btnPrimary" onClick={onStartNew}>
                {t('mockExam.newExam')}
              </button>
              <button className="btnSecondary" onClick={onBackToHub}>
                {t('mockExam.backToQuizHub')}
              </button>
              {isSavedReview ? (
                <button className="btnSecondary" onClick={onCloseSavedReview}>
                  {t('mockExam.closeReview')}
                </button>
              ) : (
                <button className="btnSecondary" onClick={onClear}>
                  {t('mockExam.clearExam')}
                </button>
              )}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <section className={['panel', isSubmitting ? 'examSubmitting' : ''].join(' ')}>
        <div className="topicTop">
          <div>
            <div className="pill">{t('quiz.question', { current: idx + 1, total })}</div>
            <div className="muted small">
              {current.sectionId} • {current.sectionTitle} • {current.subsectionId} • {current.subsectionTitle} • {current.topicTitle}
            </div>
          </div>
          <motion.div
            className={['examTimer', timerTone].join(' ')}
            animate={timerTone === 'critical' ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={timerTone === 'critical' ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
          >
            {formatDuration(isSubmitted ? 0 : remainingMs)}
          </motion.div>
        </div>

        <AnimatePresence mode="wait" custom={questionDirection}>
          <motion.div
            key={`${idx}-${isSubmitted ? 'review' : 'play'}`}
            className="quizStage"
            custom={questionDirection}
            initial={{ opacity: 0, x: questionDirection > 0 ? 42 : -42 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: questionDirection > 0 ? -32 : 32 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <h2 className="quizQ">{current.quiz.question}</h2>
            <div className="choices">
              {current.quiz.choices.map((choice, choiceIndex) => {
                const selected = picked === choice
                const correct = isSubmitted && choice === current.quiz.correctAnswer
                return (
                  <motion.button
                    key={choice}
                    className={[
                      'choice',
                      selected ? 'selected' : '',
                      correct ? 'correct' : '',
                      isSubmitted && selected && !correct ? 'wrong' : '',
                    ].join(' ')}
                    disabled={isSubmitted}
                    onClick={() => {
                      onPlaySound?.('tap')
                      onChooseAnswer(idx, choice)
                    }}
                    whileTap={{ scale: 0.985 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: choiceIndex * 0.04 }}
                  >
                    {choice}
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence>
              {isSubmitted ? (
                <motion.div
                  className={['feedback', 'feedbackPremium', isCorrect ? 'ok' : 'no'].join(' ')}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="feedbackTitleRow">
                    <motion.span
                      className="feedbackIcon"
                      initial={{ scale: 0.65, rotate: isCorrect ? -10 : 10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    >
                      {isCorrect ? '✓' : '!'}
                    </motion.span>
                    <div className="feedbackTitle">{isCorrect ? t('quiz.correct') : t('quiz.wrong')}</div>
                  </div>
                  <div className="muted">{t('quiz.correctWas', { answer: current.quiz.correctAnswer })}</div>
                  {current.quiz.explanation ? <div className="muted">{current.quiz.explanation}</div> : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        <div className="quizActions">
          <button className="btnSecondary" onClick={() => goToQuestion(idx - 1)} disabled={idx === 0}>
            {t('quiz.prev')}
          </button>
          {isSubmitted ? (
            <button className="btnPrimary" onClick={() => goToQuestion(idx + 1)} disabled={idx === total - 1}>
              {t('quiz.next')}
            </button>
          ) : (
            <button className="btnPrimary" onClick={() => (idx === total - 1 ? submitWithTransition() : goToQuestion(idx + 1))}>
              {isSubmitting ? t('loading') : idx === total - 1 ? t('mockExam.submitExam') : t('quiz.next')}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="topicTop">
          <h2>{t('mockExam.navigator')}</h2>
          {!isSubmitted ? (
            <button className="btnSecondary" onClick={submitWithTransition} disabled={isSubmitting}>
              {isSubmitting ? t('loading') : t('mockExam.submitExam')}
            </button>
          ) : null}
        </div>
        <div className="examGrid">
          {questions.map((question, questionIdx) => {
            const answered = state.answers[questionIdx] !== null
            const selected = questionIdx === idx
            const correct = isSubmitted && state.answers[questionIdx] === question.quiz.correctAnswer
            const wrong = isSubmitted && answered && !correct
            return (
              <motion.button
                key={question.id}
                className={[
                  'examIndexBtn',
                  selected ? 'active' : '',
                  answered ? 'answered' : '',
                  correct ? 'correct' : '',
                  wrong ? 'wrong' : '',
                ].join(' ')}
                onClick={() => goToQuestion(questionIdx)}
                whileTap={{ scale: 0.96 }}
                animate={answered && !isSubmitted ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={{ duration: 0.28 }}
              >
                <span className="examIndexFill" aria-hidden="true" />
                <span className="examIndexLabel">{questionIdx + 1}</span>
              </motion.button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
