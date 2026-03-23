import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useState } from 'react'
import { courseKeys } from '../i18n/course-keys'
import { useAppI18n, useTranslate } from '../app/i18n'
import { tr } from '../app/helpers'
import type { CourseData, FlatTopicEntry } from '../app/types'
import { AnimatedCounter } from '../components/AnimatedCounter'
import { EmptyState } from '../components/EmptyState'
import { StreakBadge } from '../components/StreakBadge'

type HomePageProps = {
  course: CourseData
  showWelcomeIntro: boolean
  query: string
  onQuery: (value: string) => void
  completionPct: number
  completionMilestones: number[]
  nextMilestone: number | null
  recentTopicStreak: number
  funEnabled: boolean
  doneCount: number
  totalTopics: number
  recentDoneTopics: FlatTopicEntry[]
  nextTodoTopics: FlatTopicEntry[]
  doneTopics: Record<string, number>
  quizScores: Record<string, { best: number; total: number; at: number }>
  onDismissWelcomeIntro: () => void
  onOpenTopic: (subsectionId: string, topicId: string) => void
}

const smoothEase = [0.22, 1, 0.36, 1] as const

const staggerList: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.34, ease: smoothEase },
  },
}

function topicCardLayoutId(subsectionId: string, topicId: string) {
  return `topic-card:${subsectionId}:${topicId}`
}

function applyCardLightEffect(element: HTMLElement, clientX: number, clientY: number) {
  const rect = element.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 100
  const y = ((clientY - rect.top) / rect.height) * 100
  const rx = ((clientY - rect.top) / rect.height - 0.5) * -7
  const ry = ((clientX - rect.left) / rect.width - 0.5) * 8

  element.style.setProperty('--mx', `${x}%`)
  element.style.setProperty('--my', `${y}%`)
  element.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
  element.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
}

export function HomePage({
  course,
  showWelcomeIntro,
  query,
  onQuery,
  completionPct,
  completionMilestones,
  nextMilestone,
  recentTopicStreak,
  funEnabled,
  doneCount,
  totalTopics,
  recentDoneTopics,
  nextTodoTopics,
  doneTopics,
  quizScores,
  onDismissWelcomeIntro,
  onOpenTopic,
}: HomePageProps) {
  const { t } = useTranslate()
  const { language } = useAppI18n()
  const [heroOffset, setHeroOffset] = useState({ x: 0, y: 0 })
  const [openSections, setOpenSections] = useState<string[]>(() => course.sections.slice(0, 1).map((section) => section.id))

  function toggleSection(sectionId: string) {
    setOpenSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
    )
  }

  function renderTopicCard(entry: FlatTopicEntry, index = 0) {
    const { section, sub, topic } = entry
    const key = `${sub.id}::${topic.id}`
    const done = Boolean(doneTopics[key])
    const best = quizScores[key]
    const hasQuiz = Boolean(topic.quiz?.length)
    const sectionTitle = tr(t, courseKeys.sectionTitle(section.id), section.title)
    const subsectionTitle = tr(t, courseKeys.subsectionTitle(section.id, sub.id), sub.title)
    const topicTitle = tr(t, courseKeys.topicTitle(section.id, sub.id, topic.id), topic.title)

    return (
      <motion.button
        key={key}
        layoutId={topicCardLayoutId(sub.id, topic.id)}
        className={['topicCard', 'interactiveCard', done ? 'done' : ''].join(' ')}
        onClick={() => onOpenTopic(sub.id, topic.id)}
        variants={staggerItem}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
        whileHover={{ y: -6, scale: 1.01 }}
        whileTap={{ scale: 0.985 }}
        onMouseMove={(event) => applyCardLightEffect(event.currentTarget, event.clientX, event.clientY)}
        onMouseLeave={(event) => {
          event.currentTarget.style.setProperty('--rx', '0deg')
          event.currentTarget.style.setProperty('--ry', '0deg')
        }}
        transition={{ duration: 0.26, ease: smoothEase, delay: index * 0.03 }}
      >
        <span className="cardShine" aria-hidden="true" />
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
      </motion.button>
    )
  }

  return (
    <div className="stack">
      {showWelcomeIntro ? (
        <motion.section
          className="heroCard welcomeIntro"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: smoothEase }}
        >
          <div className="heroGlow" aria-hidden="true" />
          <div className="heroInner welcomeIntroInner">
            <div className="welcomeMedia">
              <img className="welcomeImage" src="/hero.png" alt="Illustration cybersécurité de l'application" />
            </div>
            <div className="welcomeContent">
              <div className="heroKicker">{course.domain}</div>
              <h1 className="heroTitle">
                {language === 'en'
                  ? 'A quick revision companion for Security+'
                  : 'Un aide-memoire rapide pour reviser Security+'}
              </h1>
              <p className="heroSubtitle">
                {language === 'en'
                  ? 'Review the main concepts, revise acronyms, practice with quizzes, and stay focused on the exam essentials.'
                  : "Parcours les notions importantes, revise les acronymes, entraine-toi avec les quiz et concentre-toi sur l'essentiel de la certification."}
              </p>
              <div className="welcomeBullets">
                <div className="welcomeBullet">
                  {language === 'en' ? 'Topic-by-topic revision sheets' : 'Fiches de revision organisees par sujet'}
                </div>
                <div className="welcomeBullet">
                  {language === 'en' ? 'Quiz and mock exam practice' : 'Quiz et examen blanc pour t entrainer'}
                </div>
                <div className="welcomeBullet">
                  {language === 'en' ? 'Acronyms and key concepts at a glance' : 'Acronymes et concepts cles accessibles rapidement'}
                </div>
              </div>
              <p className="welcomeNote">
                {language === 'en'
                  ? 'This app is a revision aid. Some information may be incomplete or inaccurate and will be updated continuously.'
                  : "Cette application est un support de revision. Certaines informations peuvent etre inexactes et seront mises a jour regulierement."}
              </p>
              <div className="welcomeActions">
                <button className="btnPrimary" onClick={onDismissWelcomeIntro}>
                  {language === 'en' ? 'Start revising' : 'Commencer la revision'}
                </button>
                <button className="btnSecondary" onClick={onDismissWelcomeIntro}>
                  {language === 'en' ? 'Open dashboard' : "Ouvrir l'accueil"}
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      ) : null}

      <motion.section
        className="heroCard heroCardInteractive"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: smoothEase }}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setHeroOffset({
            x: ((event.clientX - rect.left) / rect.width - 0.5) * 18,
            y: ((event.clientY - rect.top) / rect.height - 0.5) * 18,
          })
        }}
        onMouseLeave={() => setHeroOffset({ x: 0, y: 0 })}
        style={{ display: showWelcomeIntro ? 'none' : undefined }}
      >
        <motion.div
          className="heroGlow"
          aria-hidden="true"
          animate={{ x: heroOffset.x, y: heroOffset.y }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        />
        <div className="heroInner">
          <motion.div className="heroKicker" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            {course.domain}
          </motion.div>
          <motion.h1 className="heroTitle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            {t('hero.title')}
          </motion.h1>
          <motion.p className="heroSubtitle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            {t('hero.subtitle')}
          </motion.p>

          <motion.div className="heroStats" variants={staggerList} initial="hidden" animate="visible">
            <motion.div className="stat" variants={staggerItem} whileInView="visible" viewport={{ once: true }}>
              <div className="statTop">
                <div className="pill">{t('hero.progress')}</div>
                <AnimatedCounter value={completionPct} suffix="%" className="statPct" />
              </div>
              <div className="progress big" aria-label={t('hero.progress')}>
                <motion.div
                  className="bar"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 1.1, ease: smoothEase, delay: 0.15 }}
                />
              </div>
              <div className="muted">
                <AnimatedCounter value={doneCount} />/{totalTopics} {t('hero.topicsChecked')}
              </div>
              <div className="heroRewardRow">
                <StreakBadge
                  value={Math.max(recentTopicStreak, 1)}
                  label={recentTopicStreak > 1 ? 'serie' : 'focus'}
                  tone={recentTopicStreak >= 3 ? 'hot' : 'default'}
                />
                {nextMilestone ? (
                  <div className="milestoneChip">
                    {funEnabled ? '★ ' : ''}{nextMilestone}% objectif
                  </div>
                ) : (
                  <div className="milestoneChip done">100% complete</div>
                )}
              </div>
            </motion.div>
            <motion.div className="stat side" variants={staggerItem} whileInView="visible" viewport={{ once: true }}>
              <div className="pill">{t('hero.version')}</div>
              <div className="statPct">{course.version}</div>
              <div className="muted">{t('hero.localData')}</div>
              <div className="milestoneTrack">
                {completionMilestones.length ? completionMilestones.map((milestone) => (
                  <span key={milestone} className="milestoneTrackItem">
                    {milestone}%
                  </span>
                )) : <span className="milestoneTrackItem muted">0%</span>}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
        transition={{ duration: 0.35 }}
        style={{ display: showWelcomeIntro ? 'none' : undefined }}
      >
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
      </motion.section>

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
        transition={{ duration: 0.35, delay: 0.05 }}
        style={{ display: showWelcomeIntro ? 'none' : undefined }}
      >
        <div className="sectionHead">
          <h2>{t('homeFocus.title')}</h2>
          <div className="muted small">{t('homeFocus.subtitle')}</div>
        </div>
        <div className="homeFocusGrid">
          <div className="homeFocusCol">
            <h3 className="sectionSubTitle">{t('homeFocus.recentDone')}</h3>
            <motion.div className="homeFocusList" variants={staggerList} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {recentDoneTopics.length
                ? recentDoneTopics.map((entry, index) => renderTopicCard(entry, index))
                : <EmptyState icon="✓" title={t('homeFocus.recentDone')} body={t('homeFocus.emptyRecentDone')} />}
            </motion.div>
          </div>
          <div className="homeFocusCol">
            <h3 className="sectionSubTitle">{t('homeFocus.nextTodo')}</h3>
            <motion.div className="homeFocusList" variants={staggerList} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {nextTodoTopics.length
                ? nextTodoTopics.map((entry, index) => renderTopicCard(entry, index))
                : <EmptyState icon="..." title={t('homeFocus.nextTodo')} body={t('homeFocus.emptyNextTodo')} />}
            </motion.div>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="panel"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
        transition={{ duration: 0.35, delay: 0.1 }}
        style={{ display: showWelcomeIntro ? 'none' : undefined }}
      >
        <h2>{t('outline.title')}</h2>
        <div className="outline">
          {course.sections.map((section) => {
            const isOpen = openSections.includes(section.id)
            return (
              <motion.div key={section.id} className="outlineBlock" layout>
                <button className="outlineSummaryBtn" onClick={() => toggleSection(section.id)}>
                  <span className="outlineSummaryMain">
                    <span className="outlineTitle">{section.id} — {tr(t, courseKeys.sectionTitle(section.id), section.title)}</span>
                    <span className="pill">{section.subsections.reduce((count, subsection) => count + subsection.topics.length, 0)} {t('outline.topicsCount')}</span>
                  </span>
                  <motion.span className="outlineChevron" animate={{ rotate: isOpen ? 180 : 0 }}>
                    ⌄
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      className="outlineInner"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: smoothEase }}
                    >
                      <motion.div variants={staggerList} initial="hidden" animate="visible">
                        {section.subsections.map((subsection) => (
                          <motion.div key={subsection.id} className="outlineRow" variants={staggerItem}>
                            <div className="outlineLeft">
                              <div className="pill">{subsection.id}</div>
                              <div className="outlineName">{tr(t, courseKeys.subsectionTitle(section.id, subsection.id), subsection.title)}</div>
                            </div>
                            <div className="outlineTopics">
                              {subsection.topics.map((topic, index) => (
                                <motion.button
                                  key={topic.id}
                                  className="outlineTopic"
                                  onClick={() => onOpenTopic(subsection.id, topic.id)}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: index * 0.03 }}
                                >
                                  {tr(t, courseKeys.topicTitle(section.id, subsection.id, topic.id), topic.title)}
                                </motion.button>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </motion.section>
    </div>
  )
}
