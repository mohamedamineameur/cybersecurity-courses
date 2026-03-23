import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useMemo, useState } from 'react'
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

function topicCardLayoutId(subsectionId: string, topicId: string) {
  return `topic-card:${subsectionId}:${topicId}`
}

const smoothEase = [0.22, 1, 0.36, 1] as const

const sectionVariant: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: smoothEase },
  },
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
  const [showDoneBurst, setShowDoneBurst] = useState(false)

  const sectionTitle = tr(t, courseKeys.sectionTitle(sectionId), section.title)
  const subsectionTitle = tr(t, courseKeys.subsectionTitle(sectionId, subsectionId), subsection.title)
  const topicTitle = tr(t, courseKeys.topicTitle(sectionId, subsectionId, topicId), topic.title)
  const topicContent = topic.content
    ? tr(t, courseKeys.topicContent(sectionId, subsectionId, topicId), topic.content)
    : null

  const doneParticles = useMemo(
    () => Array.from({ length: 8 }, (_, index) => ({
      id: index,
      x: Math.cos((Math.PI * 2 * index) / 8) * 34,
      y: Math.sin((Math.PI * 2 * index) / 8) * 22,
    })),
    [],
  )

  const handleToggleDone = () => {
    if (!doneAt) {
      setShowDoneBurst(true)
      window.setTimeout(() => setShowDoneBurst(false), 720)
    }
    onToggleDone()
  }

  return (
    <motion.div
      className="stack"
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
    >
      <motion.section
        className="panel topicHeroPanel"
        variants={sectionVariant}
        layoutId={topicCardLayoutId(subsectionId, topicId)}
      >
        <div className="topicHeader">
          <motion.button className="btnSecondary" onClick={onBack} whileTap={{ scale: 0.97 }}>
            {t('topicPage.back')}
          </motion.button>
          <div className="crumbs">
            <span className="pill">{subsection.id}</span>
            <span className="muted small">{sectionTitle} • {subsectionTitle}</span>
          </div>
        </div>

        <motion.h1 className="pageTitle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          {topicTitle}
        </motion.h1>
        {topicContent ? (
          <motion.p className="lead" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {formatInline(topicContent, acronymMap)}
          </motion.p>
        ) : null}

        <div className="actionsRow">
          <motion.button
            className={['btnPrimary', 'doneActionBtn', doneAt ? 'ghost' : ''].join(' ')}
            onClick={handleToggleDone}
            whileTap={{ scale: 0.96 }}
          >
            <span className="doneActionLabel">
              {doneAt ? t('topicPage.markedDone') : t('topicPage.markDone')}
            </span>
            <AnimatePresence>
              {doneAt ? (
                <motion.span
                  className="doneCheck"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                >
                  ✓
                </motion.span>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {showDoneBurst ? (
                <span className="doneBurst" aria-hidden="true">
                  {doneParticles.map((particle) => (
                    <motion.span
                      key={particle.id}
                      className="doneParticle"
                      initial={{ opacity: 0.9, x: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: 0, x: particle.x, y: particle.y, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.56, ease: 'easeOut' }}
                    />
                  ))}
                </span>
              ) : null}
            </AnimatePresence>
          </motion.button>

          {topic.quiz?.length ? (
            <motion.button className="btnSecondary" onClick={onStartQuiz} whileTap={{ scale: 0.97 }}>
              {t('topicPage.startQuiz', { count: topic.quiz.length })}
            </motion.button>
          ) : (
            <button className="btnSecondary" disabled>
              {t('topicPage.quizUnavailable')}
            </button>
          )}
        </div>

        {bestQuiz ? (
          <motion.div className="feedback ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.14 }}>
            <div className="feedbackTitle">{t('topicPage.bestScore')}</div>
            <div className="muted">
              {bestQuiz.best}/{bestQuiz.total}
            </div>
          </motion.div>
        ) : null}
      </motion.section>

      {topic.items?.length ? (
        <motion.section className="panel" variants={sectionVariant}>
          <h2>{t('topicPage.keyPoints')}</h2>
          <ItemList
            items={topic.items}
            acronymMap={acronymMap}
            sectionId={sectionId}
            subsectionId={subsectionId}
            topicId={topicId}
            t={t}
          />
        </motion.section>
      ) : null}

      {topic.quiz?.length ? (
        <motion.section className="panel" variants={sectionVariant}>
          <h2>{t('topicPage.miniQuiz')}</h2>
          <div className="muted">{t('topicPage.miniQuizHint')}</div>
          <motion.div
            className="miniQuiz"
            initial="hidden"
            animate="visible"
            variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {topic.quiz.slice(0, 2).map((quiz, quizIndex) => (
              <motion.div key={quiz.question} className="miniQ" variants={sectionVariant}>
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
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      ) : null}
    </motion.div>
  )
}
