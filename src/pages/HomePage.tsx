import { courseKeys } from '../i18n/course-keys'
import { useTranslate } from '../app/i18n'
import { tr } from '../app/helpers'
import type { CourseData, FlatTopicEntry } from '../app/types'

type HomePageProps = {
  course: CourseData
  query: string
  onQuery: (value: string) => void
  completionPct: number
  doneCount: number
  totalTopics: number
  recentDoneTopics: FlatTopicEntry[]
  nextTodoTopics: FlatTopicEntry[]
  doneTopics: Record<string, number>
  quizScores: Record<string, { best: number; total: number; at: number }>
  onOpenTopic: (subsectionId: string, topicId: string) => void
}

export function HomePage({
  course,
  query,
  onQuery,
  completionPct,
  doneCount,
  totalTopics,
  recentDoneTopics,
  nextTodoTopics,
  doneTopics,
  quizScores,
  onOpenTopic,
}: HomePageProps) {
  const { t } = useTranslate()

  function renderTopicCard(entry: FlatTopicEntry) {
    const { section, sub, topic } = entry
    const key = `${sub.id}::${topic.id}`
    const done = Boolean(doneTopics[key])
    const best = quizScores[key]
    const hasQuiz = Boolean(topic.quiz?.length)
    const sectionTitle = tr(t, courseKeys.sectionTitle(section.id), section.title)
    const subsectionTitle = tr(t, courseKeys.subsectionTitle(section.id, sub.id), sub.title)
    const topicTitle = tr(t, courseKeys.topicTitle(section.id, sub.id, topic.id), topic.title)

    return (
      <button key={key} className={['topicCard', done ? 'done' : ''].join(' ')} onClick={() => onOpenTopic(sub.id, topic.id)}>
        <div className="topicTop">
          <div className="topicTitle">{topicTitle}</div>
          <div className="chips">
            <span className="pill">{sub.id}</span>
            {hasQuiz ? <span className="pill accent">{t('topic.quiz')}</span> : <span className="pill">{t('topic.course')}</span>}
          </div>
        </div>
        <div className="muted small">
          {sectionTitle} • {subsectionTitle}
        </div>
        <div className="topicBottom">
          {done ? <span className="badge ok">{t('topic.done')}</span> : <span className="badge">{t('topic.todo')}</span>}
          {best ? (
            <span className="badge">
              {t('topic.bestQuiz', { best: best.best, total: best.total })}
            </span>
          ) : null}
        </div>
      </button>
    )
  }

  return (
    <div className="stack">
      <section className="heroCard">
        <div className="heroGlow" aria-hidden="true" />
        <div className="heroInner">
          <div className="heroKicker">{course.domain}</div>
          <h1 className="heroTitle">{t('hero.title')}</h1>
          <p className="heroSubtitle">{t('hero.subtitle')}</p>

          <div className="heroStats">
            <div className="stat">
              <div className="statTop">
                <div className="pill">{t('hero.progress')}</div>
                <div className="statPct">{completionPct}%</div>
              </div>
              <div className="progress big" aria-label={t('hero.progress')}>
                <div className="bar" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="muted">
                {doneCount}/{totalTopics} {t('hero.topicsChecked')}
              </div>
            </div>
            <div className="stat side">
              <div className="pill">{t('hero.version')}</div>
              <div className="statPct">{course.version}</div>
              <div className="muted">{t('hero.localData')}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="searchRow">
          <input
            className="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            inputMode="search"
            aria-label={t('search.label')}
          />
          <button className="btnSecondary" onClick={() => onQuery('')} disabled={!query}>
            {t('search.clear')}
          </button>
        </div>
        <div className="muted">{t('search.hint')}</div>
      </section>

      <section className="panel">
        <div className="sectionHead">
          <h2>{t('homeFocus.title')}</h2>
          <div className="muted small">{t('homeFocus.subtitle')}</div>
        </div>
        <div className="homeFocusGrid">
          <div className="homeFocusCol">
            <h3 className="sectionSubTitle">{t('homeFocus.recentDone')}</h3>
            <div className="homeFocusList">
              {recentDoneTopics.length
                ? recentDoneTopics.map(renderTopicCard)
                : <div className="muted">{t('homeFocus.emptyRecentDone')}</div>}
            </div>
          </div>
          <div className="homeFocusCol">
            <h3 className="sectionSubTitle">{t('homeFocus.nextTodo')}</h3>
            <div className="homeFocusList">
              {nextTodoTopics.length
                ? nextTodoTopics.map(renderTopicCard)
                : <div className="muted">{t('homeFocus.emptyNextTodo')}</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{t('outline.title')}</h2>
        <div className="outline">
          {course.sections.map((section) => (
            <details key={section.id} className="outlineBlock">
              <summary>
                <span className="outlineTitle">{section.id} — {tr(t, courseKeys.sectionTitle(section.id), section.title)}</span>
                <span className="pill">{section.subsections.reduce((count, subsection) => count + subsection.topics.length, 0)} {t('outline.topicsCount')}</span>
              </summary>
              <div className="outlineInner">
                {section.subsections.map((subsection) => (
                  <div key={subsection.id} className="outlineRow">
                    <div className="outlineLeft">
                      <div className="pill">{subsection.id}</div>
                      <div className="outlineName">{tr(t, courseKeys.subsectionTitle(section.id, subsection.id), subsection.title)}</div>
                    </div>
                    <div className="outlineTopics">
                      {subsection.topics.map((topic) => (
                        <button key={topic.id} className="outlineTopic" onClick={() => onOpenTopic(subsection.id, topic.id)}>
                          {tr(t, courseKeys.topicTitle(section.id, subsection.id, topic.id), topic.title)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
