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
import type { CourseQuiz, QuizStoredState } from '../app/types'

type QuizProps = {
  quiz: CourseQuiz[]
  storedState?: QuizStoredState
  onSaveState: (next: QuizStoredState) => void
  onComplete: (score: number, total: number, next: QuizStoredState) => void
  onBackToTopic: () => void
  onViewAllQuizzes: () => void
  sectionId: string
  subsectionId: string
  topicId: string
}

export function Quiz({
  quiz,
  storedState,
  onSaveState,
  onComplete,
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
    setIdx(0)
    setAnswers(next.draftAnswers)
    setCompletedScore(null)
    setCompletedAt(null)
    onSaveState(next)
  }

  const handleLoadSavedReview = () => {
    if (!storedState?.lastCompletedAnswers?.length) return
    const reviewAnswers = normalizeQuizAnswers(storedState.lastCompletedAnswers, quiz.length)
    setIdx(0)
    setAnswers(reviewAnswers)
    setCompletedScore(storedState.lastCompletedScore ?? computeQuizScore(quiz, reviewAnswers))
    setCompletedAt(storedState.lastCompletedAt ?? null)
  }

  const handleFinish = () => {
    const score = computeQuizScore(quiz, answers)
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
  }

  return (
    <div className="stack">
      {isReviewMode ? (
        <section className="panel">
          <h2>{t('quiz.bravo')}</h2>
          <p className="muted">{t('quiz.scoreLabel', { score: completedScore, total: quiz.length })}</p>
          {completedAt ? <div className="muted small">{t('quiz.savedAt')}: {new Date(completedAt).toLocaleString()}</div> : null}
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
        </section>
      ) : null}

      {!isReviewMode && storedState?.lastCompletedAnswers?.length ? (
        <section className="panel">
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
        </section>
      ) : null}

      <div className="panel">
        <div className="quizTop">
          <div className="quizMeta">
            <div className="pill">
              {t('quiz.question', { current: idx + 1, total: quiz.length })}
            </div>
            <div className="muted small">{t('quiz.answered', { answered: answeredCount, total: quiz.length })}</div>
          </div>
          <div className="progress" aria-label={t('quiz.progress')}>
            <div className="bar" style={{ width: `${Math.round(((idx + 1) / quiz.length) * 100)}%` }} />
          </div>
        </div>

        <h2 className="quizQ">{questionLabel}</h2>
        <div className="choices">
          {currentQuestion.choices.map((choice, choiceIndex) => {
            const choiceLabel = tr(t, courseKeys.quizChoice(sectionId, subsectionId, topicId, idx, choiceIndex), choice)
            const selected = picked === choice
            const correct = picked !== null && choice === currentQuestion.correctAnswer
            return (
              <button
                key={choice}
                className={['choice', selected ? 'selected' : '', correct ? 'correct' : '', selected && !correct ? 'wrong' : ''].join(' ')}
                onClick={() => {
                  if (isReviewMode) return
                  setAnswers((current) => {
                    const next = [...current]
                    next[idx] = choice
                    return next
                  })
                }}
                disabled={isReviewMode}
              >
                {choiceLabel}
              </button>
            )
          })}
        </div>

        {picked !== null ? (
          <div className={['feedback', isCorrect ? 'ok' : '', isWrong ? 'no' : ''].join(' ')}>
            <div className="feedbackTitle">{isCorrect ? t('quiz.correct') : t('quiz.wrong')}</div>
            <div className="muted">{explanationLabel}</div>
          </div>
        ) : null}

        <div className="quizActions">
          <button className="btnSecondary" onClick={() => setIdx((current) => clamp(current - 1, 0, quiz.length - 1))} disabled={idx === 0}>
            {t('quiz.prev')}
          </button>
          {isReviewMode ? (
            <button className="btnPrimary" onClick={() => setIdx((current) => clamp(current + 1, 0, quiz.length - 1))} disabled={idx === quiz.length - 1}>
              {t('quiz.next')}
            </button>
          ) : idx === quiz.length - 1 ? (
            <button className="btnPrimary" onClick={handleFinish} disabled={picked === null || answeredCount !== quiz.length}>
              {t('quiz.finish')}
            </button>
          ) : (
            <button className="btnPrimary" onClick={() => setIdx((current) => clamp(current + 1, 0, quiz.length - 1))} disabled={picked === null}>
              {t('quiz.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
