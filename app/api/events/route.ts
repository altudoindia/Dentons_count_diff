import { NextResponse } from 'next/server'

const ALLOWED_DOMAINS = new Set([
  'www.dentons.com', 's10-www.dentons.com', 'www.preview.dentons.com',
  's10-nacd1.dentons.com', 's10-eucd1.dentons.com', 's10-nacd2.dentons.com',
  's10-pg.dentons.com', 'uat-www.dentons.com', 'uat-www.preview.dentons.com',
  'uat-nacd1.dentons.com', 'uat-eucd1.dentons.com',
])

const EVENT_PATHS: Record<string, string> = {
  upcoming: '/en/about-dentons/news-events-and-awards/events',
  past: '/en/about-dentons/news-events-and-awards/events/events-archive',
}

const FETCH_TIMEOUT = 15_000

interface EventItem { title: string; link: string; date: string }

function extractEvents(html: string, domain: string, type: string): { totalResult: number; events: EventItem[] } {
  const totalMatch = html.match(/Total Results \((\d+)\)/)
  const totalResult = totalMatch ? parseInt(totalMatch[1], 10) : 0

  const sectionMarker = type === 'upcoming' ? 'Upcoming Events' : 'Past Events'
  const section = html.match(new RegExp(`${sectionMarker}([\\s\\S]*?)EventiCalendar`, 'i'))?.[1]
    || html.match(new RegExp(`${sectionMarker}([\\s\\S]*?)$`, 'i'))?.[1]
    || ''

  const events: EventItem[] = []
  const eventBlocks = section.split(/<h4[\s>]/).slice(1)

  for (const block of eventBlocks) {
    const linkMatch = block.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/)
    if (!linkMatch) continue

    const rawLink = linkMatch[1]
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim()
    if (!title || !rawLink.includes('/events/')) continue

    const link = rawLink.startsWith('http') ? rawLink : `https://${domain}${rawLink}`

    const afterH4 = block.split('</h4>')[1] || ''
    const dateText = afterH4.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\.\s/)[0].substring(0, 100).trim()
    const dateMatch = dateText.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:[-\u2013]\d{1,2})?,?\s*\d{4})/)

    events.push({ title, link, date: dateMatch ? dateMatch[1] : '' })
  }

  return { totalResult, events }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain') || 'www.dentons.com'
  const type = searchParams.get('type') || 'upcoming'

  if (!ALLOWED_DOMAINS.has(domain)) {
    return NextResponse.json({ error: `Domain not allowed: ${domain}` }, { status: 400 })
  }

  const path = EVENT_PATHS[type]
  if (!path) {
    return NextResponse.json({ error: `Unknown type: ${type}. Use: upcoming, past` }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(`https://${domain}${path}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://${domain}/en`,
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timer)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const html = await response.text()
    const result = extractEvents(html, domain, type)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    clearTimeout(timer)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch events', message: msg.includes('abort') ? `Timeout after ${FETCH_TIMEOUT / 1000}s` : msg },
      { status: msg.includes('abort') ? 504 : 500 }
    )
  }
}
