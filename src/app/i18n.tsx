import { createContext, useContext } from 'react'
import enMessages from '../i18n/en.json'
import frMessages from '../i18n/fr.json'
import courseStringsData from '../i18n/course-strings.json'
import type { AppI18nContextValue, AppLanguage, TranslateParams } from './types'

const uiMessages = { fr: frMessages, en: enMessages } as const
const courseStringMessages: Partial<Record<AppLanguage, Record<string, string>>> = {
  en: (courseStringsData as { en?: Record<string, string> }).en ?? {},
}

export const AppI18nContext = createContext<AppI18nContextValue | null>(null)

export function normalizeLanguage(value: string | null | undefined): AppLanguage {
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

export function createTranslator(language: AppLanguage) {
  return (key: string, params?: TranslateParams) => {
    const message =
      getNestedMessage(uiMessages[language], key) ??
      courseStringMessages[language]?.[key] ??
      key

    return interpolateMessage(message, params)
  }
}

export function useAppI18n() {
  const ctx = useContext(AppI18nContext)
  if (!ctx) throw new Error('AppI18nContext is missing')
  return ctx
}

export function useTranslate() {
  const { t } = useAppI18n()
  return { t }
}
