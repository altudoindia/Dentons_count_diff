'use client'

import { useState, useCallback, useRef } from 'react'
import { DOMAINS, initialCountData, initialEventsData, createInitialServiceCompare } from '@/features/compare/constants'
import { SERVICES, type Service, type CountData, type CompareStateOnly, type ServiceState, type EventsData } from '@/features/compare/types'
import { ServiceCard } from '@/features/compare/components/ServiceCard'
import { EmptyJobTitleBiosSection } from '@/features/compare/components/EmptyJobTitleBiosSection'
import { EventsSection } from '@/features/compare/components/EventsSection'

export default function HomePage() {
  const [leftDomain, setLeftDomain] = useState(DOMAINS[0])
  const [rightDomain, setRightDomain] = useState(DOMAINS[3])
  const [started, setStarted] = useState(false)

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
      setInsightsLeft(loadingData); setPeopleLeft(loadingData); setNewsLeft(loadingData)
    } else {
      setInsightsRight(loadingData); setPeopleRight(loadingData); setNewsRight(loadingData)
    }

    try {
      const url = `/api/batch-counts?domain=${encodeURIComponent(domain)}&_=${runId}`
      const res = await fetch(url, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      if (compareRunIdRef.current !== runId) return
      if (json.domain !== domain) return

      const insightsData: CountData = { count: json.insights?.count ?? null, loading: false, error: json.insights?.error ?? null }
      const peopleData: CountData = { count: json.people?.count ?? null, loading: false, error: json.people?.error ?? null }
      const newsData: CountData = { count: json.news?.count ?? null, loading: false, error: json.news?.error ?? null }

      if (side === 'left') {
        setInsightsLeft(insightsData); setPeopleLeft(peopleData); setNewsLeft(newsData)
      } else {
        setInsightsRight(insightsData); setPeopleRight(peopleData); setNewsRight(newsData)
      }
    } catch (err) {
      if (compareRunIdRef.current !== runId) return
      const errData: CountData = { count: null, loading: false, error: (err as Error).message }
      if (side === 'left') {
        setInsightsLeft(errData); setPeopleLeft(errData); setNewsLeft(errData)
      } else {
        setInsightsRight(errData); setPeopleRight(errData); setNewsRight(errData)
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
    setInsightsLeft(reset); setInsightsRight(reset)
    setPeopleLeft(reset); setPeopleRight(reset)
    setNewsLeft(reset); setNewsRight(reset)
    setServiceCompare(createInitialServiceCompare())
    setUpcomingLeft({ ...initialEventsData }); setUpcomingRight({ ...initialEventsData })
    setPastLeft({ ...initialEventsData }); setPastRight({ ...initialEventsData })

    compareRunIdRef.current = Date.now()
    const runId = compareRunIdRef.current
    ;(async () => {
      await fetchBatchCounts(leftDomain, 'left', runId)
      await fetchBatchCounts(rightDomain, 'right', runId)
      await Promise.all([
        fetchEvents(leftDomain, 'upcoming', setUpcomingLeft),
        fetchEvents(rightDomain, 'upcoming', setUpcomingRight),
      ])
      await Promise.all([
        fetchEvents(leftDomain, 'past', setPastLeft),
        fetchEvents(rightDomain, 'past', setPastRight),
      ])
    })()
  }

  const getServiceState = useCallback((svc: Service): ServiceState => {
    const left = svc === 'insights' ? insightsLeft : svc === 'people' ? peopleLeft : newsLeft
    const right = svc === 'insights' ? insightsRight : svc === 'people' ? peopleRight : newsRight
    return { left, right, compare: serviceCompare[svc].compare, comparing: serviceCompare[svc].comparing, compareError: serviceCompare[svc].compareError }
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
            Count Differences
          </h1>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Left Server</label>
              <select value={leftDomain} onChange={e => setLeftDomain(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#7B1FA2] focus:border-[#7B1FA2] outline-none">
                {DOMAINS.map(d => <option key={d} value={d}>https://{d}</option>)}
              </select>
            </div>
            <div className="hidden sm:flex items-center justify-center pb-1">
              <span className="text-gray-400 font-bold text-lg">vs</span>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-gray-500 mb-1">Right Server</label>
              <select value={rightDomain} onChange={e => setRightDomain(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-[#7B1FA2] focus:border-[#7B1FA2] outline-none">
                {DOMAINS.map(d => <option key={d} value={d}>https://{d}</option>)}
              </select>
            </div>
            <button onClick={handleCompare} disabled={leftDomain === rightDomain} className="px-6 py-2.5 bg-[#7B1FA2] text-white rounded-lg text-sm font-medium hover:bg-[#6A1B9A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
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
              <ServiceCard key={svc} svc={svc} state={getServiceState(svc)} leftLabel={leftLabel} rightLabel={rightLabel} leftDomain={leftDomain} rightDomain={rightDomain} onCompare={runCompare} />
            ))}
          </div>
          <EmptyJobTitleBiosSection leftDomain={leftDomain} rightDomain={rightDomain} leftLabel={leftLabel} rightLabel={rightLabel} />
          <EventsSection title="Upcoming Events" iconColor="bg-amber-100 text-amber-600" leftData={upcomingLeft} rightData={upcomingRight} leftLabel={leftLabel} rightLabel={rightLabel} leftDomain={leftDomain} rightDomain={rightDomain} />
          <EventsSection title="Past Events" iconColor="bg-gray-200 text-gray-600" leftData={pastLeft} rightData={pastRight} leftLabel={leftLabel} rightLabel={rightLabel} leftDomain={leftDomain} rightDomain={rightDomain} />
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
