import { NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'

const DENTONS_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://www.dentons.com/en',
  'Origin': 'https://www.dentons.com',
}

const SERVERS: Record<string, string> = {
  nacd1: 'https://s10-nacd1.dentons.com/DentonsServices/DentonsInsightSearch.asmx/InsightSearchData',
  eucd1: 'https://s10-eucd1.dentons.com/DentonsServices/DentonsInsightSearch.asmx/InsightSearchData',
}

interface InsightItem {
  heading: string
  date: string
  link: string
  details: string
  imageUrl?: string
}

function normalizePath(link: string): string {
  return link.replace(/https?:\/\/[^/]+/, '')
}

async function fetchPage(endpoint: string, page: number, size: number): Promise<{ totalResult: number; tabData: InsightItem[] }> {
  const url = `${endpoint}?data=&contextLanguage=en&contextSite=dentons&pageNumber=${page}&pageSize=${size}`
  const res = await fetch(url, { method: 'GET', headers: DENTONS_HEADERS, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  let parsed
  if (text.startsWith('H4sI')) {
    parsed = JSON.parse(gunzipSync(Buffer.from(text, 'base64')).toString('utf-8'))
  } else {
    parsed = JSON.parse(text)
  }
  return Array.isArray(parsed) ? parsed[0] : parsed
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const batchSize = Math.min(parseInt(searchParams.get('batchSize') || '100'), 200)
  const maxPages = Math.min(parseInt(searchParams.get('maxPages') || '120'), 200)

  try {
    const [nacd1First, eucd1First] = await Promise.all([
      fetchPage(SERVERS.nacd1, 1, 1),
      fetchPage(SERVERS.eucd1, 1, 1),
    ])

    const nacd1Total = nacd1First.totalResult
    const eucd1Total = eucd1First.totalResult
    const diff = nacd1Total - eucd1Total

    if (diff === 0) {
      return NextResponse.json({
        nacd1Total,
        eucd1Total,
        difference: 0,
        onlyInNacd1: [],
        onlyInEucd1: [],
        pagesScanned: 0,
        complete: true,
      })
    }

    const nacd1Links = new Map<string, InsightItem>()
    const eucd1Links = new Map<string, InsightItem>()

    const totalPages = Math.min(
      Math.ceil(Math.max(nacd1Total, eucd1Total) / batchSize),
      maxPages
    )

    for (let page = 1; page <= totalPages; page++) {
      const [nData, eData] = await Promise.all([
        fetchPage(SERVERS.nacd1, page, batchSize),
        fetchPage(SERVERS.eucd1, page, batchSize),
      ])

      for (const item of nData.tabData || []) {
        nacd1Links.set(normalizePath(item.link), item)
      }
      for (const item of eData.tabData || []) {
        eucd1Links.set(normalizePath(item.link), item)
      }

      const onlyInN: InsightItem[] = []
      const onlyInE: InsightItem[] = []
      for (const [path, item] of nacd1Links) {
        if (!eucd1Links.has(path)) onlyInN.push(item)
      }
      for (const [path, item] of eucd1Links) {
        if (!nacd1Links.has(path)) onlyInE.push(item)
      }

      const foundDiff = onlyInN.length - onlyInE.length
      if (foundDiff === diff && onlyInN.length + onlyInE.length > 0) {
        return NextResponse.json({
          nacd1Total,
          eucd1Total,
          difference: diff,
          onlyInNacd1: onlyInN.map(i => ({ heading: i.heading, date: i.date, link: i.link })),
          onlyInEucd1: onlyInE.map(i => ({ heading: i.heading, date: i.date, link: i.link })),
          pagesScanned: page,
          itemsScanned: page * batchSize,
          complete: true,
        })
      }
    }

    const onlyInN: InsightItem[] = []
    const onlyInE: InsightItem[] = []
    for (const [path, item] of nacd1Links) {
      if (!eucd1Links.has(path)) onlyInN.push(item)
    }
    for (const [path, item] of eucd1Links) {
      if (!nacd1Links.has(path)) onlyInE.push(item)
    }

    return NextResponse.json({
      nacd1Total,
      eucd1Total,
      difference: diff,
      onlyInNacd1: onlyInN.map(i => ({ heading: i.heading, date: i.date, link: i.link })),
      onlyInEucd1: onlyInE.map(i => ({ heading: i.heading, date: i.date, link: i.link })),
      pagesScanned: totalPages,
      itemsScanned: totalPages * batchSize,
      complete: false,
    })
  } catch (error) {
    console.error('Compare error:', error)
    return NextResponse.json(
      { error: 'Comparison failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
