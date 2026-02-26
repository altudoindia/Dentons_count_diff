'use client'

import { useState, useCallback, useRef, memo } from 'react'

const DOMAINS = [
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
]

const SERVICES = ['insights', 'people', 'news'] as const
type Service = typeof SERVICES[number]

interface CountData {
  count: number | null
  loading: boolean
  error: string | null
}

interface DiffItem {
  heading?: string
  name?: string
  jobTitle?: string
  office?: string
  date?: string
  link: string
  title?: string
}

interface CompareResult {
  total1: number
  total2: number
  difference: number
  onlyIn1: DiffItem[]
  onlyIn2: DiffItem[]
  duplicateHint?: 'left' | 'right' | null
  pagesScanned: number
  itemsScanned: number
  complete: boolean
}

interface ServiceState {
  left: CountData
  right: CountData
  compare: CompareResult | null
  comparing: boolean
  compareError: string | null
}

interface EventItem { title: string; link: string; date: string }
interface EventsData {
  count: number | null
  events: EventItem[]
  loading: boolean
  error: string | null
}

const initialCountData: CountData = { count: null, loading: false, error: null }
const initialServiceState: ServiceState = {
  left: { ...initialCountData },
  right: { ...initialCountData },
  compare: null,
  comparing: false,
  compareError: null,
}

interface CompareStateOnly {
  compare: CompareResult | null
  comparing: boolean
  compareError: string | null
}
const initialCompareState: CompareStateOnly = { compare: null, comparing: false, compareError: null }
function createInitialServiceCompare(): Record<Service, CompareStateOnly> {
  return { insights: { ...initialCompareState }, people: { ...initialCompareState }, news: { ...initialCompareState } }
}

const initialEventsData: EventsData = { count: null, events: [], loading: false, error: null }

const Spinner = memo(function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-[#7B1FA2] ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
})

const SERVICE_META: Record<Service, { label: string; iconPath: string; color: string }> = {
  insights: {
    label: 'Insights',
    color: 'bg-purple-100 text-[#7B1FA2]',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  people: {
    label: 'People / Bio',
    color: 'bg-blue-100 text-blue-600',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  news: {
    label: 'News',
    color: 'bg-emerald-100 text-emerald-600',
    iconPath: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  },
}

function normalizePath(link: string): string {
  return link.replace(/https?:\/\/[^/]+/, '')
}

export default function HomePage() {
  const [leftDomain, setLeftDomain] = useState(DOMAINS[0])
  const [rightDomain, setRightDomain] = useState(DOMAINS[3])
  const [started, setStarted] = useState(false)

  // One state per slot so Insights/News counts can never get mixed (e.g. EUCD news count in insights)
  const [insightsLeft, setInsightsLeft] = useState<CountData>({ ...initialCountData })
  const [insightsRight, setInsightsRight] = useState<CountData>({ ...initialCountData })
  const [peopleLeft, setPeopleLeft] = useState<CountData>({ ...initialCountData })
  const [peopleRight, setPeopleRight] = useState<CountData>({ ...initialCountData })
  const [newsLeft, setNewsLeft] = useState<CountData>({ ...initialCountData })
  const [newsRight, setNewsRight] = useState<CountData>({ ...initialCountData })
  const [serviceCompare, setServiceCompare] = useState<Record<Service, CompareStateOnly>>(createInitialServiceCompare)

  const [upcomingLeft, setUpcomingLeft] = useState<EventsData>({ ...initialEventsData })
  const [upcomingRight, setUpcomingRight] = useState<EventsData>({ ...initialEventsData })
  const [pastLeft, setPastLeft] = useState<EventsData>({ ...initialEventsData })
  const [pastRight, setPastRight] = useState<EventsData>({ ...initialEventsData })
  const compareRunIdRef = useRef(0)

  const updateServiceCompare = useCallback((svc: Service, patch: Partial<CompareStateOnly>) => {
    setServiceCompare(prev => ({ ...prev, [svc]: { ...prev[svc], ...patch } }))
  }, [])

  const fetchBatchCounts = useCallback(async (domain: string, side: 'left' | 'right', runId: number) => {
    const loadingData: CountData = { count: null, loading: true, error: null }
    if (side === 'left') {
      setInsightsLeft(loadingData)
      setPeopleLeft(loadingData)
      setNewsLeft(loadingData)
    } else {
      setInsightsRight(loadingData)
      setPeopleRight(loadingData)
      setNewsRight(loadingData)
    }

    try {
      const url = `/api/batch-counts?domain=${encodeURIComponent(domain)}&_=${runId}`
      const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (compareRunIdRef.current !== runId) return
      if (json.domain !== domain) return

      // Read each key once into its own variable so no mix-up possible
      const insightsCount = json.insights?.count ?? null
      const peopleCount = json.people?.count ?? null
      const newsCount = json.news?.count ?? null
      const insightsErr = json.insights?.error ?? null
      const peopleErr = json.people?.error ?? null
      const newsErr = json.news?.error ?? null

      const insightsData: CountData = { count: insightsCount, loading: false, error: insightsErr }
      const peopleData: CountData = { count: peopleCount, loading: false, error: peopleErr }
      const newsData: CountData = { count: newsCount, loading: false, error: newsErr }

      if (side === 'left') {
        setInsightsLeft(insightsData)
        setPeopleLeft(peopleData)
        setNewsLeft(newsData)
      } else {
        setInsightsRight(insightsData)
        setPeopleRight(peopleData)
        setNewsRight(newsData)
      }
    } catch (err) {
      if (compareRunIdRef.current !== runId) return
      const msg = (err as Error).message
      const errData: CountData = { count: null, loading: false, error: msg }
      if (side === 'left') {
        setInsightsLeft(errData)
        setPeopleLeft(errData)
        setNewsLeft(errData)
      } else {
        setInsightsRight(errData)
        setPeopleRight(errData)
        setNewsRight(errData)
      }
    }
  }, [])

  const fetchEvents = useCallback(async (domain: string, type: string, setter: (d: EventsData) => void) => {
    setter({ count: null, events: [], loading: true, error: null })
    try {
      const url = `/api/events?domain=${domain}&type=${type}&_=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.message)
      setter({ count: json.totalResult ?? 0, events: json.events ?? [], loading: false, error: null })
    } catch (err) {
      setter({ count: null, events: [], loading: false, error: (err as Error).message })
    }
  }, [])

  const runCompare = useCallback(async (service: Service) => {
    updateServiceCompare(service, { comparing: true, compareError: null, compare: null })
    try {
      const url = `/api/server-compare?domain1=${encodeURIComponent(leftDomain)}&domain2=${encodeURIComponent(rightDomain)}&service=${service}&_=${Date.now()}`
      const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.message)
      updateServiceCompare(service, { compare: json, comparing: false })
    } catch (err) {
      updateServiceCompare(service, { compareError: (err as Error).message, comparing: false })
    }
  }, [leftDomain, rightDomain, updateServiceCompare])

  const handleCompare = () => {
    if (leftDomain === rightDomain) return
    setStarted(true)

    const reset: CountData = { ...initialCountData }
    setInsightsLeft(reset)
    setInsightsRight(reset)
    setPeopleLeft(reset)
    setPeopleRight(reset)
    setNewsLeft(reset)
    setNewsRight(reset)
    setServiceCompare(createInitialServiceCompare())
    setUpcomingLeft({ ...initialEventsData })
    setUpcomingRight({ ...initialEventsData })
    setPastLeft({ ...initialEventsData })
    setPastRight({ ...initialEventsData })

    compareRunIdRef.current = Date.now()
    const runId = compareRunIdRef.current
    ;(async () => {
      await fetchBatchCounts(leftDomain, 'left', runId)
      await fetchBatchCounts(rightDomain, 'right', runId)
    })()

    fetchEvents(leftDomain, 'upcoming', setUpcomingLeft)
    fetchEvents(rightDomain, 'upcoming', setUpcomingRight)
    fetchEvents(leftDomain, 'past', setPastLeft)
    fetchEvents(rightDomain, 'past', setPastRight)
  }

  // Build per-service state from the 6 separate count states so ServiceCard API stays the same
  const getServiceState = useCallback((svc: Service): ServiceState => {
    const left = svc === 'insights' ? insightsLeft : svc === 'people' ? peopleLeft : newsLeft
    const right = svc === 'insights' ? insightsRight : svc === 'people' ? peopleRight : newsRight
    return {
      left,
      right,
      compare: serviceCompare[svc].compare,
      comparing: serviceCompare[svc].comparing,
      compareError: serviceCompare[svc].compareError,
    }
  }, [insightsLeft, insightsRight, peopleLeft, peopleRight, newsLeft, newsRight, serviceCompare])

  const shortName = (domain: string) => {
    const parts = domain.replace('.dentons.com', '').split('.')
    return parts[parts.length - 1].toUpperCase()
  }

  const leftLabel = shortName(leftDomain)
  const rightLabel = shortName(rightDomain)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
         
          <h1 className="text-2xl sm:text-3xl font-light pb-4 sm:pb-6 italic font-serif">
           Count Defferences
          </h1>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Left Server</label>
              <select
                value={leftDomain}
                onChange={e => setLeftDomain(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#7B1FA2] focus:border-[#7B1FA2] outline-none"
              >
                {DOMAINS.map(d => <option key={d} value={d}>https://{d}</option>)}
              </select>
            </div>
            <div className="hidden sm:flex items-center justify-center pb-1">
              <span className="text-gray-400 font-bold text-lg">vs</span>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Right Server</label>
              <select
                value={rightDomain}
                onChange={e => setRightDomain(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#7B1FA2] focus:border-[#7B1FA2] outline-none"
              >
                {DOMAINS.map(d => <option key={d} value={d}>https://{d}</option>)}
              </select>
            </div>
            <button
              onClick={handleCompare}
              disabled={leftDomain === rightDomain}
              className="px-6 py-2.5 bg-[#7B1FA2] text-white rounded-lg text-sm font-medium hover:bg-[#6A1B9A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              Compare
            </button>
          </div>
          {leftDomain === rightDomain && (
            <p className="text-xs text-amber-600 mt-2">Select two different servers to compare.</p>
          )}
        </div>
      </div>

      {started && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {SERVICES.map(svc => (
              <ServiceCard
                key={svc}
                svc={svc}
                state={getServiceState(svc)}
                leftLabel={leftLabel}
                rightLabel={rightLabel}
                leftDomain={leftDomain}
                rightDomain={rightDomain}
                onCompare={runCompare}
              />
            ))}
          </div>

          <EventsSection
            title="Upcoming Events"
            iconColor="bg-amber-100 text-amber-600"
            leftData={upcomingLeft}
            rightData={upcomingRight}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
            leftDomain={leftDomain}
            rightDomain={rightDomain}
          />
          <EventsSection
            title="Past Events"
            iconColor="bg-gray-200 text-gray-600"
            leftData={pastLeft}
            rightData={pastRight}
            leftLabel={leftLabel}
            rightLabel={rightLabel}
            leftDomain={leftDomain}
            rightDomain={rightDomain}
          />
        </div>
      )}

      {!started && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="text-gray-300 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
          </div>
          <p className="text-gray-500 text-lg font-medium">Select two servers and click Compare</p>
          <p className="text-gray-400 text-sm mt-1">Compares Insights, People/Bio, News & Events between servers</p>
        </div>
      )}
    </div>
  )
}

const ServiceCard = memo(function ServiceCard({
  svc, state: s, leftLabel, rightLabel, leftDomain, rightDomain, onCompare,
}: {
  svc: Service
  state: ServiceState
  leftLabel: string
  rightLabel: string
  leftDomain: string
  rightDomain: string
  onCompare: (svc: Service) => void
}) {
  const meta = SERVICE_META[svc]
  const countsReady = s.left.count !== null && s.right.count !== null && !s.left.loading && !s.right.loading
  const hasDiff = countsReady && s.left.count !== s.right.count
  const diff = (s.left.count ?? 0) - (s.right.count ?? 0)

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${meta.color}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={meta.iconPath} /></svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900">{meta.label}</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {([
          { data: s.left, label: leftLabel, domain: leftDomain },
          { data: s.right, label: rightLabel, domain: rightDomain },
        ] as const).map(({ data, label, domain }, i) => (
          <div key={i === 0 ? 'left' : 'right'} className="border border-gray-100 rounded-xl p-4 flex flex-col items-center gap-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">{label}</p>
            <p className="text-[9px] text-gray-300 mb-1 truncate max-w-full">{domain}</p>
            {data.loading ? <Spinner className="h-6 w-6 my-2" />
              : data.error ? <p className="text-red-500 text-[10px] text-center my-2 leading-tight">{data.error}</p>
              : data.count !== null ? <p className="text-3xl font-bold text-[#7B1FA2]">{data.count.toLocaleString()}</p>
              : null}
            <p className="text-[10px] text-gray-400">Total</p>
          </div>
        ))}
            </div>

      {countsReady && (
        <div className="mt-4">
          {!hasDiff ? (
            <div className="text-center border border-green-200 bg-green-50 rounded-lg p-3">
              <div className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Counts Match
              </div>
            </div>
          ) : (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-amber-700 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {Math.abs(diff)} diff
                </span>
                <span className="text-[10px] text-amber-600">
                  {diff > 0 ? leftLabel : rightLabel} has {Math.abs(diff)} more
                </span>
              </div>

              {!s.compare && !s.comparing && !s.compareError && (
                <button
                  onClick={() => onCompare(svc)}
                  className="mt-3 w-full py-2 px-4 bg-[#7B1FA2] text-white text-xs font-medium rounded-lg hover:bg-[#6A1B9A] transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Find Differences
                </button>
              )}

              {s.comparing && (
                <div className="flex items-center gap-2 text-amber-700 py-2 mt-2">
                  <Spinner className="h-4 w-4" /><span className="text-xs">Finding differences...</span>
                </div>
              )}

              {s.compareError && (
                <div className="text-red-600 text-xs py-1 mt-2">{s.compareError}</div>
              )}

              {s.compare && (
                <div className="space-y-2 mt-3">
                  <p className="text-[10px] text-amber-500">
                    Scanned {s.compare.itemsScanned?.toLocaleString()} items across {s.compare.pagesScanned} pages
                  </p>
                  {(() => {
                    const d = s.compare!.difference
                    const n = Math.abs(d)
                    const onlyIn1 = s.compare!.onlyIn1
                    const onlyIn2 = s.compare!.onlyIn2
                    const showOnlyExtra = n > 0 && (onlyIn1.length > n || onlyIn2.length > n)
                    const leftItems = d > 0 ? onlyIn1.slice(0, n) : []
                    const rightItems = d < 0 ? onlyIn2.slice(0, n) : []
                    return (
                      <>
                        {showOnlyExtra && (
                          <p className="text-[10px] text-amber-600">
                            Showing the {n} item(s) that explain the count difference (extra on {d > 0 ? leftLabel : rightLabel}).
                          </p>
                        )}
                        {s.compare!.duplicateHint && (
                          <p className="text-[10px] text-amber-600">
                            Count difference is from duplicate link(s) on {s.compare!.duplicateHint === 'left' ? leftLabel : rightLabel} (same URL counted more than once). Showing one example below.
                          </p>
                        )}
                        <DiffList label={`Only in ${leftLabel}${d > 0 && onlyIn1.length > n ? ` (showing ${n} of ${onlyIn1.length})` : ''}`} items={leftItems} service={svc} />
                        <DiffList label={`Only in ${rightLabel}${d < 0 && onlyIn2.length > n ? ` (showing ${n} of ${onlyIn2.length})` : ''}`} items={rightItems} service={svc} />
                        {onlyIn1.length === 0 && onlyIn2.length === 0 && (
                          <p className="text-xs text-amber-700">
                            {s.compare!.itemsScanned === 0
                              ? 'Items could not be loaded. Click Find Differences again to retry.'
                              : s.compare!.duplicateHint
                                ? `Count differs by ${n} but the extra item could not be listed (may be duplicate or missing link).`
                                : `All ${s.compare!.itemsScanned.toLocaleString()} scanned items match; difference may be in ordering or unsynced data.`}
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
                  </div>
                )}
    </section>
  )
})

const DiffList = memo(function DiffList({ label, items, service }: { label: string; items: DiffItem[]; service: Service }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 mb-1">{label} ({items.length})</h4>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="bg-white border border-amber-200 rounded-md p-2">
            {service === 'people' ? (
              <>
                <p className="font-medium text-xs text-gray-900">{item.name}</p>
                {item.jobTitle && <p className="text-[10px] text-gray-500">{item.jobTitle}</p>}
                {item.office && <p className="text-[10px] text-gray-400">{item.office}</p>}
              </>
            ) : (
              <>
                <p className="font-medium text-xs text-gray-900">{item.heading}</p>
                {item.date && <p className="text-[10px] text-gray-500">{item.date}</p>}
              </>
            )}
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#7B1FA2] hover:underline mt-0.5 block break-all">{item.link}</a>
          </div>
        ))}
      </div>
    </div>
  )
})

function EventsSection({
  title, iconColor, leftData, rightData, leftLabel, rightLabel, leftDomain, rightDomain,
}: {
  title: string; iconColor: string; leftData: EventsData; rightData: EventsData
  leftLabel: string; rightLabel: string; leftDomain: string; rightDomain: string
}) {
  const [showDiff, setShowDiff] = useState(false)

  const ready = !leftData.loading && !rightData.loading && leftData.count !== null && rightData.count !== null
  const diff = (leftData.count ?? 0) - (rightData.count ?? 0)
  const hasDiff = ready && diff !== 0

  const onlyLeft = showDiff
    ? leftData.events.filter(e => !rightData.events.some(r => normalizePath(r.link) === normalizePath(e.link)))
    : []
  const onlyRight = showDiff
    ? rightData.events.filter(e => !leftData.events.some(l => normalizePath(l.link) === normalizePath(e.link)))
    : []

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        {([
          { data: leftData, label: leftLabel, domain: leftDomain },
          { data: rightData, label: rightLabel, domain: rightDomain },
        ] as const).map(({ data, label, domain }, i) => (
          <div key={i === 0 ? 'left' : 'right'} className="border border-gray-100 rounded-xl p-4 flex flex-col items-center gap-1">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">{label}</p>
            <p className="text-[9px] text-gray-300 mb-1 truncate max-w-full">{domain}</p>
            {data.loading ? <Spinner className="h-6 w-6 my-2" />
              : data.error ? <p className="text-red-500 text-[10px] text-center my-2 leading-tight">{data.error}</p>
              : data.count !== null ? <p className="text-3xl font-bold text-[#7B1FA2]">{data.count.toLocaleString()}</p>
              : null}
            <p className="text-[10px] text-gray-400">Total</p>
          </div>
        ))}
      </div>

      {ready && (
        <div className="mt-4">
          {!hasDiff ? (
            <div className="text-center border border-green-200 bg-green-50 rounded-lg p-3 max-w-md">
              <div className="inline-flex items-center gap-1.5 text-green-700 text-sm font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Counts Match
              </div>
            </div>
          ) : (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 max-w-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-amber-700 text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {Math.abs(diff)} count diff
                </span>
                <span className="text-[10px] text-amber-600">
                  {diff > 0 ? leftLabel : rightLabel} has {Math.abs(diff)} more
                </span>
    </div>

              {!showDiff && (
          <button
                  onClick={() => setShowDiff(true)}
                  className="mt-3 w-full py-2 px-4 bg-[#7B1FA2] text-white text-xs font-medium rounded-lg hover:bg-[#6A1B9A] transition-colors flex items-center justify-center gap-2"
          >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Find Differences
          </button>
              )}

              {showDiff && (
                <div className="space-y-2 mt-3">
                  <p className="text-[10px] text-amber-500">Compared {leftData.events.length + rightData.events.length} events from first page</p>
                  {onlyLeft.length > 0 && (
                <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Only in {leftLabel} ({onlyLeft.length})</h4>
                      <div className="space-y-1.5">
                        {onlyLeft.map((item, i) => (
                          <div key={i} className="bg-white border border-amber-200 rounded-md p-2">
                            <p className="font-medium text-xs text-gray-900">{item.title}</p>
                            {item.date && <p className="text-[10px] text-gray-500">{item.date}</p>}
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#7B1FA2] hover:underline mt-0.5 block break-all">{item.link}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                  {onlyRight.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Only in {rightLabel} ({onlyRight.length})</h4>
                      <div className="space-y-1.5">
                        {onlyRight.map((item, i) => (
                          <div key={i} className="bg-white border border-amber-200 rounded-md p-2">
                            <p className="font-medium text-xs text-gray-900">{item.title}</p>
                            {item.date && <p className="text-[10px] text-gray-500">{item.date}</p>}
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#7B1FA2] hover:underline mt-0.5 block break-all">{item.link}</a>
            </div>
                  ))}
                </div>
              </div>
            )}
                  {onlyLeft.length === 0 && onlyRight.length === 0 && (
                    <p className="text-xs text-amber-700">Count differs but first-page events match. Difference may be in later pages.</p>
                  )}
          </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
