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

const ENDPOINT = 'https://www.dentons.com/DentonsServices/DentonsPeopleSearch.asmx/SearchResultData'

function buildDataParam(opts: { keywords?: string; names?: string; alpha?: string; page: string }) {
  const parts = ['sectorid=', 'practiceid=', 'positionid=', 'languageid=', 'inpid=', 'countryid=']
  if (opts.keywords) parts.push(`Keywords=${opts.keywords}`)
  if (opts.names) parts.push(`NAMES=${opts.names}`)
  if (opts.alpha) parts.push(`ALPHA=${opts.alpha}`)
  parts.push(`page=${opts.page}`)
  return parts.join(':')
}

async function fetchFromDentons(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: DENTONS_HEADERS,
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API returned ${response.status}: ${errorText.substring(0, 100)}`)
  }

  const responseText = await response.text()
  if (responseText.startsWith('H4sI')) {
    const decompressed = gunzipSync(Buffer.from(responseText, 'base64'))
    return JSON.parse(decompressed.toString('utf-8'))
  }
  return JSON.parse(responseText)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const keywords = searchParams.get('keywords') || ''
  const names = searchParams.get('names') || ''
  const alpha = searchParams.get('alpha') || ''
  const pageNumber = searchParams.get('pageNumber') || '1'
  const pageSize = searchParams.get('pageSize') || '20'
  const contextLanguage = searchParams.get('contextLanguage') || 'en'
  const contextSite = searchParams.get('contextSite') || 'dentons'

  const hasSearch = keywords || names || alpha

  try {
    let apiUrl: string

    if (hasSearch) {
      const data = buildDataParam({ keywords, names, alpha, page: pageNumber })
      apiUrl = `${ENDPOINT}?data=${data}&contextLanguage=${contextLanguage}&contextSite=${contextSite}&pageNumber=${pageNumber}&pageSize=${pageSize}`
    } else {
      apiUrl = `${ENDPOINT}?data=&contextLanguage=${contextLanguage}&contextSite=${contextSite}&pageNumber=${pageNumber}&pageSize=${pageSize}`
    }

    const result = await fetchFromDentons(apiUrl)

    if (Array.isArray(result) && result.length > 0) {
      return NextResponse.json(result[0])
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in API route:', error)
    return NextResponse.json(
      { error: 'Failed to fetch from Dentons API', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
