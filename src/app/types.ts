export type AcronymEntry = {
  acronym: string
  spelledOut: string
}

export type CourseQuiz = {
  question: string
  choices: string[]
  correctAnswer: string
  explanation?: string
}

export type CourseItem = {
  id: string
  name?: string
  title?: string
  description?: string
  content?: string
  examples?: string[]
  items?: CourseItem[]
}

export type CourseTopic = {
  id: string
  title: string
  content?: string
  items?: CourseItem[]
  subtopics?: Array<{ id: string; title: string; items?: CourseItem[] }>
  quiz?: CourseQuiz[]
}

export type CourseSubsection = {
  id: string
  title: string
  topics: CourseTopic[]
}

export type CourseSection = {
  id: string
  title: string
  subsections: CourseSubsection[]
}

export type CourseData = {
  domain: string
  version: string
  sections: CourseSection[]
}

export type AcronymsData = {
  entries: AcronymEntry[]
}

export type QuizExtraManifest = {
  files: string[]
}

export type QuizStoredState = {
  draftAnswers: Array<string | null>
  draftIdx: number
  total: number
  lastCompletedAnswers?: Array<string | null>
  lastCompletedScore?: number
  lastCompletedAt?: number
}

export type FlatTopicEntry = {
  section: CourseSection
  sub: CourseSubsection
  topic: CourseTopic
  text: string
}

export type MockExamQuestion = {
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

export type MockExamState = {
  seed: string
  startedAt: number
  endsAt: number
  idx: number
  questionIds: string[]
  answers: Array<string | null>
  submittedAt?: number
  score?: number
}

export type SavedMockExamSession = MockExamState & {
  id: string
  submittedAt: number
  score: number
}

export type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type AppLanguage = 'fr' | 'en'

export type TranslateParams = Record<string, string | number | null | undefined>

export type AppI18nContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  t: (key: string, params?: TranslateParams) => string
}

export type Route =
  | { name: 'home' }
  | { name: 'quizzes' }
  | { name: 'exam' }
  | { name: 'topic'; subsectionId: string; topicId: string }
  | { name: 'quiz'; subsectionId: string; topicId: string }
  | { name: 'acronyms' }

export type TopicLookup = {
  section: CourseSection
  sub: CourseSubsection
  topic: CourseTopic
}
