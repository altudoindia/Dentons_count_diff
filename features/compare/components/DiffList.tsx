'use client'

import { memo } from 'react'
import type { DiffItem, Service } from '../types'

export const DiffList = memo(function DiffList({ label, items, service }: { label: string; items: DiffItem[]; service: Service }) {
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
