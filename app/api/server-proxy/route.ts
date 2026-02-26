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

const FETCH_TIMEOUT = 15_000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const domain = searchParams.get('domain') || ''
  const service = searchParams.get('service') || ''
  const data = searchParams.get('data') || ''
  const pageNumber = searchParams.get('pageNumber') || '1'
  const pageSize = searchParams.get('pageSize') || '10'
  const contextLanguage = searchParams.get('contextLanguage') || 'en'
  const contextSite = searchParams.get('contextSite') || 'dentons'

  if (!ALLOWED_DOMAINS.has(domain)) {
    return NextResponse.json({ error: `Domain not allowed: ${domain}` }, { status: 400 })
  }

  const servicePath = SERVICE_PATHS[service]
  if (!servicePath) {
    return NextResponse.json({ error: `Unknown service: ${service}. Use: insights, people, news` }, { status: 400 })
  }

  // When deployed on Vercel (no VPN), forward to a proxy that has VPN access to Dentons URLs
  const proxyBase = process.env.DENTONS_PROXY_URL
  if (proxyBase) {
    try {
      const proxyUrl = `${proxyBase.replace(/\/$/, '')}/api/server-proxy?${searchParams.toString()}`
      const res = await fetch(proxyUrl, { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT + 5_000), headers: { 'ngrok-skip-browser-warning': 'true' } })
      const data = await res.json()
      const headers: HeadersInit = res.ok ? { 'Cache-Control': 'no-store, no-cache, must-revalidate' } : {}
      return NextResponse.json(data, { status: res.status, headers })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json(
        { error: 'Failed to fetch', message: msg.includes('abort') ? `Timeout` : msg },
        { status: 502 }
      )
    }
  }

  const apiUrl = `https://${domain}${servicePath}?data=${data}&contextLanguage=${contextLanguage}&contextSite=${contextSite}&pageNumber=${pageNumber}&pageSize=${pageSize}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: DENTONS_HEADERS,
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timer)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API returned ${response.status}: ${errorText.substring(0, 200)}`)
    }

    const responseText = await response.text()
    let parsed
    if (responseText.startsWith('H4sI')) {
      parsed = JSON.parse(gunzipSync(Buffer.from(responseText, 'base64')).toString('utf-8'))
    } else {
      parsed = JSON.parse(responseText)
    }

    const result = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (error) {
    clearTimeout(timer)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    const isTimeout = msg.includes('abort')
    return NextResponse.json(
      { error: 'Failed to fetch', message: isTimeout ? `Timeout after ${FETCH_TIMEOUT / 1000}s` : msg },
      { status: isTimeout ? 504 : 500 }
    )
  }
}
