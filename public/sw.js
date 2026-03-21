const CACHE_VERSION = 'security-plus-v2'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/pwa-192.png',
  '/pwa-512.png',
]

const DATA_FILES = [
  '/data/course.json',
  '/data/acronyms.json',
  '/data/course-quiz-extras.json',
  '/data/course-quiz-extra-1.1.json',
  '/data/course-quiz-extra-1.2.json',
  '/data/course-quiz-extra-2.1.json',
  '/data/course-quiz-extra-2.2.json',
  '/data/course-quiz-extra-2.3.json',
  '/data/course-quiz-extra-2.4.json',
  '/data/course-quiz-extra-2.5.json',
  '/data/course-quiz-extra-3.1.json',
  '/data/course-quiz-extra-3.2.json',
  '/data/course-quiz-extra-3.3.json',
  '/data/course-quiz-extra-3.4.json',
  '/data/course-quiz-extra-4.1.json',
  '/data/course-quiz-extra-4.2.json',
  '/data/course-quiz-extra-4.3.json',
  '/data/course-quiz-extra-4.4.json',
  '/data/course-quiz-extra-4.5.json',
  '/data/course-quiz-extra-4.6.json',
  '/data/course-quiz-extra-4.7.json',
  '/data/course-quiz-extra-4.8.json',
  '/data/course-quiz-extra-4.9.json',
  '/data/course-quiz-extra-5.1.json',
  '/data/course-quiz-extra-5.2.json',
  '/data/course-quiz-extra-5.3.json',
  '/data/course-quiz-extra-5.4.json',
  '/data/course-quiz-extra-5.5.json',
  '/data/course-quiz-extra-5.6.json',
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
    if (normalized.startsWith('/assets/') || normalized.startsWith('/data/') || normalized === '/favicon.svg') {
      urls.push(normalized)
    }
  }

  return unique(urls)
}

async function putInCache(cache, request, response) {
  if (!isCacheableResponse(response)) return response
  await cache.put(request, response.clone())
  return response
}

async function precacheApp() {
  const cache = await caches.open(CACHE_VERSION)
  const htmlResponse = await fetch('/index.html', { cache: 'no-store' })
  const htmlText = await htmlResponse.text()

  await cache.put('/index.html', new Response(htmlText, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  }))

  const assetFiles = extractLocalAssetUrls(htmlText)
  const urlsToCache = unique([...APP_SHELL, ...DATA_FILES, ...assetFiles])

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
        return await putInCache(cache, '/index.html', response)
      } catch {
        const cached = await cache.match('/index.html')
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
