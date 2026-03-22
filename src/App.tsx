import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { courseKeys } from './i18n/course-keys'
import enMessages from './i18n/en.json'
import frMessages from './i18n/fr.json'
import courseStringsData from './i18n/course-strings.json'
import './App.css'

type AcronymEntry = {
  acronym: string
  spelledOut: string
}

type CourseQuiz = {
  question: string
  choices: string[]
  correctAnswer: string
  explanation?: string
}

type CourseItem = {
  id: string
  name?: string
  title?: string
  description?: string
  content?: string
  examples?: string[]
  items?: CourseItem[]
}

type CourseTopic = {
  id: string
  title: string
  content?: string
  items?: CourseItem[]
  subtopics?: Array<{ id: string; title: string; items?: CourseItem[] }>
  quiz?: CourseQuiz[]
}

type CourseSubsection = {
  id: string
  title: string
  topics: CourseTopic[]
}

type CourseSection = {
  id: string
  title: string
  subsections: CourseSubsection[]
}

type CourseData = {
  domain: string
  version: string
  sections: CourseSection[]
}

type AcronymsData = {
  entries: AcronymEntry[]
}

type QuizExtraManifest = {
  files: string[]
}

type QuizStoredState = {
  draftAnswers: Array<string | null>
  draftIdx: number
  total: number
  lastCompletedAnswers?: Array<string | null>
  lastCompletedScore?: number
  lastCompletedAt?: number
}

type FlatTopicEntry = {
  section: CourseSection
  sub: CourseSubsection
  topic: CourseTopic
  text: string
}

type MockExamQuestion = {
  id: string
  questionIndex: number
  sectionId: string
  subsectionId: string
  topicId: string
  sectionTitle: string
  subsectionTitle: string
  topicTitle: string
  quiz: CourseQuiz
}

type MockExamState = {
  seed: string
  startedAt: number
  endsAt: number
  idx: number
  questionIds: string[]
  answers: Array<string | null>
  submittedAt?: number
  score?: number
}

type SavedMockExamSession = MockExamState & {
  id: string
  submittedAt: number
  score: number
}

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type AppLanguage = 'fr' | 'en'

type TranslateParams = Record<string, string | number | null | undefined>

type AppI18nContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  t: (key: string, params?: TranslateParams) => string
}

type Route =
  | { name: 'home' }
  | { name: 'quizzes' }
  | { name: 'exam' }
  | { name: 'topic'; subsectionId: string; topicId: string }
  | { name: 'quiz'; subsectionId: string; topicId: string }
  | { name: 'acronyms' }

const MOCK_EXAM_QUESTION_COUNT = 90
const MOCK_EXAM_DURATION_MS = 90 * 60 * 1000
const uiMessages = { fr: frMessages, en: enMessages } as const
const courseStringMessages: Partial<Record<AppLanguage, Record<string, string>>> = {
  en: (courseStringsData as { en?: Record<string, string> }).en ?? {},
}
const AppI18nContext = createContext<AppI18nContextValue | null>(null)

function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === 'en' ? 'en' : 'fr'
}

function getNestedMessage(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null

  let current: unknown = source
  for (const part of key.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return null
    current = (current as Record<string, unknown>)[part]
  }

  return typeof current === 'string' ? current : null
}

function interpolateMessage(template: string, params?: TranslateParams) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
}

function createTranslator(language: AppLanguage) {
  return (key: string, params?: TranslateParams) => {
    const message =
      getNestedMessage(uiMessages[language], key) ??
      courseStringMessages[language]?.[key] ??
      key

    return interpolateMessage(message, params)
  }
}

function useAppI18n() {
  const ctx = useContext(AppI18nContext)
  if (!ctx) throw new Error('AppI18nContext is missing')
  return ctx
}

function useTranslate() {
  const { t } = useAppI18n()
  return { t }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function topicKey(subsectionId: string, topicId: string) {
  return `${subsectionId}::${topicId}`
}

function mockExamQuestionKey(subsectionId: string, topicId: string, questionIndex: number) {
  return `${subsectionId}::${topicId}::${questionIndex}`
}

function savedMockExamId(seed: string, startedAt: number) {
  return `${startedAt}::${seed}`
}

function normalizeQuizAnswers(answers: Array<string | null> | undefined, total: number) {
  return Array.from({ length: total }, (_, i) => answers?.[i] ?? null)
}

function computeQuizScore(quiz: CourseQuiz[], answers: Array<string | null>) {
  return quiz.reduce((sum, q, idx) => sum + (answers[idx] === q.correctAnswer ? 1 : 0), 0)
}

function computeMockExamScore(
  questionIds: string[],
  answers: Array<string | null>,
  questionMap: Map<string, MockExamQuestion>
) {
  let score = 0
  for (let i = 0; i < questionIds.length; i += 1) {
    const q = questionMap.get(questionIds[i])
    if (q && answers[i] === q.quiz.correctAnswer) score += 1
  }
  return score
}

function areAnswersEqual(a: Array<string | null> | undefined, b: Array<string | null> | undefined) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function areQuizStatesEqual(a: QuizStoredState | undefined, b: QuizStoredState | undefined) {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.draftIdx === b.draftIdx &&
    a.total === b.total &&
    a.lastCompletedScore === b.lastCompletedScore &&
    a.lastCompletedAt === b.lastCompletedAt &&
    areAnswersEqual(a.draftAnswers, b.draftAnswers) &&
    areAnswersEqual(a.lastCompletedAnswers, b.lastCompletedAnswers)
  )
}

function areMockExamStatesEqual(a: MockExamState | null | undefined, b: MockExamState | null | undefined) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  return (
    a.seed === b.seed &&
    a.startedAt === b.startedAt &&
    a.endsAt === b.endsAt &&
    a.idx === b.idx &&
    a.submittedAt === b.submittedAt &&
    a.score === b.score &&
    areAnswersEqual(a.questionIds, b.questionIds) &&
    areAnswersEqual(a.answers, b.answers)
  )
}

function toSavedMockExamSession(state: MockExamState | null | undefined): SavedMockExamSession | null {
  if (!state?.submittedAt || state.score === undefined) return null
  return {
    ...state,
    id: savedMockExamId(state.seed, state.startedAt),
    submittedAt: state.submittedAt,
    score: state.score,
  }
}

function createSeededRandom(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = Math.imul(h ^ (h >>> 15), 1 | h)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleWithRandom<T>(items: T[], random: () => number) {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

function buildMockExamPool(topics: FlatTopicEntry[]) {
  const pool: MockExamQuestion[] = []
  for (const { section, sub, topic } of topics) {
    topic.quiz?.forEach((quiz, questionIndex) => {
      pool.push({
        id: mockExamQuestionKey(sub.id, topic.id, questionIndex),
        questionIndex,
        sectionId: section.id,
        subsectionId: sub.id,
        topicId: topic.id,
        sectionTitle: section.title,
        subsectionTitle: sub.title,
        topicTitle: topic.title,
        quiz,
      })
    })
  }
  return pool
}

function buildMockExamQuestions(pool: MockExamQuestion[], targetCount: number, seed: string) {
  const random = createSeededRandom(seed)
  const target = Math.min(targetCount, pool.length)
  if (target === 0) return []

  const selected: MockExamQuestion[] = []
  const selectedIds = new Set<string>()
  const usedTopics = new Set<string>()

  const register = (q: MockExamQuestion | undefined) => {
    if (!q || selectedIds.has(q.id) || selected.length >= target) return
    selected.push(q)
    selectedIds.add(q.id)
    usedTopics.add(topicKey(q.subsectionId, q.topicId))
  }

  const pickFromGroups = (groups: Map<string, MockExamQuestion[]>, distinctTopicOnly: boolean) => {
    const entries = shuffleWithRandom(Array.from(groups.values()), random)
    for (const group of entries) {
      if (selected.length >= target) break
      const candidate = shuffleWithRandom(group, random).find((q) => {
        if (selectedIds.has(q.id)) return false
        if (distinctTopicOnly && usedTopics.has(topicKey(q.subsectionId, q.topicId))) return false
        return true
      })
      register(candidate)
    }
  }

  const bySection = new Map<string, MockExamQuestion[]>()
  const bySubsection = new Map<string, MockExamQuestion[]>()
  const byTopic = new Map<string, MockExamQuestion[]>()

  for (const q of pool) {
    const topicId = topicKey(q.subsectionId, q.topicId)
    bySection.set(q.sectionId, [...(bySection.get(q.sectionId) ?? []), q])
    bySubsection.set(q.subsectionId, [...(bySubsection.get(q.subsectionId) ?? []), q])
    byTopic.set(topicId, [...(byTopic.get(topicId) ?? []), q])
  }

  pickFromGroups(bySection, true)
  pickFromGroups(bySubsection, true)
  pickFromGroups(byTopic, true)

  for (const q of shuffleWithRandom(pool, random)) {
    if (selected.length >= target) break
    if (!usedTopics.has(topicKey(q.subsectionId, q.topicId))) register(q)
  }

  for (const q of shuffleWithRandom(pool, random)) {
    if (selected.length >= target) break
    register(q)
  }

  return shuffleWithRandom(selected, random)
}

function getHashRoute(): Route {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return { name: 'home' }
  const [name, a, b] = raw.split('/')
  if (name === 'acronyms') return { name: 'acronyms' }
  if (name === 'quizzes') return { name: 'quizzes' }
  if (name === 'exam') return { name: 'exam' }
  if (name === 'topic' && a && b) return { name: 'topic', subsectionId: decodeURIComponent(a), topicId: decodeURIComponent(b) }
  if (name === 'quiz' && a && b) return { name: 'quiz', subsectionId: decodeURIComponent(a), topicId: decodeURIComponent(b) }
  return { name: 'home' }
}

function setHashRoute(r: Route) {
  if (r.name === 'home') window.location.hash = ''
  if (r.name === 'quizzes') window.location.hash = '#quizzes'
  if (r.name === 'exam') window.location.hash = '#exam'
  if (r.name === 'acronyms') window.location.hash = '#acronyms'
  if (r.name === 'topic') window.location.hash = `#topic/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`
  if (r.name === 'quiz') window.location.hash = `#quiz/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`
}

function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => getHashRoute())
  useEffect(() => {
    const onHash = () => setRoute(getHashRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return initial
      return JSON.parse(raw) as T
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  }, [key, value])

  return [value, setValue] as const
}

function normalizeCourseShape(course: CourseData): CourseData {
  const looksLikeEmbeddedSubsection = (x: unknown): x is { id: string; title: string; topics: CourseTopic[] } => {
    if (!x || typeof x !== 'object') return false
    const o = x as Record<string, unknown>
    return typeof o.id === 'string' && typeof o.title === 'string' && Array.isArray(o.topics)
  }

  // 1) Fix case where subsections are embedded inside another subsection's topics (seen in 1.0)
  const liftedSections = course.sections.map((section) => {
    const nextSubsections: CourseSubsection[] = []

    for (const ss of section.subsections) {
      const keptTopics: CourseTopic[] = []
      const liftedHere: CourseSubsection[] = []

      for (const t of ss.topics) {
        if (looksLikeEmbeddedSubsection(t)) liftedHere.push({ id: t.id, title: t.title, topics: t.topics })
        else keptTopics.push(t)
      }

      if (keptTopics.length) nextSubsections.push({ id: ss.id, title: ss.title, topics: keptTopics })
      nextSubsections.push(...liftedHere)
    }

    return { ...section, subsections: nextSubsections }
  })

  // 2) Fix case where a subsection like "1.4" is mistakenly stored as a top-level "section"
  const section10 = liftedSections.find((s) => s.id === '1.0')
  if (!section10) return { ...course, sections: liftedSections }

  const movedSubsections: CourseSubsection[] = []
  const keptTopSections: CourseSection[] = []

  for (const s of liftedSections) {
    const isSubsectionOf10 = typeof s.id === 'string' && /^1\.\d+$/.test(s.id) && s.id !== '1.0'
    const topicsAny = (s as unknown as { topics?: CourseTopic[] }).topics
    if (isSubsectionOf10 && Array.isArray(topicsAny)) {
      movedSubsections.push({ id: s.id, title: s.title, topics: topicsAny })
    } else {
      keptTopSections.push(s)
    }
  }

  if (movedSubsections.length === 0) return { ...course, sections: keptTopSections }

  const fixedSections = keptTopSections.map((s) => {
    if (s.id !== '1.0') return s
    const existing = new Set(s.subsections.map((ss) => ss.id))
    const merged = [...s.subsections, ...movedSubsections.filter((ss) => !existing.has(ss.id))]
    return { ...s, subsections: merged }
  })

  return { ...course, sections: fixedSections }
}

async function fetchJsonIfOk<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

const legacyExtraFiles = [
  'course-quiz-extra-1.0.json',
  'course-quiz-extra-2.json',
  'course-quiz-extra-3.json',
  'course-quiz-extra-4.0.json',
  'course-quiz-extra-5.0.json',
]

function qualifyExtraKey(fileName: string, key: string) {
  if (key.includes('::')) return key

  const match = fileName.match(/^course-quiz-extra-([\d.]+)\.json$/)
  if (!match) return key

  return topicKey(match[1], key)
}

async function loadQuizExtras() {
  const manifest = await fetchJsonIfOk<QuizExtraManifest>('/data/course-quiz-extras.json')
  const files = manifest?.files?.length ? manifest.files : legacyExtraFiles
  const all = await Promise.all(files.map(async (f) => ({ file: f, data: await fetchJsonIfOk<Record<string, CourseQuiz[]>>(`/data/${f}`) })))
  const merged: Record<string, CourseQuiz[]> = {}

  for (const { file, data } of all) {
    if (!data) continue
    for (const [k, v] of Object.entries(data)) {
      const qualifiedKey = qualifyExtraKey(file, k)
      merged[qualifiedKey] = (merged[qualifiedKey] ?? []).concat(v)
    }
  }

  return merged
}

function mergeQuizExtras(course: CourseData, extras: Record<string, CourseQuiz[]>, targetPerTopic: number) {
  for (const section of course.sections) {
    for (const sub of section.subsections) {
      for (const topic of sub.topics) {
        const key = topicKey(sub.id, topic.id)
        const extraQuiz = extras[key]
        if (!extraQuiz?.length) continue

        if (!topic.quiz) topic.quiz = []

        // Avoid exact duplicates (question + correct answer).
        const seen = new Set(topic.quiz.map((q) => `${q.question}::${q.correctAnswer}`))

        for (const q of extraQuiz) {
          const sig = `${q.question}::${q.correctAnswer}`
          if (seen.has(sig)) continue

          // Basic validation: correctAnswer must be one of choices.
          if (!q.choices?.length || !q.choices.includes(q.correctAnswer)) continue

          topic.quiz.push(q)
          seen.add(sig)
        }

        // Keep UX stable: cap at target questions per topic.
        if (topic.quiz.length > targetPerTopic) topic.quiz = topic.quiz.slice(0, targetPerTopic)
      }
    }
  }
  return course
}

function useCourseData() {
  const [data, setData] = useState<CourseData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/data/course.json').then((r) => r.json() as Promise<CourseData>),
      fetch('/data/acronyms.json').then((r) => r.json() as Promise<AcronymsData>),
      loadQuizExtras(),
    ])
      .then(([course, acronyms, extras]) => {
        if (cancelled) return

        const normalized = normalizeCourseShape(course)
        setData(mergeQuizExtras(normalized, extras, 10))
        ;(window as unknown as { __acronyms?: AcronymsData }).__acronyms = acronyms
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setErr(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, err }
}

function getAcronyms(): AcronymsData | null {
  const w = window as unknown as { __acronyms?: AcronymsData }
  return w.__acronyms ?? null
}

function findTopic(course: CourseData, subsectionId: string, topicId: string) {
  for (const section of course.sections) {
    for (const sub of section.subsections) {
      if (sub.id !== subsectionId) continue
      const topic = sub.topics.find((t) => t.id === topicId)
      if (topic) return { section, sub, topic }
    }
  }
  return null
}

function topicText(t: CourseTopic) {
  const parts: string[] = []
  parts.push(t.title)
  if (t.content) parts.push(t.content)
  const walk = (item: CourseItem) => {
    if (item.title) parts.push(item.title)
    if (item.name) parts.push(item.name)
    if (item.description) parts.push(item.description)
    if (item.content) parts.push(item.content)
    if (item.examples?.length) parts.push(item.examples.join(' '))
    item.items?.forEach(walk)
  }
  t.items?.forEach(walk)
  if (t.subtopics?.length) {
    for (const st of t.subtopics) {
      parts.push(st.title)
      st.items?.forEach(walk)
    }
  }
  if (t.quiz?.length) parts.push(t.quiz.map((q) => `${q.question} ${q.choices.join(' ')} ${q.correctAnswer} ${q.explanation ?? ''}`).join(' '))
  return normalize(parts.join(' '))
}

function formatInline(text: string, acronymMap: Map<string, string>) {
  function InlineAcronym({ short, expanded }: { short: string; expanded: string }) {
    const [open, setOpen] = useState(false)

    return (
      <span
        className={['acronymWrap', open ? 'open' : ''].join(' ')}
        onBlur={(e) => {
          const next = e.relatedTarget
          if (!(next instanceof Node) || !e.currentTarget.contains(next)) setOpen(false)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setOpen(false)
          }
        }}
      >
        <button
          type="button"
          className="acronym"
          title={expanded}
          aria-expanded={open}
          aria-label={`${short}: ${expanded}`}
          onClick={() => setOpen((v) => !v)}
        >
          {short}
        </button>
        {open ? (
          <span className="acronymPopover" role="tooltip">
            {expanded}
          </span>
        ) : null}
      </span>
    )
  }

  const words = text.split(/(\b)/)
  return words.map((w, idx) => {
    const key = w.toUpperCase()
    const expanded = acronymMap.get(key)
    if (!expanded) return <span key={idx}>{w}</span>
    return <InlineAcronym key={idx} short={w} expanded={expanded} />
  })
}

function tr(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key)
  return translated === key ? fallback : translated
}

function ItemList({
  items,
  acronymMap,
  sectionId,
  subsectionId,
  topicId,
  parentItemId,
  t,
}: {
  items: CourseItem[]
  acronymMap: Map<string, string>
  sectionId: string
  subsectionId: string
  topicId: string
  parentItemId?: string
  t: (key: string) => string
}) {
  return (
    <ul className="itemList">
      {items.map((it) => {
        const label = parentItemId
          ? tr(t, courseKeys.subItemName(sectionId, subsectionId, topicId, parentItemId, it.id), it.name ?? it.title ?? it.id)
          : tr(t, courseKeys.itemName(sectionId, subsectionId, topicId, it.id), it.name ?? it.title ?? it.id)
        const desc = it.description
          ? parentItemId
            ? formatInline(tr(t, courseKeys.subItemDescription(sectionId, subsectionId, topicId, parentItemId, it.id), it.description), acronymMap)
            : formatInline(tr(t, courseKeys.itemDescription(sectionId, subsectionId, topicId, it.id), it.description), acronymMap)
          : null
        const cont = it.content
          ? formatInline(tr(t, courseKeys.itemContent(sectionId, subsectionId, topicId, it.id), it.content), acronymMap)
          : null
        return (
          <li key={it.id} className="itemCard">
            <div className="itemHeader">
              <div className="itemTitle">{label}</div>
              {it.id ? <div className="pill">{it.id}</div> : null}
            </div>
            {desc ? <p className="muted">{desc}</p> : null}
            {cont ? <p>{cont}</p> : null}
            {it.examples?.length ? (
              <div className="chips">
                {it.examples.map((ex, i) => (
                  <span key={i} className="chip">
                    {formatInline(tr(t, courseKeys.itemExample(sectionId, subsectionId, topicId, it.id, i), ex), acronymMap)}
                  </span>
                ))}
              </div>
            ) : null}
            {it.items?.length ? (
              <ItemList
                items={it.items}
                acronymMap={acronymMap}
                sectionId={sectionId}
                subsectionId={subsectionId}
                topicId={topicId}
                parentItemId={it.id}
                t={t}
              />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

function Quiz({
  quiz,
  storedState,
  onSaveState,
  onComplete,
  onBackToTopic,
  onViewAllQuizzes,
  sectionId,
  subsectionId,
  topicId,
}: {
  quiz: CourseQuiz[]
  storedState?: QuizStoredState
  onSaveState: (next: QuizStoredState) => void
  onComplete: (score: number, total: number, next: QuizStoredState) => void
  onBackToTopic: () => void
  onViewAllQuizzes: () => void
  sectionId: string
  subsectionId: string
  topicId: string
}) {
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

  const q = quiz[idx]
  const picked = answers[idx] ?? null
  const isReviewMode = completedScore !== null
  const answeredCount = answers.filter((answer) => answer !== null).length
  const isCorrect = picked !== null && picked === q.correctAnswer
  const isWrong = picked !== null && picked !== q.correctAnswer
  const questionLabel = tr(t, courseKeys.quizQuestion(sectionId, subsectionId, topicId, idx), q.question)
  const correctAnswerLabel = tr(t, courseKeys.quizCorrectAnswer(sectionId, subsectionId, topicId, idx), q.correctAnswer)
  const explanationLabel = q.explanation
    ? tr(t, courseKeys.quizExplanation(sectionId, subsectionId, topicId, idx), q.explanation)
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
          {q.choices.map((c, i) => {
            const choiceLabel = tr(t, courseKeys.quizChoice(sectionId, subsectionId, topicId, idx, i), c)
            const selected = picked === c
            const correct = picked !== null && c === q.correctAnswer
            return (
              <button
                key={c}
                className={['choice', selected ? 'selected' : '', correct ? 'correct' : '', selected && !correct ? 'wrong' : ''].join(' ')}
                onClick={() => {
                  if (isReviewMode) return
                  setAnswers((current) => {
                    const next = [...current]
                    next[idx] = c
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
  const t = useMemo(() => createTranslator(normalizeLanguage(language)), [language])
  const i18nValue = useMemo(
    () => ({ language: normalizeLanguage(language), setLanguage, t }),
    [language, setLanguage, t],
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
    const m = new Map<string, string>()
    if (!acronyms) return m
    for (const e of acronyms.entries) {
      const k = e.acronym.toUpperCase()
      if (!m.has(k)) m.set(k, e.spelledOut)
    }
    return m
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
  const quizTopics = useMemo(() => flatTopics.filter(({ topic }) => Boolean(topic.quiz?.length)), [flatTopics])
  const mockExamPool = useMemo(() => buildMockExamPool(quizTopics), [quizTopics])
  const mockExamQuestionMap = useMemo(() => new Map(mockExamPool.map((q) => [q.id, q])), [mockExamPool])
  const shownMockExamState = reviewMockExam ?? mockExamState
  const mockExamQuestions = useMemo(
    () => (shownMockExamState ? shownMockExamState.questionIds.map((id) => mockExamQuestionMap.get(id)).filter(Boolean) as MockExamQuestion[] : []),
    [mockExamQuestionMap, shownMockExamState]
  )
  const doneCount = Object.keys(doneTopics).length
  const completionPct = totalTopics ? Math.round((doneCount / totalTopics) * 100) : 0

  const qn = normalize(query)
  const results = useMemo(() => {
    if (!qn) return flatTopics.slice(0, 18)
    const hits = flatTopics
      .filter((x) => x.text.includes(qn) || normalize(x.sub.title).includes(qn) || normalize(x.section.title).includes(qn))
      .slice(0, 40)
    return hits
  }, [flatTopics, qn])

  const current =
    course && (route.name === 'topic' || route.name === 'quiz') ? findTopic(course, route.subsectionId, route.topicId) : null

  const currentQuizKey = current ? topicKey(current.sub.id, current.topic.id) : null

  const saveCurrentQuizState = useCallback((next: QuizStoredState) => {
    if (!currentQuizKey) return
    setQuizStates((prev) => {
      const prevState = prev[currentQuizKey]
      if (areQuizStatesEqual(prevState, next)) return prev
      return { ...prev, [currentQuizKey]: next }
    })
  }, [currentQuizKey, setQuizStates])

  const completeCurrentQuiz = useCallback((score: number, total: number, next: QuizStoredState) => {
    if (!current || !currentQuizKey) return
    setQuizStates((prev) => {
      const prevState = prev[currentQuizKey]
      if (areQuizStatesEqual(prevState, next)) return prev
      return { ...prev, [currentQuizKey]: next }
    })

    const nextAt = next.lastCompletedAt ?? Date.now()
    const old = quizScores[currentQuizKey]
    const best = Math.max(old?.best ?? 0, score)
    setQuizScores((prev) => {
      const prevScore = prev[currentQuizKey]
      if (prevScore?.best === best && prevScore?.total === total && prevScore?.at === nextAt) return prev
      return { ...prev, [currentQuizKey]: { best, total, at: nextAt } }
    })
  }, [current, currentQuizKey, quizScores, setQuizScores, setQuizStates])

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
      questionIds: selectedQuestions.map((q) => q.id),
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

  const page =
    !course ? (
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
        onOpenQuiz={(subsectionId, topicId) => setHashRoute({ name: 'quiz', subsectionId, topicId })}
        onOpenTopic={(subsectionId, topicId) => setHashRoute({ name: 'topic', subsectionId, topicId })}
      />
    ) : route.name === 'exam' ? (
      <MockExamPage
        state={shownMockExamState}
        questions={mockExamQuestions}
        isSavedReview={Boolean(reviewMockExam)}
        onStartNew={startMockExam}
        onBackToHub={() => setHashRoute({ name: 'quizzes' })}
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
        onBackToTopic={() => setHashRoute({ name: 'topic', subsectionId: current.sub.id, topicId: current.topic.id })}
        onViewAllQuizzes={() => setHashRoute({ name: 'quizzes' })}
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
        onBack={() => setHashRoute({ name: 'home' })}
        onToggleDone={() => {
          const key = topicKey(current.sub.id, current.topic.id)
          const nextDoneAt = doneTopics[key] ? null : Date.now()
          setDoneTopics((prev) => {
            const next = { ...prev }
            if (next[key]) delete next[key]
            else next[key] = nextDoneAt!
            return next
          })
        }}
        onStartQuiz={() => setHashRoute({ name: 'quiz', subsectionId: current.sub.id, topicId: current.topic.id })}
      />
    ) : (
      <HomePage
        course={course}
        query={query}
        onQuery={setQuery}
        completionPct={completionPct}
        doneCount={doneCount}
        totalTopics={totalTopics}
        results={results}
        doneTopics={doneTopics}
        quizScores={quizScores}
        onOpenTopic={(subsectionId, topicId) => setHashRoute({ name: 'topic', subsectionId, topicId })}
      />
    )

  return (
    <AppI18nContext.Provider value={i18nValue}>
      <div className="appShell">
        <header className="topBar">
          <div className="brand" onClick={() => setHashRoute({ name: 'home' })} role="button" tabIndex={0}>
            <div className="brandMark" aria-hidden="true">
              S+
            </div>
            <div className="brandText">
              <div className="brandTitle">{t('brand.title')}</div>
              <div className="brandSub">{t('brand.subtitle')}</div>
            </div>
          </div>

          <div className="topBarRight">
            {installPrompt && !isInstalled ? (
              <button className="btnPrimary installBtn" onClick={() => void installApp()}>
                {t('pwa.install')}
              </button>
            ) : null}
            {isInstalled ? <span className="pill accent">{t('pwa.installed')}</span> : null}
            <div className="langSwitcher">
              <button
                className={language === 'fr' ? 'active' : ''}
                onClick={() => setLanguage('fr')}
                aria-label="Français"
              >
                FR
              </button>
              <button
                className={language === 'en' ? 'active' : ''}
                onClick={() => setLanguage('en')}
                aria-label="English"
              >
                EN
              </button>
            </div>
            <nav className="topNav">
              <button className={['navBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={() => setHashRoute({ name: 'home' })}>
                {t('nav.revise')}
              </button>
              <button className={['navBtn', route.name === 'quizzes' || route.name === 'quiz' || route.name === 'exam' ? 'active' : ''].join(' ')} onClick={() => setHashRoute({ name: 'quizzes' })}>
                {t('nav.quizzes')}
              </button>
              <button
                className={['navBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')}
                onClick={() => setHashRoute({ name: 'acronyms' })}
              >
                {t('nav.acronyms')}
              </button>
            </nav>
          </div>
        </header>

        <main className="main">{page}</main>

        <footer className="bottomBar" aria-label="Navigation">
          <button className={['bottomBtn', route.name === 'home' ? 'active' : ''].join(' ')} onClick={() => setHashRoute({ name: 'home' })}>
            <span className="bottomIcon" aria-hidden="true">
              ⌁
            </span>
            <span className="bottomLabel">{t('nav.home')}</span>
          </button>
          <button className={['bottomBtn', route.name === 'quizzes' || route.name === 'quiz' || route.name === 'exam' ? 'active' : ''].join(' ')} onClick={() => setHashRoute({ name: 'quizzes' })}>
            <span className="bottomIcon" aria-hidden="true">
              ?!
            </span>
            <span className="bottomLabel">{t('nav.quizzes')}</span>
          </button>
          <button
            className={['bottomBtn', route.name === 'acronyms' ? 'active' : ''].join(' ')}
            onClick={() => setHashRoute({ name: 'acronyms' })}
          >
            <span className="bottomIcon" aria-hidden="true">
              Aa
            </span>
            <span className="bottomLabel">{t('nav.acronyms')}</span>
          </button>
        </footer>
      </div>
    </AppI18nContext.Provider>
  )
}

export default App

function HomePage(props: {
  course: CourseData
  query: string
  onQuery: (v: string) => void
  completionPct: number
  doneCount: number
  totalTopics: number
  results: Array<{ section: CourseSection; sub: CourseSubsection; topic: CourseTopic }>
  doneTopics: Record<string, number>
  quizScores: Record<string, { best: number; total: number; at: number }>
  onOpenTopic: (subsectionId: string, topicId: string) => void
}) {
  const { t } = useTranslate()
  const { course, query, onQuery, completionPct, doneCount, totalTopics, results, doneTopics, quizScores, onOpenTopic } = props

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
            onChange={(e) => onQuery(e.target.value)}
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

      <section className="grid">
        {results.map(({ section, sub, topic }) => {
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
        })}
      </section>

      <section className="panel">
        <h2>{t('outline.title')}</h2>
        <div className="outline">
          {course.sections.map((s) => (
            <details key={s.id} className="outlineBlock">
              <summary>
                <span className="outlineTitle">{s.id} — {tr(t, courseKeys.sectionTitle(s.id), s.title)}</span>
                <span className="pill">{s.subsections.reduce((n, ss) => n + ss.topics.length, 0)} {t('outline.topicsCount')}</span>
              </summary>
              <div className="outlineInner">
                {s.subsections.map((ss) => (
                  <div key={ss.id} className="outlineRow">
                    <div className="outlineLeft">
                      <div className="pill">{ss.id}</div>
                      <div className="outlineName">{tr(t, courseKeys.subsectionTitle(s.id, ss.id), ss.title)}</div>
                    </div>
                    <div className="outlineTopics">
                      {ss.topics.map((tp) => (
                        <button key={tp.id} className="outlineTopic" onClick={() => onOpenTopic(ss.id, tp.id)}>
                          {tr(t, courseKeys.topicTitle(s.id, ss.id, tp.id), tp.title)}
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

function QuizHubPage(props: {
  quizzes: Array<FlatTopicEntry>
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
}) {
  const { t } = useTranslate()
  const { quizzes, quizScores, quizStates, mockExamState, mockExamHistory, mockExamQuestionCount, onStartMockExam, onResumeMockExam, onOpenSavedMockExam, onOpenQuiz, onOpenTopic } = props
  const [query, setQuery] = useState('')
  const qn = normalize(query)

  const filtered = useMemo(() => {
    const list = quizzes.slice().sort((a, b) => {
      const aKey = `${a.section.id}-${a.sub.id}-${a.topic.id}`
      const bKey = `${b.section.id}-${b.sub.id}-${b.topic.id}`
      return aKey.localeCompare(bKey, undefined, { numeric: true })
    })
    if (!qn) return list
    return list.filter(({ section, sub, topic }) =>
      normalize(`${section.title} ${sub.title} ${topic.title} ${topic.id}`).includes(qn)
    )
  }, [quizzes, qn])

  return (
    <div className="stack">
      <section className="heroCard small">
        <div className="heroGlow" aria-hidden="true" />
        <div className="heroInner">
          <div className="heroKicker">{t('quizHub.kicker')}</div>
          <h1 className="heroTitle">{t('quizHub.title')}</h1>
          <p className="heroSubtitle">{t('quizHub.subtitle')}</p>
          <div className="heroStats">
            <div className="stat">
              <div className="statTop">
                <div className="pill">{t('quizHub.available')}</div>
                <div className="statPct">{quizzes.length}</div>
              </div>
              <div className="muted">{t('quizHub.savedResults', { count: Object.values(quizStates).filter((x) => x.lastCompletedAnswers?.length).length })}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
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
      </section>

      <section className="panel">
        <div className="topicTop">
          <div>
            <h2>{t('mockExam.historyTitle')}</h2>
            <div className="muted">{t('mockExam.historyCount', { count: mockExamHistory.length })}</div>
          </div>
        </div>
        {mockExamHistory.length ? (
          <div className="quizHubList">
            {mockExamHistory.map((saved) => {
              const answeredCount = saved.answers.filter((answer) => answer !== null).length
              const total = saved.questionIds.length
              return (
                <article key={saved.id} className="panel quizHubCard">
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
                </article>
              )
            })}
          </div>
        ) : (
          <p className="muted">{t('mockExam.historyEmpty')}</p>
        )}
      </section>

      <section className="panel">
        <div className="searchRow">
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('quizHub.searchPlaceholder')}
            inputMode="search"
            aria-label={t('quizHub.searchLabel')}
          />
          <button className="btnSecondary" onClick={() => setQuery('')} disabled={!query}>
            {t('search.clear')}
          </button>
        </div>
      </section>

      <section className="quizHubList">
        {filtered.map(({ section, sub, topic }) => {
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
            <article key={key} className="panel quizHubCard">
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
            </article>
          )
        })}
      </section>
    </div>
  )
}

function MockExamPage(props: {
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
}) {
  const { t } = useTranslate()
  const { state, questions, isSavedReview, onStartNew, onBackToHub, onChooseAnswer, onGoToQuestion, onSubmit, onClear, onCloseSavedReview } = props
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
  const currentQuestionLabel = current.quiz.question
  const currentCorrectAnswerLabel = current.quiz.correctAnswer

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

        <h2 className="quizQ">{currentQuestionLabel}</h2>
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
            <div className="muted">{t('quiz.correctWas', { answer: currentCorrectAnswerLabel })}</div>
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

function TopicPage(props: {
  section: CourseSection
  subsection: CourseSubsection
  topic: CourseTopic
  doneAt?: number
  bestQuiz?: { best: number; total: number; at: number }
  acronymMap: Map<string, string>
  onBack: () => void
  onToggleDone: () => void
  onStartQuiz: () => void
}) {
  const { t } = useTranslate()
  const { section, subsection, topic, doneAt, bestQuiz, acronymMap, onBack, onToggleDone, onStartQuiz } = props
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
            {topic.quiz.slice(0, 2).map((q, qi) => (
              <div key={q.question} className="miniQ">
                <div className="miniQTitle">
                  {tr(t, courseKeys.quizQuestion(sectionId, subsectionId, topicId, qi), q.question)}
                </div>
                <div className="chips">
                  {q.choices.slice(0, 4).map((c, ci) => (
                    <span key={c} className="chip">
                      {tr(t, courseKeys.quizChoice(sectionId, subsectionId, topicId, qi, ci), c)}
                    </span>
                  ))}
                </div>
                <div className="muted small">
                  {t('topicPage.answer')}: {tr(t, courseKeys.quizCorrectAnswer(sectionId, subsectionId, topicId, qi), q.correctAnswer)}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function AcronymsPage({ entries }: { entries: AcronymEntry[] }) {
  const { t } = useTranslate()
  const [q, setQ] = useState('')
  const qq = normalize(q)
  const filtered = useMemo(() => {
    const list = entries.slice().sort((a, b) => a.acronym.localeCompare(b.acronym))
    if (!qq) return list.slice(0, 250)
    return list.filter((e) => normalize(e.acronym).includes(qq) || normalize(e.spelledOut).includes(qq)).slice(0, 250)
  }, [entries, qq])

  return (
    <div className="stack">
      <section className="heroCard small">
        <div className="heroGlow" aria-hidden="true" />
        <div className="heroInner">
          <div className="heroKicker">{t('acronyms.kicker')}</div>
          <h1 className="heroTitle">{t('acronyms.title')}</h1>
          <p className="heroSubtitle">{t('acronyms.subtitle')}</p>
        </div>
      </section>

      <section className="panel">
        <div className="searchRow">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('acronyms.placeholder')} aria-label={t('acronyms.searchLabel')} />
          <button className="btnSecondary" onClick={() => setQ('')} disabled={!q}>
            {t('search.clear')}
          </button>
        </div>
      </section>

      <section className="grid">
        {filtered.map((e) => (
          <button
            key={`${e.acronym}::${e.spelledOut}`}
            className="topicCard"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${e.acronym} — ${e.spelledOut}`)
              } catch {
                // ignore
              }
            }}
          >
            <div className="topicTop">
              <div className="topicTitle">{e.acronym}</div>
              <div className="pill">{t('acronyms.copy')}</div>
            </div>
            <div className="muted">{e.spelledOut}</div>
          </button>
        ))}
      </section>
    </div>
  )
}

