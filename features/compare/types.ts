export interface CountData {
  count: number | null
  loading: boolean
  error: string | null
}

export interface DiffItem {
  heading?: string
  name?: string
  jobTitle?: string
  office?: string
  date?: string
  link: string
  title?: string
}

export interface CompareResult {
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

export interface ServiceState {
  left: CountData
  right: CountData
  compare: CompareResult | null
  comparing: boolean
  compareError: string | null
}

export interface CompareStateOnly {
  compare: CompareResult | null
  comparing: boolean
  compareError: string | null
}

export interface EmptyJobTitleBio {
  firstName: string
  lastName: string
  jobTitle: string
  link: string
  officeDetails: string
}

export interface EventItem {
  title: string
  link: string
  date: string
}

export interface EventsData {
  count: number | null
  events: EventItem[]
  loading: boolean
  error: string | null
}

export const SERVICES = ['insights', 'people', 'news'] as const
export type Service = typeof SERVICES[number]
