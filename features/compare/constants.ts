import type { Service, CountData, CompareStateOnly, EventsData } from './types'

export const DOMAINS = [
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

export const SERVICE_META: Record<Service, { label: string; iconPath: string; color: string }> = {
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

export const initialCountData: CountData = { count: null, loading: false, error: null }

export const initialCompareState: CompareStateOnly = { compare: null, comparing: false, compareError: null }

export function createInitialServiceCompare(): Record<Service, CompareStateOnly> {
  return {
    insights: { ...initialCompareState },
    people: { ...initialCompareState },
    news: { ...initialCompareState },
  }
}

export const initialEventsData: EventsData = { count: null, events: [], loading: false, error: null }
