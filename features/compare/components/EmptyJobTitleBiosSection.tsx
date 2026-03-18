'use client'

import { useState, useCallback } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import type { EmptyJobTitleBio } from '../types'

export function EmptyJobTitleBiosSection({
  leftDomain,
  rightDomain,
  leftLabel,
  rightLabel,
}: {
  leftDomain: string
  rightDomain: string
  leftLabel: string
  rightLabel: string
}) {
  const [leftData, setLeftData] = useState<{ items: EmptyJobTitleBio[]; loading: boolean; error: string | null }>({ items: [], loading: false, error: null })
  const [rightData, setRightData] = useState<{ items: EmptyJobTitleBio[]; loading: boolean; error: string | null }>({ items: [], loading: false, error: null })

  const loadEmptyJobTitleBios = useCallback(() => {
    setLeftData(prev => ({ ...prev, loading: true, error: null }))
    setRightData(prev => ({ ...prev, loading: true, error: null }))
    const leftUrl = `/api/people/empty-jobtitle?domain=${encodeURIComponent(leftDomain)}&_=${Date.now()}`
    const rightUrl = `/api/people/empty-jobtitle?domain=${encodeURIComponent(rightDomain)}&_=${Date.now()}`
    fetch(leftUrl, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      .then(r => r.json())
      .then(json => setLeftData({
        items: json.items ?? [],
        loading: false,
        error: json.error ? (json.message || String(json.error)) : null,
      }))
      .catch(err => setLeftData(prev => ({ ...prev, loading: false, error: (err as Error).message })))
    fetch(rightUrl, { cache: 'no-store', headers: { Pragma: 'no-cache', 'Cache-Control': 'no-cache' } })
      .then(r => r.json())
      .then(json => setRightData({
        items: json.items ?? [],
        loading: false,
        error: json.error ? (json.message || String(json.error)) : null,
      }))
      .catch(err => setRightData(prev => ({ ...prev, loading: false, error: (err as Error).message })))
  }, [leftDomain, rightDomain])

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Bios with empty job title</h2>
          <p className="text-xs text-gray-500 mt-0.5">People/Bio items where jobTitle is empty or null</p>
        </div>
        <button
          type="button"
          onClick={loadEmptyJobTitleBios}
          disabled={leftData.loading || rightData.loading}
          className="px-4 py-2 bg-[#7B1FA2] text-white rounded-lg text-sm font-medium hover:bg-[#6A1B9A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {leftData.loading || rightData.loading ? (
            <span className="flex items-center gap-2"><Spinner className="h-4 w-4" /> Loading…</span>
          ) : (
            'Load bios'
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {([
          { data: leftData, label: leftLabel },
          { data: rightData, label: rightLabel },
        ] as const).map(({ data, label }) => (
          <div key={label}>
            <h3 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">{label}</h3>
            {data.error && <p className="text-red-500 text-xs mb-2">{data.error}</p>}
            {data.items.length === 0 && !data.loading && !data.error && (
              <p className="text-gray-400 text-sm">Click &quot;Load bios&quot; to fetch items with empty job title.</p>
            )}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.items.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                  <p className="font-medium text-sm text-gray-900">
                    {[item.firstName, item.lastName].filter(Boolean).join(' ').trim() || '—'}
                  </p>
                  {item.officeDetails && <p className="text-xs text-gray-500 mt-0.5">{item.officeDetails}</p>}
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[#7B1FA2] hover:underline mt-1 block break-all">{item.link}</a>
                </div>
              ))}
            </div>
            {data.items.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">{data.items.length} bio(s) with empty job title</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
