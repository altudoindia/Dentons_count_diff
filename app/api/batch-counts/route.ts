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

const SERVICE_PATHS: Record<string, string> = {
  insights: '/DentonsServices/DentonsInsightSearch.asmx/InsightSearchData',
  people: '/DentonsServices/DentonsPeopleSearch.asmx/SearchResultData',
  news: '/DentonsServices/DentonsNewsSearch.asmx/NewsSearchData',
}

const ALLOWED_DOMAINS = new Set([
  'www.dentons.com', 's10-www.dentons.com', 'www.preview.dentons.com',
  's10-nacd1.dentons.com', 's10-eucd1.dentons.com', 's10-nacd2.dentons.com',
  's10-pg.dentons.com', 'uat-www.dentons.com', 'uat-www.preview.dentons.com',
  'uat-nacd1.dentons.com', 'uat-eucd1.dentons.com',
])

const SERVICES = ['insights', 'people', 'news'] as const

async function fetchCount(domain: string, service: string): Promise<{ service: string; count: number | null; error: string | null }> {
  const servicePath = SERVICE_PATHS[service]
  if (!servicePath) return { service, count: null, error: 'Unknown service' }

  const url = `https://${domain}${servicePath}?data=&contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)

  try {
    const res = await fetch(url, { method: 'GET', headers: DENTONS_HEADERS, cache: 'no-store', signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    let parsed
    if (text.startsWith('H4sI')) {
      parsed = JSON.parse(gunzipSync(Buffer.from(text, 'base64')).toString('utf-8'))
    } else {
      parsed = JSON.parse(text)
    }
    const data = Array.isArray(parsed) ? parsed[0] : parsed
    return { service, count: data.totalResult ?? 0, error: null }
  } catch (err) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { service, count: null, error: msg.includes('abort') ? 'Timeout' : msg }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain') || ''

  if (!ALLOWED_DOMAINS.has(domain)) {
    return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
  }

  // When deployed on Vercel (no VPN), forward to a proxy that has VPN access to Dentons URLs
  const proxyBase = process.env.DENTONS_PROXY_URL
  if (proxyBase) {
    try {
      const proxyUrl = `${proxyBase.replace(/\/$/, '')}/api/batch-counts?${searchParams.toString()}`
      const res = await fetch(proxyUrl, { cache: 'no-store', signal: AbortSignal.timeout(25_000), headers: { 'ngrok-skip-browser-warning': 'true' } })
      const data = await res.json()
      return NextResponse.json(data, {
        status: res.status,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
      })
    } catch (err) {
      console.error('Proxy fetch failed:', err)
      return NextResponse.json(
        { error: 'Proxy unreachable', domain, insights: { count: null, error: 'Proxy unreachable' }, people: { count: null, error: 'Proxy unreachable' }, news: { count: null, error: 'Proxy unreachable' } },
        { status: 502 }
      )
    }
  }

  // Fetch sequentially and assign directly to the correct key so insights/news can never get swapped
  const insightsResult = await fetchCount(domain, 'insights')
  const peopleResult = await fetchCount(domain, 'people')
  const newsResult = await fetchCount(domain, 'news')

  const payload = {
    domain,
    insights: { count: insightsResult.count, error: insightsResult.error },
    people: { count: peopleResult.count, error: peopleResult.error },
    news: { count: newsResult.count, error: newsResult.error },
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}
