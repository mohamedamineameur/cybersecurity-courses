#!/usr/bin/env node
/**
 * Extrait toutes les chaînes de course.json et génère un fichier pour import Tolgee.
 * Usage: node scripts/extract-course-to-tolgee.mjs
 *
 * Optionnel: TOLGEE_API_KEY et TOLGEE_PROJECT_ID pour push direct via API.
 * Sinon: importe manuellement le fichier généré dans Tolgee (Import).
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COURSE_PATH = path.resolve(__dirname, '../../course.json')
const OUTPUT_PATH = path.resolve(__dirname, '../src/i18n/course-strings.json')

function sanitizeId(id) {
  return String(id).replace(/\./g, '_').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function collectStrings(obj, prefix, out) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => collectStrings(item, `${prefix}.${i}`, out))
    return
  }
  if (typeof obj === 'string') {
    if (obj.trim().length > 0) out[prefix] = obj
    return
  }

  for (const [k, v] of Object.entries(obj)) {
    const key = k === 'id' ? sanitizeId(v) : k
    const nextPrefix = k === 'id' ? prefix : `${prefix}.${key}`

    if (typeof v === 'string') {
      if (v.trim().length > 0) out[nextPrefix] = v
    } else if (Array.isArray(v)) {
      if (k === 'choices' || k === 'examples') {
        v.forEach((s, i) => {
          if (typeof s === 'string' && s.trim()) out[`${nextPrefix}.${i}`] = s
        })
      } else {
        collectStrings(v, nextPrefix, out)
      }
    } else if (v && typeof v === 'object') {
      collectStrings(v, nextPrefix, out)
    }
  }
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

async function main() {
  const raw = await readFile(COURSE_PATH, 'utf8')
  const course = JSON.parse(raw)

  const strings = walkCourse(course)
  const count = Object.keys(strings).length

  const out = { en: strings }
  await writeFile(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8')

  console.log(`[extract-course-to-tolgee] OK: ${count} clés extraites dans src/i18n/course-strings.json`)
  console.log('')
  console.log('Prochaine étape:')
  console.log('1. Crée un projet sur https://app.tolgee.io')
  console.log('2. Tolgee > Import > Upload course-strings.json')
  console.log('3. Ajoute la langue FR (ou autre) et lance Auto-translate')
  console.log('4. Exporte ou configure ton app avec API key (VITE_TOLGEE_API_KEY)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
