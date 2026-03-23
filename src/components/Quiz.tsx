import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { courseKeys } from '../i18n/course-keys'
import { useTranslate } from '../app/i18n'
import {
  areQuizStatesEqual,
  clamp,
  computeQuizScore,
  normalizeQuizAnswers,
  tr,
} from '../app/helpers'
import type { CelebrationKind, CourseQuiz, QuizStoredState, AppSoundCue } from '../app/types'
import { AnimatedCounter } from './AnimatedCounter'
import { StreakBadge } from './StreakBadge'

type QuizProps = {
  quiz: CourseQuiz[]
  bestScore?: { best: number; total: number; at: number }
  storedState?: QuizStoredState
  onSaveState: (next: QuizStoredState) => void
  onComplete: (score: number, total: number, next: QuizStoredState) => void
  onNotify?: (message: string, tone?: 'success' | 'info') => void
  onPlaySound?: (cue: AppSoundCue) => void
  onCelebrate?: (kind: CelebrationKind, title: string, label?: string) => void
  funEnabled?: boolean
  onBackToTopic: () => void
  onViewAllQuizzes: () => void
  sectionId: string
  subsectionId: string
  topicId: string
}

function ScoreRing({ score, total }: { score: number; total: number }) {
  const progress = total ? score / total : 0
  const radius = 50
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

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
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.05, ease: 'easeOut' }}
        />
      </svg>
      <div className="scoreRingCenter">
        <AnimatedCounter value={score} className="scoreRingValueText" />
        <span className="muted small">/ {total}</span>
      </div>
    </div>
  )
}

export function Quiz({
  quiz,
  bestScore,
  storedState,
  onSaveState,
  onComplete,
  onNotify,
  onPlaySound,
  onCelebrate,
  funEnabled = true,
  onBackToTopic,
  onViewAllQuizzes,
  sectionId,
  subsectionId,
  topicId,
}: QuizProps) {
  const { t } = useTranslate()
  const initialState = useMemo(() => {
    const total = quiz.length
    const hasDraft = Boolean(storedState?.draftAnswers?.some((answer) => answer !== null))
    if (hasDraft) {
      return {
        answers: normalizeQuizAnswers(storedState?.draftAnswers, total),
        idx: clamp(storedState?.draftIdx ?? 0, 0, Math.max(total - 1, 0)),
        completedScore: null as number | null,
        completedAt: null as number | null,
      }
    }

    if (storedState?.lastCompletedAnswers?.length) {
      const reviewAnswers = normalizeQuizAnswers(storedState.lastCompletedAnswers, total)
      return {
        answers: reviewAnswers,
        idx: 0,
        completedScore: storedState.lastCompletedScore ?? computeQuizScore(quiz, reviewAnswers),
        completedAt: storedState.lastCompletedAt ?? null,
      }
    }

    return {
      answers: normalizeQuizAnswers([], total),
      idx: 0,
      completedScore: null as number | null,
      completedAt: null as number | null,
    }
  }, [quiz, storedState])

  const [idx, setIdx] = useState(initialState.idx)
  const [answers, setAnswers] = useState<Array<string | null>>(initialState.answers)
  const [completedScore, setCompletedScore] = useState<number | null>(initialState.completedScore)
  const [completedAt, setCompletedAt] = useState<number | null>(initialState.completedAt)
  const [questionDirection, setQuestionDirection] = useState<1 | -1>(1)
  const [latestChoice, setLatestChoice] = useState<string | null>(null)
  const [correctStreak, setCorrectStreak] = useState(0)

  const currentQuestion = quiz[idx]
  const picked = answers[idx] ?? null
  const isReviewMode = completedScore !== null
  const answeredCount = answers.filter((answer) => answer !== null).length
  const isCorrect = picked !== null && picked === currentQuestion.correctAnswer
  const isWrong = picked !== null && picked !== currentQuestion.correctAnswer
  const questionLabel = tr(t, courseKeys.quizQuestion(sectionId, subsectionId, topicId, idx), currentQuestion.question)
  const correctAnswerLabel = tr(t, courseKeys.quizCorrectAnswer(sectionId, subsectionId, topicId, idx), currentQuestion.correctAnswer)
  const explanationLabel = currentQuestion.explanation
    ? tr(t, courseKeys.quizExplanation(sectionId, subsectionId, topicId, idx), currentQuestion.explanation)
    : (isCorrect ? t('quiz.wellDone') : t('quiz.correctWas', { answer: correctAnswerLabel }))

  useEffect(() => {
    if (isReviewMode) return
    const nextState = {
      draftAnswers: normalizeQuizAnswers(answers, quiz.length),
      draftIdx: idx,
      total: quiz.length,
      lastCompletedAnswers: storedState?.lastCompletedAnswers,
      lastCompletedScore: storedState?.lastCompletedScore,
      lastCompletedAt: storedState?.lastCompletedAt,
    }
    if (areQuizStatesEqual(nextState, storedState)) return
    onSaveState(nextState)
  }, [answers, idx, isReviewMode, onSaveState, quiz.length, storedState])

  const handleRestart = () => {
    const next: QuizStoredState = {
      draftAnswers: normalizeQuizAnswers([], quiz.length),
      draftIdx: 0,
      total: quiz.length,
      lastCompletedAnswers: storedState?.lastCompletedAnswers ?? answers,
      lastCompletedScore: storedState?.lastCompletedScore ?? completedScore ?? undefined,
      lastCompletedAt: storedState?.lastCompletedAt ?? completedAt ?? undefined,
    }
    setQuestionDirection(-1)
    setIdx(0)
    setAnswers(next.draftAnswers)
    setCompletedScore(null)
    setCompletedAt(null)
    setLatestChoice(null)
    setCorrectStreak(0)
    onSaveState(next)
    onNotify?.(t('quiz.restart'), 'info')
  }

  const handleLoadSavedReview = () => {
    if (!storedState?.lastCompletedAnswers?.length) return
    const reviewAnswers = normalizeQuizAnswers(storedState.lastCompletedAnswers, quiz.length)
    setQuestionDirection(-1)
    setIdx(0)
    setAnswers(reviewAnswers)
    setCompletedScore(storedState.lastCompletedScore ?? computeQuizScore(quiz, reviewAnswers))
    setCompletedAt(storedState.lastCompletedAt ?? null)
    setCorrectStreak(0)
    onNotify?.(t('quiz.reviewSaved'), 'info')
  }

  const handleFinish = () => {
    const score = computeQuizScore(quiz, answers)
    const improvedBest = score > (bestScore?.best ?? 0)
    const nextCompletedAt = Date.now()
    const nextState: QuizStoredState = {
      draftAnswers: normalizeQuizAnswers([], quiz.length),
      draftIdx: 0,
      total: quiz.length,
      lastCompletedAnswers: [...answers],
      lastCompletedScore: score,
      lastCompletedAt: nextCompletedAt,
    }
    setCompletedScore(score)
    setCompletedAt(nextCompletedAt)
    onComplete(score, quiz.length, nextState)
    if (!improvedBest) onNotify?.(t('quiz.scoreLabel', { score, total: quiz.length }))
    if (score === quiz.length) {
      onCelebrate?.('complete', 'Perfect', `${score}/${quiz.length}`)
    } else if (score >= Math.ceil(quiz.length * 0.8)) {
      onCelebrate?.('achievement', 'Bravo', `${score}/${quiz.length}`)
    }
  }

  const goToPrevious = () => {
    setQuestionDirection(-1)
    setIdx((current) => clamp(current - 1, 0, quiz.length - 1))
  }

  const goToNext = () => {
    setQuestionDirection(1)
    setIdx((current) => clamp(current + 1, 0, quiz.length - 1))
  }

  return (
    <div className="stack">
      <AnimatePresence>
        {isReviewMode ? (
          <motion.section
            className="panel quizScorePanel"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
          >
            <div className="quizScoreSummary">
              <div>
                <h2>{t('quiz.bravo')}</h2>
                <p className="muted">{t('quiz.scoreLabel', { score: completedScore, total: quiz.length })}</p>
                {completedAt ? <div className="muted small">{t('quiz.savedAt')}: {new Date(completedAt).toLocaleString()}</div> : null}
              </div>
              <ScoreRing score={completedScore ?? 0} total={quiz.length} />
            </div>
            <div className="actionsRow">
              <button className="btnSecondary" onClick={handleRestart}>
                {t('quiz.restart')}
              </button>
              <button className="btnSecondary" onClick={onViewAllQuizzes}>
                {t('quiz.allQuizzes')}
              </button>
              <button className="btnPrimary" onClick={onBackToTopic}>
                {t('quiz.backToCourse')}
              </button>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {!isReviewMode && storedState?.lastCompletedAnswers?.length ? (
        <motion.section
          className="panel"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <div className="topicTop">
            <div>
              <div className="feedbackTitle">{t('quiz.savedAttemptAvailable')}</div>
              <div className="muted">
                {t('quiz.scoreLabel', {
                  score: storedState.lastCompletedScore ?? computeQuizScore(quiz, normalizeQuizAnswers(storedState.lastCompletedAnswers, quiz.length)),
                  total: quiz.length,
                })}
              </div>
            </div>
            <button className="btnSecondary" onClick={handleLoadSavedReview}>
              {t('quiz.reviewSaved')}
            </button>
          </div>
        </motion.section>
      ) : null}

      <div className="panel">
        <div className="quizTop">
          <div className="quizMeta">
            <div className="pill">
              {t('quiz.question', { current: idx + 1, total: quiz.length })}
            </div>
            <div className="muted small">{t('quiz.answered', { answered: answeredCount, total: quiz.length })}</div>
          </div>
          {funEnabled && correctStreak >= 2 ? (
            <div className="quizRewardRow">
              <StreakBadge value={correctStreak} label="combo" tone={correctStreak >= 3 ? 'hot' : 'default'} />
              {bestScore ? <span className="milestoneChip">PB {bestScore.best}/{bestScore.total}</span> : null}
            </div>
          ) : null}
          <div className="progress" aria-label={t('quiz.progress')}>
            <motion.div
              className="bar"
              animate={{ width: `${Math.round(((idx + 1) / quiz.length) * 100)}%` }}
              transition={{ duration: 0.42, ease: 'easeOut' }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait" custom={questionDirection}>
          <motion.div
            key={`${idx}-${isReviewMode ? 'review' : 'play'}`}
            className="quizStage"
            custom={questionDirection}
            initial={{ opacity: 0, x: questionDirection > 0 ? 42 : -42 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: questionDirection > 0 ? -32 : 32 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <h2 className="quizQ">{questionLabel}</h2>
            <div className="choices">
              {currentQuestion.choices.map((choice, choiceIndex) => {
                const choiceLabel = tr(t, courseKeys.quizChoice(sectionId, subsectionId, topicId, idx, choiceIndex), choice)
                const selected = picked === choice
                const correct = picked !== null && choice === currentQuestion.correctAnswer
                const selectionEffect = selected && latestChoice === choice
                  ? (correct ? 'answerPulse' : 'answerShake')
                  : ''

                return (
                  <motion.button
                    key={choice}
                    className={[
                      'choice',
                      selected ? 'selected' : '',
                      correct ? 'correct' : '',
                      selected && !correct ? 'wrong' : '',
                      selectionEffect,
                    ].join(' ')}
                    onClick={() => {
                      if (isReviewMode) return
                      const pickedIsCorrect = choice === currentQuestion.correctAnswer
                      setLatestChoice(choice)
                      setCorrectStreak((current) => {
                        const nextStreak = pickedIsCorrect ? current + 1 : 0
                        if (pickedIsCorrect) {
                          onPlaySound?.(nextStreak >= 3 ? 'milestone' : 'success')
                          if (funEnabled && nextStreak >= 2) {
                            onCelebrate?.('combo', 'Combo', `x${nextStreak}`)
                          }
                        } else {
                          onPlaySound?.('error')
                        }
                        return nextStreak
                      })
                      setAnswers((current) => {
                        const next = [...current]
                        next[idx] = choice
                        return next
                      })
                    }}
                    disabled={isReviewMode}
                    whileTap={{ scale: 0.985 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: choiceIndex * 0.04 }}
                  >
                    {choiceLabel}
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence>
              {picked !== null ? (
                <motion.div
                  className={['feedback', 'feedbackPremium', isCorrect ? 'ok' : '', isWrong ? 'no' : ''].join(' ')}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="feedbackTitleRow">
                    <motion.span
                      className="feedbackIcon"
                      initial={{ scale: 0.6, rotate: isCorrect ? -10 : 10 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    >
                      {isCorrect ? '✓' : '!'}
                    </motion.span>
                    <div className="feedbackTitle">{isCorrect ? t('quiz.correct') : t('quiz.wrong')}</div>
                  </div>
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }} className="muted">
                    {explanationLabel}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        <div className="quizActions">
          <motion.button className="btnSecondary" onClick={goToPrevious} disabled={idx === 0} whileTap={{ scale: 0.97 }}>
            {t('quiz.prev')}
          </motion.button>
          {isReviewMode ? (
            <motion.button className="btnPrimary" onClick={goToNext} disabled={idx === quiz.length - 1} whileTap={{ scale: 0.97 }}>
              {t('quiz.next')}
            </motion.button>
          ) : idx === quiz.length - 1 ? (
            <motion.button className="btnPrimary" onClick={handleFinish} disabled={picked === null || answeredCount !== quiz.length} whileTap={{ scale: 0.97 }}>
              {t('quiz.finish')}
            </motion.button>
          ) : (
            <motion.button className="btnPrimary" onClick={goToNext} disabled={picked === null} whileTap={{ scale: 0.97 }}>
              {t('quiz.next')}
            </motion.button>
          )}
        </div>
      </div>
    </div>
  )
}
