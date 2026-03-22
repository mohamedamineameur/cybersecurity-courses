import { courseKeys } from '../i18n/course-keys'
import { useTranslate } from '../app/i18n'
import { formatInline, tr } from '../app/helpers'
import type { CourseSection, CourseSubsection, CourseTopic } from '../app/types'
import { ItemList } from '../components/ItemList'

type TopicPageProps = {
  section: CourseSection
  subsection: CourseSubsection
  topic: CourseTopic
  doneAt?: number
  bestQuiz?: { best: number; total: number; at: number }
  acronymMap: Map<string, string>
  onBack: () => void
  onToggleDone: () => void
  onStartQuiz: () => void
}

export function TopicPage({
  section,
  subsection,
  topic,
  doneAt,
  bestQuiz,
  acronymMap,
  onBack,
  onToggleDone,
  onStartQuiz,
}: TopicPageProps) {
  const { t } = useTranslate()
  const sectionId = section.id
  const subsectionId = subsection.id
  const topicId = topic.id

  const sectionTitle = tr(t, courseKeys.sectionTitle(sectionId), section.title)
  const subsectionTitle = tr(t, courseKeys.subsectionTitle(sectionId, subsectionId), subsection.title)
  const topicTitle = tr(t, courseKeys.topicTitle(sectionId, subsectionId, topicId), topic.title)
  const topicContent = topic.content
    ? tr(t, courseKeys.topicContent(sectionId, subsectionId, topicId), topic.content)
    : null

  return (
    <div className="stack">
      <section className="panel">
        <div className="topicHeader">
          <button className="btnSecondary" onClick={onBack}>
            {t('topicPage.back')}
          </button>
          <div className="crumbs">
            <span className="pill">{subsection.id}</span>
            <span className="muted small">{sectionTitle} • {subsectionTitle}</span>
          </div>
        </div>

        <h1 className="pageTitle">{topicTitle}</h1>
        {topicContent ? <p className="lead">{formatInline(topicContent, acronymMap)}</p> : null}

        <div className="actionsRow">
          <button className={['btnPrimary', doneAt ? 'ghost' : ''].join(' ')} onClick={onToggleDone}>
            {doneAt ? t('topicPage.markedDone') : t('topicPage.markDone')}
          </button>
          {topic.quiz?.length ? (
            <button className="btnSecondary" onClick={onStartQuiz}>
              {t('topicPage.startQuiz', { count: topic.quiz.length })}
            </button>
          ) : (
            <button className="btnSecondary" disabled>
              {t('topicPage.quizUnavailable')}
            </button>
          )}
        </div>

        {bestQuiz ? (
          <div className="feedback ok">
            <div className="feedbackTitle">{t('topicPage.bestScore')}</div>
            <div className="muted">
              {bestQuiz.best}/{bestQuiz.total}
            </div>
          </div>
        ) : null}
      </section>

      {topic.items?.length ? (
        <section className="panel">
          <h2>{t('topicPage.keyPoints')}</h2>
          <ItemList
            items={topic.items}
            acronymMap={acronymMap}
            sectionId={sectionId}
            subsectionId={subsectionId}
            topicId={topicId}
            t={t}
          />
        </section>
      ) : null}

      {topic.quiz?.length ? (
        <section className="panel">
          <h2>{t('topicPage.miniQuiz')}</h2>
          <div className="muted">{t('topicPage.miniQuizHint')}</div>
          <div className="miniQuiz">
            {topic.quiz.slice(0, 2).map((quiz, quizIndex) => (
              <div key={quiz.question} className="miniQ">
                <div className="miniQTitle">
                  {tr(t, courseKeys.quizQuestion(sectionId, subsectionId, topicId, quizIndex), quiz.question)}
                </div>
                <div className="chips">
                  {quiz.choices.slice(0, 4).map((choice, choiceIndex) => (
                    <span key={choice} className="chip">
                      {tr(t, courseKeys.quizChoice(sectionId, subsectionId, topicId, quizIndex, choiceIndex), choice)}
                    </span>
                  ))}
                </div>
                <div className="muted small">
                  {t('topicPage.answer')}: {tr(t, courseKeys.quizCorrectAnswer(sectionId, subsectionId, topicId, quizIndex), quiz.correctAnswer)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
