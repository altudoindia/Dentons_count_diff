import { NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'

const DENTONS_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.dentons.com/en/find-a-lawyer',
  'Origin': 'https://www.dentons.com',
}

const SERVICE_PATHS: Record<string, string> = {
  insights: '/DentonsServices/DentonsInsightSearch.asmx/InsightSearchData',
  people: '/DentonsServices/DentonsPeopleSearch.asmx/SearchResultData',
  news: '/DentonsServices/DentonsNewsSearch.asmx/NewsSearchData',
}

const ALLOWED_DOMAINS = new Set([
  'www.dentons.com',
  's10-www.dentons.com',
  'www.preview.dentons.com',
  's10-nacd1.dentons.com',
  's10-eucd1.dentons.com',
  's10-nacd2.dentons.com',
  's10-pg.dentons.com',
  'uat-www.dentons.com',
  'uat-www.preview.dentons.com',
  'uat-nacd1.dentons.com',
  'uat-eucd1.dentons.com',
])

interface GenericItem {
  link: string
  heading?: string
  date?: string
  firstName?: string
  lastName?: string
  jobTitle?: string
  officeDetails?: string
  name?: string
}

function normalizePath(link: string): string {
  return link.replace(/https?:\/\/[^/]+/, '')
}

const FETCH_TIMEOUT = 30_000

async function fetchPage(baseUrl: string, page: number, size: number) {
  const url = `${baseUrl}?data=&contextLanguage=en&contextSite=dentons&pageNumber=${page}&pageSize=${size}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: DENTONS_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    let parsed
    if (text.startsWith('H4sI')) {
      parsed = JSON.parse(gunzipSync(Buffer.from(text, 'base64')).toString('utf-8'))
    } else {
      parsed = JSON.parse(text)
    }
    return Array.isArray(parsed) ? parsed[0] : parsed
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

function extractItems(data: Record<string, unknown>, service: string): GenericItem[] {
  if (service === 'people') return (data.persons as GenericItem[]) || []
  if (service === 'news') return (data.NewsData as GenericItem[]) || []
  // Insights: try tabData first, then any array of objects with link
  const tab = data.tabData as GenericItem[] | undefined
  if (Array.isArray(tab) && tab.length > 0) return tab
  const anyArr = Object.values(data).find(v => Array.isArray(v) && (v as GenericItem[])[0]?.link) as GenericItem[] | undefined
  return anyArr || []
}

function formatItem(item: GenericItem, service: string) {
  if (service === 'people') {
    return {
      name: `${item.firstName || ''} ${item.lastName || ''}`.trim(),
      jobTitle: item.jobTitle || '',
      office: item.officeDetails || '',
      link: item.link,
    }
  }
  return {
    heading: item.heading || '',
    date: item.date || '',
    link: item.link,
  }
}

const CONCURRENCY = 15
const PAGE_SIZE = 100
const MAX_RETRIES = 2
const FALLBACK_PAGE_SIZES = [100, 50, 20]

async function fetchPageWithRetry(baseUrl: string, page: number, size: number): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchPage(baseUrl, page, size)
    } catch (err) {
      console.error(`[compare] Page ${page} size ${size} attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err)
      if (attempt === MAX_RETRIES) return null
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
  }
  return null
}

interface FetchResult {
  map: Map<string, GenericItem>
  duplicateSample: GenericItem | null
}

async function fetchAllItemsWithSize(baseUrl: string, total: number, service: string, pageSize: number): Promise<FetchResult> {
  const totalPages = Math.ceil(total / pageSize)
  const map = new Map<string, GenericItem>()
  let duplicateSample: GenericItem | null = null

  for (let batch = 0; batch < totalPages; batch += CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(CONCURRENCY, totalPages - batch) },
      (_, i) => batch + i + 1
    )
    const results = await Promise.all(
      pages.map(p => fetchPageWithRetry(baseUrl, p, pageSize))
    )
    for (const data of results) {
      if (!data) continue
      for (const item of extractItems(data as Record<string, unknown>, service)) {
        if (!item?.link) continue
        const path = normalizePath(item.link)
        if (map.has(path)) duplicateSample = duplicateSample ?? item
        else map.set(path, item)
      }
    }
  }
  return { map, duplicateSample }
}

async function fetchAllItems(baseUrl: string, total: number, service: string): Promise<FetchResult> {
  for (const size of FALLBACK_PAGE_SIZES) {
    const result = await fetchAllItemsWithSize(baseUrl, total, service, size)
    if (result.map.size > 0) {
      console.log(`[compare] Got ${result.map.size} items (pageSize=${size}) from ${baseUrl}`)
      return result
    }
    console.log(`[compare] pageSize=${size} returned 0 items, trying smaller size`)
  }
  console.log(`[compare] All page sizes failed for ${baseUrl}, returning empty`)
  return { map: new Map(), duplicateSample: null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const domain1 = searchParams.get('domain1') || ''
  const domain2 = searchParams.get('domain2') || ''
  const service = searchParams.get('service') || ''

  if (!ALLOWED_DOMAINS.has(domain1) || !ALLOWED_DOMAINS.has(domain2)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }
  const servicePath = SERVICE_PATHS[service]
  if (!servicePath) {
    return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 400 })
  }

  const proxyBase = process.env.DENTONS_PROXY_URL
  if (proxyBase) {
    try {
      const proxyUrl = `${proxyBase.replace(/\/$/, '')}/api/server-compare?${searchParams.toString()}`
      const res = await fetch(proxyUrl, { cache: 'no-store', signal: AbortSignal.timeout(120_000), headers: { 'ngrok-skip-browser-warning': 'true' } })
      const data = await res.json()
      return NextResponse.json(data, {
        status: res.status,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      })
    } catch (err) {
      console.error('Proxy fetch failed:', err)
      return NextResponse.json(
        { error: 'Comparison failed', message: err instanceof Error ? err.message : 'Proxy unreachable' },
        { status: 502 }
      )
    }
  }

  const url1 = `https://${domain1}${servicePath}`
  const url2 = `https://${domain2}${servicePath}`

  try {
    const [first1, first2] = await Promise.all([
      fetchPage(url1, 1, 1),
      fetchPage(url2, 1, 1),
    ])

    const total1 = first1.totalResult as number
    const total2 = first2.totalResult as number
    const diff = total1 - total2

    const [res1, res2] = await Promise.all([
      fetchAllItems(url1, total1, service),
      fetchAllItems(url2, total2, service),
    ])
    const map1 = res1.map
    const map2 = res2.map

    const onlyIn1: GenericItem[] = []
    const onlyIn2: GenericItem[] = []
    for (const [path, item] of map1) { if (!map2.has(path)) onlyIn1.push(item) }
    for (const [path, item] of map2) { if (!map1.has(path)) onlyIn2.push(item) }

    const diffNonZero = diff !== 0
    const noUniqueDiff = onlyIn1.length === 0 && onlyIn2.length === 0
    const duplicateOn1 = diffNonZero && noUniqueDiff && diff > 0 && res1.duplicateSample
    const duplicateOn2 = diffNonZero && noUniqueDiff && diff < 0 && res2.duplicateSample
    const extraFrom1 = duplicateOn1 ? [formatItem(res1.duplicateSample!, service)] : onlyIn1.map(i => formatItem(i, service))
    const extraFrom2 = duplicateOn2 ? [formatItem(res2.duplicateSample!, service)] : onlyIn2.map(i => formatItem(i, service))

    return NextResponse.json(
      {
        total1, total2, difference: diff,
        onlyIn1: extraFrom1,
        onlyIn2: extraFrom2,
        duplicateHint: noUniqueDiff && diff !== 0 ? (diff > 0 ? 'left' : 'right') : null,
        pagesScanned: Math.ceil(total1 / PAGE_SIZE) + Math.ceil(total2 / PAGE_SIZE),
        itemsScanned: map1.size + map2.size,
        complete: true,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error(`Compare ${service} error:`, error)
    return NextResponse.json(
      { error: 'Comparison failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
