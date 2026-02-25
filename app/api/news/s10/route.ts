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
  nacd1: 'https://s10-nacd1.dentons.com/DentonsServices/DentonsNewsSearch.asmx/NewsSearchData',
  eucd1: 'https://s10-eucd1.dentons.com/DentonsServices/DentonsNewsSearch.asmx/NewsSearchData',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const server = searchParams.get('server') || 'nacd1'
  const data = searchParams.get('data') || ''
  const pageNumber = searchParams.get('pageNumber') || '1'
  const pageSize = searchParams.get('pageSize') || '10'
  const contextLanguage = searchParams.get('contextLanguage') || 'en'
  const contextSite = searchParams.get('contextSite') || 'dentons'

  const endpoint = SERVERS[server]
  if (!endpoint) {
    return NextResponse.json({ error: `Unknown server: ${server}` }, { status: 400 })
  }

  const apiUrl = `${endpoint}?data=${data}&contextLanguage=${contextLanguage}&contextSite=${contextSite}&pageNumber=${pageNumber}&pageSize=${pageSize}`

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: DENTONS_HEADERS,
      cache: 'no-store',
    })

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

    if (Array.isArray(parsed) && parsed.length > 0) {
      return NextResponse.json(parsed[0])
    }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error(`Error fetching news from ${server}:`, error)
    return NextResponse.json(
      { error: `Failed to fetch from ${server}`, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
