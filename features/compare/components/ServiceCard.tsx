'use client'

import { memo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { SERVICE_META } from '../constants'
import type { Service, ServiceState } from '../types'
import { DiffList } from './DiffList'

export const ServiceCard = memo(function ServiceCard({
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
