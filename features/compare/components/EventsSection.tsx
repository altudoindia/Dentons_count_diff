'use client'

import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { normalizePath } from '@/lib/utils'
import type { EventsData } from '../types'

export function EventsSection({
  title, iconColor, leftData, rightData, leftLabel, rightLabel, leftDomain, rightDomain,
}: {
  title: string
  iconColor: string
  leftData: EventsData
  rightData: EventsData
  leftLabel: string
  rightLabel: string
  leftDomain: string
  rightDomain: string
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
