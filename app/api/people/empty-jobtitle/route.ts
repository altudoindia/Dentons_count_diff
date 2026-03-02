import { NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'

export const dynamic = 'force-dynamic'

const DENTONS_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.dentons.com/en/find-a-lawyer',
  'Origin': 'https://www.dentons.com',
}

const PEOPLE_PATH = '/DentonsServices/DentonsPeopleSearch.asmx/SearchResultData'
const ALLOWED_DOMAINS = new Set([
  'www.dentons.com', 's10-www.dentons.com', 'www.preview.dentons.com',
  's10-nacd1.dentons.com', 's10-eucd1.dentons.com', 's10-nacd2.dentons.com',
  's10-pg.dentons.com', 'uat-www.dentons.com', 'uat-www.preview.dentons.com',
  'uat-nacd1.dentons.com', 'uat-eucd1.dentons.com',
])

const PAGE_SIZE = 100
const FETCH_TIMEOUT = 20_000

interface PersonItem {
  firstName?: string
  lastName?: string | null
  jobTitle?: string | null
  link?: string
  officeDetails?: string
}

function isEmptyJobTitle(v: string | null | undefined): boolean {
  return v === '' || v === null || v === undefined
}

async function fetchPage(domain: string, page: number): Promise<{ totalResult: number; persons: PersonItem[] }> {
  const url = `https://${domain}${PEOPLE_PATH}?data=&contextLanguage=en&contextSite=dentons&pageNumber=${page}&pageSize=${PAGE_SIZE}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    const res = await fetch(url, { method: 'GET', headers: DENTONS_HEADERS, cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    let parsed: unknown
    if (text.startsWith('H4sI')) {
      parsed = JSON.parse(gunzipSync(Buffer.from(text, 'base64')).toString('utf-8'))
    } else {
      parsed = JSON.parse(text)
    }
    const data = Array.isArray(parsed) ? (parsed as Record<string, unknown>[])[0] : (parsed as Record<string, unknown>)
    const totalResult = (data?.totalResult as number) ?? 0
    const persons = (data?.persons as PersonItem[]) ?? []
    return { totalResult, persons }
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain') || ''

  if (!ALLOWED_DOMAINS.has(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  const proxyBase = process.env.DENTONS_PROXY_URL
  if (proxyBase) {
    try {
      const proxyUrl = `${proxyBase.replace(/\/$/, '')}/api/people/empty-jobtitle?${searchParams.toString()}`
      const res = await fetch(proxyUrl, { cache: 'no-store', signal: AbortSignal.timeout(120_000), headers: { 'ngrok-skip-browser-warning': 'true' } })
      const data = await res.json()
      return NextResponse.json(data, {
        status: res.status,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      })
    } catch (err) {
      console.error('Proxy fetch failed:', err)
      return NextResponse.json({ error: 'Proxy unreachable', domain, items: [], count: 0 }, { status: 502 })
    }
  }

  try {
    const { totalResult, persons: firstPagePersons } = await fetchPage(domain, 1)
    const emptyJobTitleItems: PersonItem[] = (firstPagePersons || []).filter(p => isEmptyJobTitle(p.jobTitle))

    const totalPages = Math.ceil(totalResult / PAGE_SIZE)
    for (let page = 2; page <= totalPages; page++) {
      const { persons } = await fetchPage(domain, page)
      for (const p of persons || []) {
        if (isEmptyJobTitle(p.jobTitle)) emptyJobTitleItems.push(p)
      }
    }

    const items = emptyJobTitleItems.map(p => ({
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      jobTitle: p.jobTitle ?? '',
      link: p.link ?? '',
      officeDetails: p.officeDetails ?? '',
    }))

    return NextResponse.json(
      { domain, items, count: items.length },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (err) {
    console.error('Empty jobTitle fetch failed:', err)
    return NextResponse.json(
      { error: 'Failed to fetch', message: err instanceof Error ? err.message : 'Unknown error', domain, items: [], count: 0 },
      { status: 500 }
    )
  }
}
