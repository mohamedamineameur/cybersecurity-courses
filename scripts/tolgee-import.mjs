#!/usr/bin/env node
/**
 * Parcourt course.json et envoie toutes les chaînes à Tolgee via API.
 * Tolgee fait l'auto-traduction (DeepL, Google, etc.) vers les langues configurées.
 *
 * Usage:
 *   TOLGEE_API_KEY=xxx TOLGEE_PROJECT_ID=123 node scripts/tolgee-import.mjs
 *
 * Variables d'environnement:
 *   TOLGEE_API_KEY   - Token API Tolgee (obligatoire pour push)
 *   TOLGEE_PROJECT_ID - ID du projet Tolgee (obligatoire pour push)
 *   TOLGEE_BASE_URL  - URL Tolgee (défaut: https://app.tolgee.io)
 *
 * Sans API: génère course-strings.json pour import manuel.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COURSE_PATH = path.resolve(__dirname, '../../course.json')
const OUTPUT_PATH = path.resolve(__dirname, '../src/i18n/course-strings.json')

const TOLGEE_BASE = process.env.TOLGEE_BASE_URL || 'https://app.tolgee.io'
const API_KEY = process.env.TOLGEE_API_KEY
const PROJECT_ID = process.env.TOLGEE_PROJECT_ID

function sanitizeId(id) {
  return String(id).replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function walkCourse(course) {
  const out = {}
  const sections = course.sections || []
  for (const s of sections) {
    const sId = sanitizeId(s.id)
    const sPrefix = `course.section.${sId}`

    if (s.title) out[`${sPrefix}.title`] = s.title

    for (const ss of s.subsections || []) {
      const ssId = sanitizeId(ss.id)
      const ssPrefix = `${sPrefix}.subsection.${ssId}`

      if (ss.title) out[`${ssPrefix}.title`] = ss.title

      for (const t of ss.topics || []) {
        const tId = sanitizeId(t.id)
        const tPrefix = `${ssPrefix}.topic.${tId}`

        if (t.title) out[`${tPrefix}.title`] = t.title
        if (t.content) out[`${tPrefix}.content`] = t.content

        for (const it of t.items || []) {
          const itId = sanitizeId(it.id)
          const itPrefix = `${tPrefix}.item.${itId}`
          if (it.name) out[`${itPrefix}.name`] = it.name
          if (it.title) out[`${itPrefix}.title`] = it.title
          if (it.description) out[`${itPrefix}.description`] = it.description
          if (it.content) out[`${itPrefix}.content`] = it.content
          for (let i = 0; i < (it.examples || []).length; i++) {
            out[`${itPrefix}.examples.${i}`] = it.examples[i]
          }
          for (const sub of it.items || []) {
            const subId = sanitizeId(sub.id)
            const subPrefix = `${itPrefix}.item.${subId}`
            if (sub.name) out[`${subPrefix}.name`] = sub.name
            if (sub.title) out[`${subPrefix}.title`] = sub.title
            if (sub.description) out[`${subPrefix}.description`] = sub.description
          }
        }

        if (t.subtopics) {
          for (const st of t.subtopics) {
            const stId = sanitizeId(st.id)
            const stPrefix = `${tPrefix}.subtopic.${stId}`
            if (st.title) out[`${stPrefix}.title`] = st.title
            for (const it of st.items || []) {
              const itId = sanitizeId(it.id)
              if (it.name) out[`${stPrefix}.item.${itId}.name`] = it.name
              if (it.description) out[`${stPrefix}.item.${itId}.description`] = it.description
            }
          }
        }

        for (let i = 0; i < (t.quiz || []).length; i++) {
          const q = t.quiz[i]
          const qPrefix = `${tPrefix}.quiz.${i}`
          if (q.question) out[`${qPrefix}.question`] = q.question
          if (q.correctAnswer) out[`${qPrefix}.correctAnswer`] = q.correctAnswer
          if (q.explanation) out[`${qPrefix}.explanation`] = q.explanation
          for (let j = 0; j < (q.choices || []).length; j++) {
            out[`${qPrefix}.choices.${j}`] = q.choices[j]
          }
        }
      }
    }
  }

  return out
}

async function pushToTolgee(strings) {
  const url = `${TOLGEE_BASE}/v2/projects/${PROJECT_ID}/single-step-import`
  const json = JSON.stringify({ en: strings })
  const blob = new Blob([json], { type: 'application/json' })
  const formData = new FormData()
  formData.append('files', blob, 'course-strings.json')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
    },
    body: formData,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Tolgee API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data
}

async function main() {
  const raw = await readFile(COURSE_PATH, 'utf8')
  const course = JSON.parse(raw)

  const strings = walkCourse(course)
  const count = Object.keys(strings).length

  const out = { en: strings }

  // Toujours écrire le fichier local (backup + import manuel)
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8')

  if (API_KEY && PROJECT_ID) {
    console.log(`[tolgee-import] Envoi de ${count} clés vers Tolgee...`)
    try {
      const result = await pushToTolgee(strings)
      console.log(`[tolgee-import] OK: import réussi`)
      if (result?.result?.inserted) {
        console.log(`  - ${result.result.inserted} clés insérées`)
      }
      if (result?.result?.updated) {
        console.log(`  - ${result.result.updated} clés mises à jour`)
      }
    } catch (e) {
      console.error('[tolgee-import] Erreur API:', e.message)
      console.log('')
      console.log('Vérifie TOLGEE_API_KEY et TOLGEE_PROJECT_ID.')
      console.log('Tu peux importer manuellement: Tolgee > Import > course-strings.json')
      process.exit(1)
    }
  } else {
    console.log(`[tolgee-import] OK: ${count} clés extraites dans src/i18n/course-strings.json`)
    console.log('')
    console.log('Pour push automatique vers Tolgee:')
    console.log('  TOLGEE_API_KEY=xxx TOLGEE_PROJECT_ID=123 node scripts/tolgee-import.mjs')
    console.log('')
    console.log('Ou importe manuellement: Tolgee > Import > course-strings.json')
    console.log('Puis: ajoute FR (ou autre), lance Auto-translate (DeepL/Google).')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
