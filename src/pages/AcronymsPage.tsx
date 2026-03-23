import { useMemo, useState } from 'react'
import { useTranslate } from '../app/i18n'
import { normalize } from '../app/helpers'
import type { AcronymEntry } from '../app/types'

type AcronymsPageProps = {
  entries: AcronymEntry[]
  onCopy: (label: string) => void
}

export function AcronymsPage({ entries, onCopy }: AcronymsPageProps) {
  const { t } = useTranslate()
  const [query, setQuery] = useState('')
  const normalizedQuery = normalize(query)
  const filtered = useMemo(() => {
    const list = entries.slice().sort((a, b) => a.acronym.localeCompare(b.acronym))
    if (!normalizedQuery) return list.slice(0, 250)
    return list.filter((entry) => normalize(entry.acronym).includes(normalizedQuery) || normalize(entry.spelledOut).includes(normalizedQuery)).slice(0, 250)
  }, [entries, normalizedQuery])

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
          <input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('acronyms.placeholder')} aria-label={t('acronyms.searchLabel')} />
          <button className="btnSecondary" onClick={() => setQuery('')} disabled={!query}>
            {t('search.clear')}
          </button>
        </div>
      </section>

      <section className="grid">
        {filtered.map((entry) => (
          <button
            key={`${entry.acronym}::${entry.spelledOut}`}
            className="topicCard"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(`${entry.acronym} — ${entry.spelledOut}`)
                onCopy(entry.acronym)
              } catch {
                // ignore
              }
            }}
          >
            <div className="topicTop">
              <div className="topicTitle">{entry.acronym}</div>
              <div className="pill">{t('acronyms.copy')}</div>
            </div>
            <div className="muted">{entry.spelledOut}</div>
          </button>
        ))}
      </section>
    </div>
  )
}
