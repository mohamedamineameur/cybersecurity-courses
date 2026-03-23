import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { courseKeys } from '../i18n/course-keys'
import { useTranslate } from '../app/i18n'
import { formatDuration, normalize, topicKey, tr, MOCK_EXAM_DURATION_MS } from '../app/helpers'
import type { FlatTopicEntry, MockExamState, QuizStoredState, SavedMockExamSession } from '../app/types'
import { EmptyState } from '../components/EmptyState'

type QuizHubPageProps = {
  quizzes: FlatTopicEntry[]
  quizScores: Record<string, { best: number; total: number; at: number }>
  quizStates: Record<string, QuizStoredState>
  mockExamState: MockExamState | null
  mockExamHistory: SavedMockExamSession[]
  mockExamQuestionCount: number
  onStartMockExam: () => void
  onResumeMockExam: () => void
  onOpenSavedMockExam: (saved: SavedMockExamSession) => void
  onOpenQuiz: (subsectionId: string, topicId: string) => void
  onOpenTopic: (subsectionId: string, topicId: string) => void
}

export function QuizHubPage({
  quizzes,
  quizScores,
  quizStates,
  mockExamState,
  mockExamHistory,
  mockExamQuestionCount,
  onStartMockExam,
  onResumeMockExam,
  onOpenSavedMockExam,
  onOpenQuiz,
  onOpenTopic,
}: QuizHubPageProps) {
  const { t } = useTranslate()
  const [query, setQuery] = useState('')
  const normalizedQuery = normalize(query)

  const filtered = useMemo(() => {
    const list = quizzes.slice().sort((a, b) => {
      const aKey = `${a.section.id}-${a.sub.id}-${a.topic.id}`
      const bKey = `${b.section.id}-${b.sub.id}-${b.topic.id}`
      return aKey.localeCompare(bKey, undefined, { numeric: true })
    })
    if (!normalizedQuery) return list
    return list.filter(({ section, sub, topic }) =>
      normalize(`${section.title} ${sub.title} ${topic.title} ${topic.id}`).includes(normalizedQuery)
    )
  }, [quizzes, normalizedQuery])

  return (
    <div className="stack">
      <motion.section
        className="heroCard small"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: 'easeOut' }}
      >
        <div className="heroGlow" aria-hidden="true" />
        <div className="heroInner">
          <div className="heroKicker">{t('quizHub.kicker')}</div>
          <h1 className="heroTitle">{t('quizHub.title')}</h1>
          <p className="heroSubtitle">{t('quizHub.subtitle')}</p>
          <div className="heroStats">
            <motion.div className="stat" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="statTop">
                <div className="pill">{t('quizHub.available')}</div>
                <div className="statPct">{quizzes.length}</div>
              </div>
              <div className="muted">{t('quizHub.savedResults', { count: Object.values(quizStates).filter((state) => state.lastCompletedAnswers?.length).length })}</div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section className="panel" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="topicTop">
          <div>
            <h2>{t('mockExam.cardTitle')}</h2>
            <div className="muted">{t('mockExam.cardSubtitle')}</div>
          </div>
          <div className="chips">
            <span className="pill accent">{t('mockExam.questionCount', { count: mockExamQuestionCount })}</span>
            <span className="pill">{t('mockExam.duration', { duration: formatDuration(MOCK_EXAM_DURATION_MS) })}</span>
          </div>
        </div>
        <div className="topicBottom">
          <span className="badge">{t('mockExam.coverageHint')}</span>
          {mockExamState && !mockExamState.submittedAt ? (
            <span className="badge ok">{t('mockExam.resumeAvailable')}</span>
          ) : null}
        </div>
        <div className="actionsRow">
          <button className="btnPrimary" onClick={mockExamState && !mockExamState.submittedAt ? onResumeMockExam : onStartMockExam}>
            {mockExamState && !mockExamState.submittedAt ? t('mockExam.resumeExam') : t('mockExam.startExam')}
          </button>
          <button className="btnSecondary" onClick={onStartMockExam}>
            {t('mockExam.newExam')}
          </button>
        </div>
      </motion.section>

      <motion.section className="panel" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="topicTop">
          <div>
            <h2>{t('mockExam.historyTitle')}</h2>
            <div className="muted">{t('mockExam.historyCount', { count: mockExamHistory.length })}</div>
          </div>
        </div>
        {mockExamHistory.length ? (
          <div className="quizHubList">
            {mockExamHistory.map((saved, index) => {
              const answeredCount = saved.answers.filter((answer) => answer !== null).length
              const total = saved.questionIds.length
              return (
                <motion.article
                  key={saved.id}
                  className="panel quizHubCard interactiveCard"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.04 }}
                >
                  <span className="cardShine" aria-hidden="true" />
                  <div className="topicTop">
                    <div>
                      <div className="topicTitle">{t('mockExam.historyEntryTitle')}</div>
                      <div className="muted small">{t('mockExam.finishedAt')}: {new Date(saved.submittedAt).toLocaleString()}</div>
                    </div>
                    <div className="chips">
                      <span className="pill accent">{t('mockExam.resultScore', { score: saved.score, total })}</span>
                    </div>
                  </div>
                  <div className="topicBottom">
                    <span className="badge">{t('mockExam.answeredCount', { answered: answeredCount, total })}</span>
                    <span className="badge">{formatDuration(Math.max(0, saved.submittedAt - saved.startedAt))}</span>
                  </div>
                  <div className="actionsRow">
                    <button className="btnPrimary" onClick={() => onOpenSavedMockExam(saved)}>
                      {t('mockExam.reviewSavedExam')}
                    </button>
                  </div>
                </motion.article>
              )
            })}
          </div>
        ) : (
          <EmptyState icon="[]" title={t('mockExam.historyTitle')} body={t('mockExam.historyEmpty')} />
        )}
      </motion.section>

      <motion.section className="panel" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="searchRow">
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('quizHub.searchPlaceholder')}
            inputMode="search"
            aria-label={t('quizHub.searchLabel')}
          />
          <button className="btnSecondary" onClick={() => setQuery('')} disabled={!query}>
            {t('search.clear')}
          </button>
        </div>
      </motion.section>

      <section className="quizHubList">
        {filtered.length ? (
          filtered.map(({ section, sub, topic }, index) => {
            const key = topicKey(sub.id, topic.id)
            const best = quizScores[key]
            const saved = quizStates[key]
            const questionCount = topic.quiz?.length ?? 0
            const sectionTitle = tr(t, courseKeys.sectionTitle(section.id), section.title)
            const subsectionTitle = tr(t, courseKeys.subsectionTitle(section.id, sub.id), sub.title)
            const topicTitle = tr(t, courseKeys.topicTitle(section.id, sub.id, topic.id), topic.title)
            const draftCount = saved?.draftAnswers?.filter((answer) => answer !== null).length ?? 0
            const hasDraft = draftCount > 0
            const lastScore = saved?.lastCompletedScore

            return (
              <motion.article
                key={key}
                className="panel quizHubCard interactiveCard"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
                transition={{ delay: index * 0.03 }}
              >
                <span className="cardShine" aria-hidden="true" />
                <div className="topicTop">
                  <div>
                    <div className="topicTitle">{topicTitle}</div>
                    <div className="muted small">{section.id} • {sectionTitle}</div>
                    <div className="muted small">{sub.id} • {subsectionTitle}</div>
                    <div className="muted small">{t('quizHub.topicId')}: {topic.id}</div>
                  </div>
                  <div className="chips">
                    <span className="pill accent">{t('topic.quiz')}</span>
                    <span className="pill">{t('quizHub.questions', { count: questionCount })}</span>
                  </div>
                </div>

                <div className="topicBottom">
                  {best ? <span className="badge">{t('quizHub.best', { score: best.best, total: best.total })}</span> : null}
                  {lastScore !== undefined ? (
                    <span className="badge ok">{t('quizHub.lastScore', { score: lastScore, total: saved?.total ?? questionCount })}</span>
                  ) : null}
                  {hasDraft ? <span className="badge">{t('quizHub.inProgress', { count: draftCount, total: questionCount })}</span> : null}
                </div>

                {saved?.lastCompletedAt ? (
                  <div className="muted small">{t('quizHub.savedAt')}: {new Date(saved.lastCompletedAt).toLocaleString()}</div>
                ) : null}

                <div className="actionsRow">
                  <button className="btnPrimary" onClick={() => onOpenQuiz(sub.id, topic.id)}>
                    {hasDraft ? t('quizHub.resume') : t('quizHub.openQuiz')}
                  </button>
                  <button className="btnSecondary" onClick={() => onOpenTopic(sub.id, topic.id)}>
                    {t('quizHub.openTopic')}
                  </button>
                </div>
              </motion.article>
            )
          })
        ) : (
          <div className="panel">
            <EmptyState icon="0" title={t('quizHub.title')} body={t('search.hint')} />
          </div>
        )}
      </section>
    </div>
  )
}
