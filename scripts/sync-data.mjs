import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(projectRoot, '..')

const sources = [
  { from: path.join(workspaceRoot, 'course.json'), to: path.join(projectRoot, 'public', 'data', 'course.json') },
  { from: path.join(workspaceRoot, 'acronyms.json'), to: path.join(projectRoot, 'public', 'data', 'acronyms.json') },
]

await mkdir(path.join(projectRoot, 'public', 'data'), { recursive: true })

for (const { from, to } of sources) {
  const data = await readFile(from, 'utf8')
  await writeFile(to, data, 'utf8')
}

const publicDataDir = path.join(projectRoot, 'public', 'data')
const quizExtraFiles = (await readdir(publicDataDir))
  .filter((name) => /^course-quiz-extra-[\d.]+\.json$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

await writeFile(
  path.join(publicDataDir, 'course-quiz-extras.json'),
  `${JSON.stringify({ files: quizExtraFiles }, null, 2)}\n`,
  'utf8'
)

console.log(`[sync-data] OK: course.json + acronyms.json synced, ${quizExtraFiles.length} extra quiz files indexed`)

