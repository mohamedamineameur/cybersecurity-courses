import { useEffect, useState } from 'react'
import type {
  AcronymsData,
  CourseData,
  CourseItem,
  CourseQuiz,
  CourseSection,
  CourseTopic,
  CourseSubsection,
  FlatTopicEntry,
  MockExamQuestion,
  MockExamState,
  QuizExtraManifest,
  QuizStoredState,
  Route,
  SavedMockExamSession,
  TopicLookup,
} from './types'

export const MOCK_EXAM_QUESTION_COUNT = 90
export const MOCK_EXAM_DURATION_MS = 90 * 60 * 1000

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function topicKey(subsectionId: string, topicId: string) {
  return `${subsectionId}::${topicId}`
}

function mockExamQuestionKey(subsectionId: string, topicId: string, questionIndex: number) {
  return `${subsectionId}::${topicId}::${questionIndex}`
}

function savedMockExamId(seed: string, startedAt: number) {
  return `${startedAt}::${seed}`
}

export function normalizeQuizAnswers(answers: Array<string | null> | undefined, total: number) {
  return Array.from({ length: total }, (_, i) => answers?.[i] ?? null)
}

export function computeQuizScore(quiz: CourseQuiz[], answers: Array<string | null>) {
  return quiz.reduce((sum, q, idx) => sum + (answers[idx] === q.correctAnswer ? 1 : 0), 0)
}

export function computeMockExamScore(
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

export function areQuizStatesEqual(a: QuizStoredState | undefined, b: QuizStoredState | undefined) {
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

export function areMockExamStatesEqual(a: MockExamState | null | undefined, b: MockExamState | null | undefined) {
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

export function toSavedMockExamSession(state: MockExamState | null | undefined): SavedMockExamSession | null {
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

export function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

export function buildMockExamPool(topics: FlatTopicEntry[]) {
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

export function buildMockExamQuestions(pool: MockExamQuestion[], targetCount: number, seed: string) {
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
    const key = topicKey(q.subsectionId, q.topicId)
    bySection.set(q.sectionId, [...(bySection.get(q.sectionId) ?? []), q])
    bySubsection.set(q.subsectionId, [...(bySubsection.get(q.subsectionId) ?? []), q])
    byTopic.set(key, [...(byTopic.get(key) ?? []), q])
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

export function getHashRoute(): Route {
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

export function setHashRoute(r: Route) {
  if (r.name === 'home') window.location.hash = ''
  if (r.name === 'quizzes') window.location.hash = '#quizzes'
  if (r.name === 'exam') window.location.hash = '#exam'
  if (r.name === 'acronyms') window.location.hash = '#acronyms'
  if (r.name === 'topic') window.location.hash = `#topic/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`
  if (r.name === 'quiz') window.location.hash = `#quiz/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => getHashRoute())
  useEffect(() => {
    const onHash = () => setRoute(getHashRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return route
}

export function useLocalStorageState<T>(key: string, initial: T) {
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

  const liftedSections = course.sections.map((section) => {
    const nextSubsections: CourseSubsection[] = []

    for (const ss of section.subsections) {
      const keptTopics: CourseTopic[] = []
      const liftedHere: CourseSubsection[] = []

      for (const topic of ss.topics) {
        if (looksLikeEmbeddedSubsection(topic)) liftedHere.push({ id: topic.id, title: topic.title, topics: topic.topics })
        else keptTopics.push(topic)
      }

      if (keptTopics.length) nextSubsections.push({ id: ss.id, title: ss.title, topics: keptTopics })
      nextSubsections.push(...liftedHere)
    }

    return { ...section, subsections: nextSubsections }
  })

  const section10 = liftedSections.find((section) => section.id === '1.0')
  if (!section10) return { ...course, sections: liftedSections }

  const movedSubsections: CourseSubsection[] = []
  const keptTopSections: CourseSection[] = []

  for (const section of liftedSections) {
    const isSubsectionOf10 = typeof section.id === 'string' && /^1\.\d+$/.test(section.id) && section.id !== '1.0'
    const topicsAny = (section as unknown as { topics?: CourseTopic[] }).topics
    if (isSubsectionOf10 && Array.isArray(topicsAny)) {
      movedSubsections.push({ id: section.id, title: section.title, topics: topicsAny })
    } else {
      keptTopSections.push(section)
    }
  }

  if (movedSubsections.length === 0) return { ...course, sections: keptTopSections }

  const fixedSections = keptTopSections.map((section) => {
    if (section.id !== '1.0') return section
    const existing = new Set(section.subsections.map((ss) => ss.id))
    const merged = [...section.subsections, ...movedSubsections.filter((ss) => !existing.has(ss.id))]
    return { ...section, subsections: merged }
  })

  return { ...course, sections: fixedSections }
}

async function fetchJsonIfOk<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return (await response.json()) as T
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
  const all = await Promise.all(files.map(async (file) => ({ file, data: await fetchJsonIfOk<Record<string, CourseQuiz[]>>(`/data/${file}`) })))
  const merged: Record<string, CourseQuiz[]> = {}

  for (const { file, data } of all) {
    if (!data) continue
    for (const [key, quiz] of Object.entries(data)) {
      const qualifiedKey = qualifyExtraKey(file, key)
      merged[qualifiedKey] = (merged[qualifiedKey] ?? []).concat(quiz)
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

        const seen = new Set(topic.quiz.map((quiz) => `${quiz.question}::${quiz.correctAnswer}`))

        for (const quiz of extraQuiz) {
          const signature = `${quiz.question}::${quiz.correctAnswer}`
          if (seen.has(signature)) continue
          if (!quiz.choices?.length || !quiz.choices.includes(quiz.correctAnswer)) continue

          topic.quiz.push(quiz)
          seen.add(signature)
        }

        if (topic.quiz.length > targetPerTopic) topic.quiz = topic.quiz.slice(0, targetPerTopic)
      }
    }
  }
  return course
}

export function useCourseData() {
  const [data, setData] = useState<CourseData | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/data/course.json').then((response) => response.json() as Promise<CourseData>),
      fetch('/data/acronyms.json').then((response) => response.json() as Promise<AcronymsData>),
      loadQuizExtras(),
    ])
      .then(([course, acronyms, extras]) => {
        if (cancelled) return

        const normalized = normalizeCourseShape(course)
        setData(mergeQuizExtras(normalized, extras, 10))
        ;(window as unknown as { __acronyms?: AcronymsData }).__acronyms = acronyms
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setErr(error instanceof Error ? error.message : String(error))
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, err }
}

export function getAcronyms(): AcronymsData | null {
  const windowWithAcronyms = window as unknown as { __acronyms?: AcronymsData }
  return windowWithAcronyms.__acronyms ?? null
}

export function findTopic(course: CourseData, subsectionId: string, topicId: string): TopicLookup | null {
  for (const section of course.sections) {
    for (const sub of section.subsections) {
      if (sub.id !== subsectionId) continue
      const topic = sub.topics.find((entry) => entry.id === topicId)
      if (topic) return { section, sub, topic }
    }
  }
  return null
}

export function topicText(topic: CourseTopic) {
  const parts: string[] = []
  parts.push(topic.title)
  if (topic.content) parts.push(topic.content)

  const walk = (item: CourseItem) => {
    if (item.title) parts.push(item.title)
    if (item.name) parts.push(item.name)
    if (item.description) parts.push(item.description)
    if (item.content) parts.push(item.content)
    if (item.examples?.length) parts.push(item.examples.join(' '))
    item.items?.forEach(walk)
  }

  topic.items?.forEach(walk)

  if (topic.subtopics?.length) {
    for (const subtopic of topic.subtopics) {
      parts.push(subtopic.title)
      subtopic.items?.forEach(walk)
    }
  }

  if (topic.quiz?.length) {
    parts.push(topic.quiz.map((quiz) => `${quiz.question} ${quiz.choices.join(' ')} ${quiz.correctAnswer} ${quiz.explanation ?? ''}`).join(' '))
  }

  return normalize(parts.join(' '))
}

function InlineAcronym({ short, expanded }: { short: string; expanded: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={['acronymWrap', open ? 'open' : ''].join(' ')}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
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
        onClick={() => setOpen((value) => !value)}
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

export function formatInline(text: string, acronymMap: Map<string, string>) {
  const words = text.split(/(\b)/)
  return words.map((word, idx) => {
    const key = word.toUpperCase()
    const expanded = acronymMap.get(key)
    if (!expanded) return <span key={idx}>{word}</span>
    return <InlineAcronym key={idx} short={word} expanded={expanded} />
  })
}

export function tr(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key)
  return translated === key ? fallback : translated
}
