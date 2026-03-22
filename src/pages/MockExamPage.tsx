import { useEffect, useState } from 'react'
import { useTranslate } from '../app/i18n'
import { clamp, formatDuration } from '../app/helpers'
import type { MockExamQuestion, MockExamState } from '../app/types'

type MockExamPageProps = {
  state: MockExamState | null
  questions: MockExamQuestion[]
  isSavedReview: boolean
  onStartNew: () => void
  onBackToHub: () => void
  onChooseAnswer: (questionIdx: number, answer: string) => void
  onGoToQuestion: (questionIdx: number) => void
  onSubmit: () => void
  onClear: () => void
  onCloseSavedReview: () => void
}

export function MockExamPage({
  state,
  questions,
  isSavedReview,
  onStartNew,
  onBackToHub,
  onChooseAnswer,
  onGoToQuestion,
  onSubmit,
  onClear,
  onCloseSavedReview,
}: MockExamPageProps) {
  const { t } = useTranslate()
  const [now, setNow] = useState(state?.startedAt ?? 0)

  useEffect(() => {
    if (!state || state.submittedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (!state || state.submittedAt) return
    if (Date.now() >= state.endsAt) onSubmit()
  }, [now, onSubmit, state])

  if (!state || !questions.length) {
    return (
      <div className="stack">
        <section className="panel">
          <h2>{t('mockExam.emptyTitle')}</h2>
          <p className="muted">{t('mockExam.emptyBody')}</p>
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

  return (
    <div className="stack">
      <section className="heroCard small">
        <div className="heroGlow" aria-hidden="true" />
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
                <div className="bar" style={{ width: `${Math.round((answeredCount / total) * 100)}%` }} />
              </div>
              <div className="muted">{t('mockExam.answeredCount', { answered: answeredCount, total })}</div>
            </div>
            <div className="stat side">
              <div className="pill">{t('mockExam.format')}</div>
              <div className="statPct">{total}</div>
              <div className="muted">{t('mockExam.multipleChoiceOnly')}</div>
            </div>
          </div>
        </div>
      </section>

      {isSavedReview ? (
        <section className="panel">
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
        </section>
      ) : null}

      {isSubmitted ? (
        <section className="panel">
          <h2>{t('mockExam.resultTitle')}</h2>
          <p className="muted">{t('mockExam.resultScore', { score: state.score ?? 0, total })}</p>
          <div className="topicBottom">
            <span className="badge ok">{t('mockExam.finishedAt')}: {state.submittedAt ? new Date(state.submittedAt).toLocaleString() : '-'}</span>
            <span className="badge">{t('mockExam.answeredCount', { answered: answeredCount, total })}</span>
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
        </section>
      ) : null}

      <section className="panel">
        <div className="topicTop">
          <div>
            <div className="pill">{t('quiz.question', { current: idx + 1, total })}</div>
            <div className="muted small">
              {current.sectionId} • {current.sectionTitle} • {current.subsectionId} • {current.subsectionTitle} • {current.topicTitle}
            </div>
          </div>
          <div className={['examTimer', remainingMs <= 10 * 60 * 1000 && !isSubmitted ? 'danger' : ''].join(' ')}>
            {formatDuration(isSubmitted ? 0 : remainingMs)}
          </div>
        </div>

        <h2 className="quizQ">{current.quiz.question}</h2>
        <div className="choices">
          {current.quiz.choices.map((choice) => {
            const selected = picked === choice
            const correct = isSubmitted && choice === current.quiz.correctAnswer
            return (
              <button
                key={choice}
                className={['choice', selected ? 'selected' : '', correct ? 'correct' : '', isSubmitted && selected && !correct ? 'wrong' : ''].join(' ')}
                disabled={isSubmitted}
                onClick={() => onChooseAnswer(idx, choice)}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {isSubmitted ? (
          <div className={['feedback', isCorrect ? 'ok' : 'no'].join(' ')}>
            <div className="feedbackTitle">{isCorrect ? t('quiz.correct') : t('quiz.wrong')}</div>
            <div className="muted">{t('quiz.correctWas', { answer: current.quiz.correctAnswer })}</div>
            {current.quiz.explanation ? <div className="muted">{current.quiz.explanation}</div> : null}
          </div>
        ) : null}

        <div className="quizActions">
          <button className="btnSecondary" onClick={() => onGoToQuestion(idx - 1)} disabled={idx === 0}>
            {t('quiz.prev')}
          </button>
          {isSubmitted ? (
            <button className="btnPrimary" onClick={() => onGoToQuestion(idx + 1)} disabled={idx === total - 1}>
              {t('quiz.next')}
            </button>
          ) : (
            <button className="btnPrimary" onClick={() => (idx === total - 1 ? onSubmit() : onGoToQuestion(idx + 1))}>
              {idx === total - 1 ? t('mockExam.submitExam') : t('quiz.next')}
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="topicTop">
          <h2>{t('mockExam.navigator')}</h2>
          {!isSubmitted ? (
            <button className="btnSecondary" onClick={onSubmit}>
              {t('mockExam.submitExam')}
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
              <button
                key={question.id}
                className={[
                  'examIndexBtn',
                  selected ? 'active' : '',
                  answered ? 'answered' : '',
                  correct ? 'correct' : '',
                  wrong ? 'wrong' : '',
                ].join(' ')}
                onClick={() => onGoToQuestion(questionIdx)}
              >
                {questionIdx + 1}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
