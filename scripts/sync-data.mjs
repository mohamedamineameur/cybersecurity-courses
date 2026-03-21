import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const projectRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(projectRoot, '..')

const sources = [
  { external: path.join(workspaceRoot, 'course.json'), to: path.join(projectRoot, 'public', 'data', 'course.json') },
  { external: path.join(workspaceRoot, 'acronyms.json'), to: path.join(projectRoot, 'public', 'data', 'acronyms.json') },
]

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

await mkdir(path.join(projectRoot, 'public', 'data'), { recursive: true })

for (const { external, to } of sources) {
  const sourcePath = (await exists(external)) ? external : to

  if (!(await exists(sourcePath))) {
    throw new Error(`Missing required data file: ${path.relative(projectRoot, to)}`)
  }

  if (sourcePath !== to) {
    const data = await readFile(sourcePath, 'utf8')
    await writeFile(to, data, 'utf8')
  }
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

