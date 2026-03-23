const CACHE_VERSION = 'security-plus-v3'
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, '')

function withBase(path) {
  if (!path.startsWith('/')) return path
  return `${BASE_PATH}${path}` || path
}

const APP_SHELL = [
  withBase('/'),
  withBase('/index.html'),
  withBase('/manifest.webmanifest'),
  withBase('/favicon.svg'),
  withBase('/apple-touch-icon.png'),
  withBase('/pwa-192.png'),
  withBase('/pwa-512.png'),
]

const CORE_DATA_FILES = [
  withBase('/data/course.json'),
  withBase('/data/acronyms.json'),
  withBase('/data/course-quiz-extras.json'),
]

function unique(values) {
  return Array.from(new Set(values))
}

function isCacheableResponse(response) {
  return response.ok || response.type === 'opaque'
}

function normalizeUrlPath(value) {
  const url = new URL(value, self.location.origin)
  if (url.origin !== self.location.origin) return null
  return `${url.pathname}${url.search}`
}

function extractLocalAssetUrls(html) {
  const matches = html.matchAll(/(?:src|href)=["']([^"']+)["']/g)
  const urls = []

  for (const match of matches) {
    const raw = match[1]
    if (!raw || raw.startsWith('http:') || raw.startsWith('https:') || raw.startsWith('data:')) continue
    const normalized = normalizeUrlPath(raw)
    if (!normalized) continue
    if (
      normalized.startsWith(withBase('/assets/'))
      || normalized.startsWith(withBase('/data/'))
      || normalized === withBase('/favicon.svg')
    ) {
      urls.push(normalized)
    }
  }

  return unique(urls)
}

async function getDataFiles() {
  try {
    const response = await fetch(withBase('/data/course-quiz-extras.json'), { cache: 'no-store' })
    if (!response.ok) return CORE_DATA_FILES

    const manifest = await response.json()
    const extraFiles = Array.isArray(manifest?.files)
      ? manifest.files.map((name) => withBase(`/data/${name}`))
      : []

    return unique([...CORE_DATA_FILES, ...extraFiles])
  } catch {
    return CORE_DATA_FILES
  }
}

async function putInCache(cache, request, response) {
  if (!isCacheableResponse(response)) return response
  await cache.put(request, response.clone())
  return response
}

async function precacheApp() {
  const cache = await caches.open(CACHE_VERSION)
  const indexUrl = withBase('/index.html')
  const htmlResponse = await fetch(indexUrl, { cache: 'no-store' })
  const htmlText = await htmlResponse.text()
  const dataFiles = await getDataFiles()

  await cache.put(indexUrl, new Response(htmlText, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }))

  const assetFiles = extractLocalAssetUrls(htmlText)
  const urlsToCache = unique([...APP_SHELL, ...dataFiles, ...assetFiles])

  await Promise.all(urlsToCache.map(async (url) => {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (!isCacheableResponse(response)) return
      await cache.put(url, response)
    } catch {
      // Ignore install-time fetch failures for individual files.
    }
  }))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApp())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION)
      try {
        const response = await fetch(request)
        return await putInCache(cache, withBase('/index.html'), response)
      } catch {
        const cached = await cache.match(withBase('/index.html'))
        return cached || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION)
    const cached = await cache.match(request)
    if (cached) return cached

    try {
      const response = await fetch(request)
      return await putInCache(cache, request, response)
    } catch {
      const fallback = await cache.match(url.pathname)
      return fallback || Response.error()
    }
  })())
})
