'use client'

import { useEffect, useState, useCallback } from 'react'

interface ServerData {
  label: string
  server: string
  url: string
  count: number | null
  loading: boolean
  error: string | null
}

interface DiffItem {
  heading: string
  date: string
  link: string
}

interface CompareResult {
  nacd1Total: number
  eucd1Total: number
  difference: number
  onlyInNacd1: DiffItem[]
  onlyInEucd1: DiffItem[]
  pagesScanned: number
  itemsScanned: number
  complete: boolean
}

const SERVERS: Omit<ServerData, 'count' | 'loading' | 'error'>[] = [
  { label: 'NACD1', server: 'nacd1', url: 's10-nacd1.dentons.com' },
  { label: 'EUCD1', server: 'eucd1', url: 's10-eucd1.dentons.com' },
]

function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-[#7B1FA2] ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function NewsPage() {
  const [data, setData] = useState<ServerData[]>(
    SERVERS.map(s => ({ ...s, count: null, loading: true, error: null }))
  )
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  useEffect(() => {
    SERVERS.forEach((s, i) => {
      fetch(`/api/news/s10?server=${s.server}&pageSize=1`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
        .then(json => {
          if (json.error) throw new Error(json.message)
          setData(prev => prev.map((d, idx) =>
            idx === i ? { ...d, count: json.totalResult ?? 0, loading: false } : d
          ))
        })
        .catch(err => {
          setData(prev => prev.map((d, idx) =>
            idx === i ? { ...d, error: (err as Error).message, loading: false } : d
          ))
        })
    })
  }, [])

  const countsReady = data.every(d => !d.loading && d.count !== null)
  const hasDifference = countsReady && data[0].count !== data[1].count
  const diff = countsReady ? (data[0].count ?? 0) - (data[1].count ?? 0) : 0

  const runCompare = useCallback(async () => {
    setComparing(true)
    setCompareError(null)
    setCompareResult(null)
    try {
      const res = await fetch('/api/news/compare?batchSize=100&maxPages=150')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.message)
      setCompareResult(json)
    } catch (err) {
      setCompareError((err as Error).message)
    } finally {
      setComparing(false)
    }
  }, [])

  useEffect(() => {
    if (hasDifference && !compareResult && !comparing) runCompare()
  }, [hasDifference, compareResult, comparing, runCompare])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="py-2 text-xs text-gray-400">
            <a href="/insights" className="hover:text-white">Dashboard</a>
            <span className="mx-1">&gt;</span><span>News</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light pb-4 sm:pb-6 italic font-serif">
            News — NACD1 vs EUCD1
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Count cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl mx-auto">
          {data.map(s => (
            <div
              key={s.server}
              className="bg-white border border-gray-200 rounded-xl p-6 sm:p-8 flex flex-col items-center gap-2 hover:shadow-lg transition-shadow"
            >
              <p className="text-xs uppercase tracking-widest text-gray-400 font-medium">{s.label}</p>
              <p className="text-[10px] text-gray-400 mb-1">{s.url}</p>
              {s.loading ? (
                <Spinner className="h-8 w-8 my-3" />
              ) : s.error ? (
                <p className="text-red-500 text-sm text-center my-3">{s.error}</p>
              ) : (
                <p className="text-5xl sm:text-6xl font-bold text-[#7B1FA2]">
                  {s.count?.toLocaleString()}
                </p>
              )}
              <p className="text-sm text-gray-500 font-medium mt-1">Total Results</p>
            </div>
          ))}
        </div>

        {/* Comparison */}
        {countsReady && (
          <div className="mt-8">
            {!hasDifference ? (
              <div className="text-center border border-green-200 bg-green-50 rounded-xl p-6">
                <div className="inline-flex items-center gap-2 text-green-700 font-medium text-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Counts Match
                </div>
                <p className="text-green-600 text-sm mt-1">
                  Both servers have {data[0].count?.toLocaleString()} news results.
                </p>
              </div>
            ) : (
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-6">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <div className="flex items-center gap-2 text-amber-700 font-medium text-lg">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Count Mismatch: {Math.abs(diff)} item{Math.abs(diff) > 1 ? 's' : ''}
                  </div>
                  <span className="text-sm text-amber-600">
                    {diff > 0 ? 'NACD1' : 'EUCD1'} has {Math.abs(diff)} more
                  </span>
                </div>

                {comparing && (
                  <div className="flex items-center gap-3 text-amber-700 py-4">
                    <Spinner className="h-5 w-5" />
                    <span className="text-sm">Comparing news items to find the difference...</span>
                  </div>
                )}

                {compareError && (
                  <div className="text-red-600 text-sm py-2">
                    Comparison failed: {compareError}
                    <button onClick={runCompare} className="ml-2 underline hover:no-underline">Retry</button>
                  </div>
                )}

                {compareResult && (
                  <div className="space-y-4 mt-2">
                    <p className="text-xs text-amber-600">
                      Scanned {compareResult.itemsScanned?.toLocaleString()} items
                      {!compareResult.complete && ' (partial scan)'}
                    </p>

                    {compareResult.onlyInNacd1.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">
                          Only in NACD1 ({compareResult.onlyInNacd1.length})
                        </h3>
                        <div className="space-y-2">
                          {compareResult.onlyInNacd1.map((item, i) => (
                            <div key={i} className="bg-white border border-amber-200 rounded-lg p-3">
                              <p className="font-medium text-sm text-gray-900">{item.heading}</p>
                              <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                              <a href={item.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[#7B1FA2] hover:underline mt-1 block break-all"
                              >{item.link}</a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {compareResult.onlyInEucd1.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">
                          Only in EUCD1 ({compareResult.onlyInEucd1.length})
                        </h3>
                        <div className="space-y-2">
                          {compareResult.onlyInEucd1.map((item, i) => (
                            <div key={i} className="bg-white border border-amber-200 rounded-lg p-3">
                              <p className="font-medium text-sm text-gray-900">{item.heading}</p>
                              <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                              <a href={item.link} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[#7B1FA2] hover:underline mt-1 block break-all"
                              >{item.link}</a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {compareResult.onlyInNacd1.length === 0 && compareResult.onlyInEucd1.length === 0 && (
                      <p className="text-sm text-amber-700">
                        No unique items found in scanned range.
                        <button onClick={runCompare} className="ml-2 underline hover:no-underline">Scan again</button>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
