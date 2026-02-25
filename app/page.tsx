'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef, FormEvent, memo } from 'react'
import Image from 'next/image'
import { Person } from '@/types'

const PAGE_SIZE = 20
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

interface ActiveFilter {
  type: 'keyword' | 'alphabet' | 'name'
  label: string
}

function encodeKeyword(keyword: string): string {
  const encoder = new TextEncoder()
  const uint8Array = encoder.encode(keyword)
  const binaryString = String.fromCharCode.apply(null, Array.from(uint8Array))
  const base64 = btoa(binaryString)
  return encodeURI(base64)
}

function updateBrowserUrl(params: { keywords?: string; names?: string; letter?: string }) {
  const url = new URL(window.location.href)
  url.search = ''

  if (params.keywords) url.searchParams.set('Keywords', params.keywords)
  if (params.names) url.searchParams.set('NAMES', params.names)
  if (params.letter) url.searchParams.set('letter', params.letter)

  window.history.replaceState(null, '', url.pathname + url.search)
}

function readUrlParams(): { keywords: string; firstName: string; lastName: string; letter: string } {
  if (typeof window === 'undefined') return { keywords: '', firstName: '', lastName: '', letter: '' }

  const params = new URLSearchParams(window.location.search)
  const keywords = params.get('Keywords') || ''
  const names = params.get('NAMES') || ''
  const letter = params.get('letter') || ''

  let firstName = ''
  let lastName = ''
  if (names) {
    const parts = names.split(',')
    firstName = parts[0] || ''
    lastName = parts[1] || ''
  }

  return { keywords, firstName, lastName, letter }
}

export default function Home() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const [keyword, setKeyword] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const [activeLetter, setActiveLetter] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [appliedFirstName, setAppliedFirstName] = useState('')
  const [appliedLastName, setAppliedLastName] = useState('')
  const [nameFilterOpen, setNameFilterOpen] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const initializedRef = useRef(false)

  const buildApiUrl = useCallback((pageNum: number, opts?: { kw?: string; fn?: string; ln?: string; letter?: string }) => {
    const kw = opts?.kw ?? appliedKeyword
    const fn = opts?.fn ?? appliedFirstName
    const ln = opts?.ln ?? appliedLastName
    const letter = opts?.letter ?? activeLetter

    const params = new URLSearchParams({
      contextLanguage: 'en',
      contextSite: 'dentons',
      pageNumber: String(pageNum),
      pageSize: String(PAGE_SIZE),
    })

    if (kw) params.set('keywords', encodeKeyword(kw))

    const nameParts = [fn, ln].filter(Boolean).join(',')
    if (nameParts) params.set('names', nameParts)

    if (letter) params.set('alpha', letter)

    return `/api/people?${params.toString()}`
  }, [appliedKeyword, appliedFirstName, appliedLastName, activeLetter])

  const syncUrl = useCallback((kw: string, fn: string, ln: string, letter: string) => {
    const names = [fn, ln].filter(Boolean).join(',')
    updateBrowserUrl({ keywords: kw, names, letter })
  }, [])

  const fetchPeople = useCallback(async (pageNum: number, append: boolean, url: string) => {
    try {
      if (append) setLoadingMore(true)
      else { setLoading(true); setError(null) }

      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      if (data.error) { setError(data.message || 'Failed to fetch'); return }

      if (data.persons && Array.isArray(data.persons)) {
        setPeople(prev => append ? [...prev, ...data.persons] : data.persons)
        if (data.totalResult != null) setTotalResults(data.totalResult)
        setHasMore(data.persons.length === PAGE_SIZE)
      } else {
        if (!append) setPeople([])
        setTotalResults(0)
        setHasMore(false)
      }
    } catch (err) {
      setError('Failed to fetch: ' + (err as Error).message)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const urlParams = readUrlParams()

    if (urlParams.keywords) {
      setKeyword(urlParams.keywords)
      setAppliedKeyword(urlParams.keywords)
    }
    if (urlParams.firstName) {
      setFirstName(urlParams.firstName)
      setAppliedFirstName(urlParams.firstName)
    }
    if (urlParams.lastName) {
      setLastName(urlParams.lastName)
      setAppliedLastName(urlParams.lastName)
    }
    if (urlParams.letter) {
      setActiveLetter(urlParams.letter)
    }

    const params = new URLSearchParams({
      contextLanguage: 'en',
      contextSite: 'dentons',
      pageNumber: '1',
      pageSize: String(PAGE_SIZE),
    })
    if (urlParams.keywords) params.set('keywords', encodeKeyword(urlParams.keywords))
    const nameParts = [urlParams.firstName, urlParams.lastName].filter(Boolean).join(',')
    if (nameParts) params.set('names', nameParts)
    if (urlParams.letter) params.set('alpha', urlParams.letter)

    fetchPeople(1, false, `/api/people?${params.toString()}`)
  }, [fetchPeople])

  const filteredPeople = people

  const activeFilters = useMemo(() => {
    const filters: ActiveFilter[] = []
    if (appliedKeyword) filters.push({ type: 'keyword', label: `Search: ${appliedKeyword}` })
    if (activeLetter) filters.push({ type: 'alphabet', label: `Letter: ${activeLetter}` })
    if (appliedFirstName || appliedLastName) {
      const parts = [appliedFirstName, appliedLastName].filter(Boolean).join(', ')
      filters.push({ type: 'name', label: `Name: ${parts}` })
    }
    return filters
  }, [appliedKeyword, activeLetter, appliedFirstName, appliedLastName])

  const doSearch = useCallback((kw: string, fn: string, ln: string, letter?: string) => {
    const lt = letter ?? activeLetter
    setPage(1)
    setExpandedIndex(null)
    const url = buildApiUrl(1, { kw, fn, ln, letter: lt })
    fetchPeople(1, false, url)
    syncUrl(kw, fn, ln, lt)
  }, [buildApiUrl, fetchPeople, syncUrl, activeLetter])

  const handleKeywordSearch = (e: FormEvent) => {
    e.preventDefault()
    setAppliedKeyword(keyword)
    doSearch(keyword, appliedFirstName, appliedLastName)
  }

  const handleAlphabetClick = (letter: string) => {
    const newLetter = activeLetter === letter ? '' : letter
    setActiveLetter(newLetter)
    doSearch(appliedKeyword, appliedFirstName, appliedLastName, newLetter)
  }

  const handleNameSearch = (e: FormEvent) => {
    e.preventDefault()
    setAppliedFirstName(firstName)
    setAppliedLastName(lastName)
    doSearch(appliedKeyword, firstName, lastName)
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchPeople(nextPage, true, buildApiUrl(nextPage))
  }

  const removeFilter = (filter: ActiveFilter) => {
    if (filter.type === 'keyword') {
      setKeyword(''); setAppliedKeyword('')
      doSearch('', appliedFirstName, appliedLastName)
    } else if (filter.type === 'alphabet') {
      setActiveLetter('')
      doSearch(appliedKeyword, appliedFirstName, appliedLastName, '')
    } else if (filter.type === 'name') {
      setFirstName(''); setLastName(''); setAppliedFirstName(''); setAppliedLastName('')
      doSearch(appliedKeyword, '', '')
    }
  }

  const clearAllFilters = () => {
    setKeyword(''); setAppliedKeyword('')
    setActiveLetter('')
    setFirstName(''); setLastName(''); setAppliedFirstName(''); setAppliedLastName('')
    setPage(1)
    setExpandedIndex(null)
    fetchPeople(1, false, `/api/people?contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=${PAGE_SIZE}`)
    updateBrowserUrl({})
  }

  const sidebarContent = (
    <>
      {activeFilters.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Active filters</h3>
            <button onClick={() => { clearAllFilters(); setSidebarOpen(false) }} className="text-xs text-[#7B1FA2] hover:underline">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((filter, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-[#7B1FA2] text-white text-xs px-3 py-1.5 rounded">
                {filter.label}
                <button onClick={() => removeFilter(filter)} className="ml-1 hover:opacity-80">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Additional filters</h3>
        <p className="text-xs text-gray-500 mb-4">Select filters. Search results list will be updated automatically.</p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="w-full flex items-center justify-between px-4 py-3 bg-gray-50">
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNameFilterOpen(!nameFilterOpen)}
              className={`w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity ${nameFilterOpen ? 'bg-[#7B1FA2]' : 'bg-gray-400'}`}
            >
              {nameFilterOpen ? '−' : '+'}
            </button>
            <span className="text-sm font-semibold text-[#7B1FA2]">Name</span>
          </span>
          {(firstName || lastName || appliedFirstName || appliedLastName) && (
            <span
              onClick={() => {
                setFirstName(''); setLastName('')
                if (appliedFirstName || appliedLastName) {
                  setAppliedFirstName(''); setAppliedLastName('')
                  doSearch(appliedKeyword, '', '')
                }
              }}
              className="text-xs text-[#7B1FA2] hover:underline cursor-pointer"
            >
              Clear
            </span>
          )}
        </div>

        {nameFilterOpen && (
          <form onSubmit={e => { handleNameSearch(e); setSidebarOpen(false) }} className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">First Name</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Start typing first name"
                  className="w-full border border-gray-300 rounded pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-[#7B1FA2] focus:ring-1 focus:ring-[#7B1FA2]"
                />
                {firstName && (
                  <button type="button" onClick={() => setFirstName('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Start typing last name"
                  className="w-full border border-gray-300 rounded pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-[#7B1FA2] focus:ring-1 focus:ring-[#7B1FA2]"
                />
                {lastName && (
                  <button type="button" onClick={() => setLastName('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <button type="submit" className="w-full bg-[#7B1FA2] text-white text-sm font-medium py-2.5 rounded hover:bg-[#6A1B91] transition-colors">
              Search
            </button>
          </form>
        )}
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-[#1a1a2e] text-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <nav className="py-2 text-xs text-gray-400">
            <span>Home</span><span className="mx-1">&gt;</span><span>Our professionals</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-light pb-4 sm:pb-6 italic font-serif">Our professionals</h1>
        </div>
      </header>

      {/* Top Keyword Search */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <form onSubmit={handleKeywordSearch} className="flex">
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Search by keyword: name, practice, office.."
              className="flex-grow border border-gray-300 rounded-l px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:outline-none focus:border-[#7B1FA2] focus:ring-1 focus:ring-[#7B1FA2]"
            />
            <button type="submit" className="bg-[#7B1FA2] text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-r hover:bg-[#6A1B91] transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>
        </div>
      </div>

      {/* Alphabet Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-0.5 py-2.5 sm:py-3 sm:justify-between min-w-max sm:min-w-0">
            {ALPHABET.map(letter => (
              <button
                key={letter}
                onClick={() => handleAlphabetClick(letter)}
                className={`w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center font-medium rounded transition-colors text-base sm:text-lg
                  ${activeLetter === letter ? 'bg-[#7B1FA2] text-white' : 'text-gray-600 hover:text-[#7B1FA2] hover:bg-purple-50'}`}
              >
                {letter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Filter Button */}
      <div className="lg:hidden max-w-7xl mx-auto px-3 sm:px-6 pb-2">
        <button
          onClick={() => setSidebarOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm3 6a1 1 0 011-1h10a1 1 0 010 2H7a1 1 0 01-1-1zm2 6a1 1 0 011-1h6a1 1 0 010 2H9a1 1 0 01-1-1z" />
          </svg>
          Filters
          {activeFilters.length > 0 && (
            <span className="bg-[#7B1FA2] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{activeFilters.length}</span>
          )}
        </button>
      </div>

      {/* Mobile/Tablet Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-base font-semibold text-gray-800">Filters</h2>
              <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {sidebarContent}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            {sidebarContent}
          </aside>

          {/* Results */}
          <div className="flex-grow min-w-0">
            <div className="mb-3 sm:mb-4">
              <span className="text-sm text-gray-600">
                Total results ({totalResults.toLocaleString()})
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 sm:py-20">
                <svg className="animate-spin h-8 w-8 text-[#7B1FA2]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : error ? (
              <div className="text-center py-16 sm:py-20 text-red-600">{error}</div>
            ) : filteredPeople.length === 0 ? (
              <div className="text-center py-16 sm:py-20 text-gray-500">
                No results found. Try a different search or{' '}
                <button onClick={clearAllFilters} className="text-[#7B1FA2] hover:underline">clear all filters</button>.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {filteredPeople.map((person, index) => {
                    const isExpanded = expandedIndex === index
                    const isEndOfRow = index % 2 === 1 || index === filteredPeople.length - 1
                    const rowStart = index % 2 === 0 ? index : index - 1
                    const expandedInThisRow = expandedIndex !== null && expandedIndex >= rowStart && expandedIndex <= rowStart + 1

                    return (
                      <React.Fragment key={person.id || `person-${index}`}>
                        <PersonCard
                          person={person}
                          index={index}
                          isExpanded={isExpanded}
                          onToggle={() => setExpandedIndex(isExpanded ? null : index)}
                        />
                        {isEndOfRow && expandedInThisRow && expandedIndex !== null && filteredPeople[expandedIndex] && (
                          <div className="col-span-1 md:col-span-2">
                            <ExpandedDetail
                              person={filteredPeople[expandedIndex]}
                              onClose={() => setExpandedIndex(null)}
                              arrowPosition={expandedIndex % 2 === 0 ? 'left' : 'right'}
                            />
                          </div>
                        )}
                      </React.Fragment>
                    )
                  })}
                </div>

                {hasMore && (
                  <div className="mt-6 sm:mt-8 flex justify-center">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full sm:w-auto px-8 py-3 bg-[#7B1FA2] text-white font-medium rounded-lg hover:bg-[#6A1B91] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {loadingMore ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Loading...
                        </span>
                      ) : (
                        'Load More'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const PersonCard = memo(function PersonCard({ person, index = 0, isExpanded, onToggle }: {
  person: Person; index?: number; isExpanded: boolean; onToggle: () => void
}) {
  const fullName = `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`
  const imageUrl = person.imgUrl ? `https://www.dentons.com${person.imgUrl}` : ''
  const emailAddr = person.emailMeAddress || person.email || ''
  const delay = Math.min(index * 60, 800)

  return (
    <div
      className={`card-ai-drop bg-white border transition-shadow relative ${isExpanded ? 'border-[#7B1FA2] shadow-md' : 'border-gray-200 hover:shadow-md'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="p-3 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="flex-shrink-0">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={fullName}
              width={80}
              height={100}
              className="rounded-md w-14 sm:w-20"
              style={{ objectFit: 'contain', height: 'auto' }}
              unoptimized
            />
          ) : (
            <div className="w-14 h-14 sm:w-20 sm:h-20 bg-gray-200 rounded-md flex items-center justify-center">
              <span className="text-xl sm:text-2xl text-gray-400">{person.firstName?.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="flex-grow min-w-0 pr-6">
          <h2 className="text-base sm:text-lg font-bold text-[#7B1FA2] mb-0.5 sm:mb-1 truncate">{fullName}</h2>
          <p className="text-gray-700 text-xs sm:text-sm mb-0.5">{person.jobTitle}</p>
          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3">{person.officeTitle || person.officeDetails}</p>
          <a
            href={`mailto:${emailAddr}`}
            className="inline-flex items-center gap-1.5 sm:gap-2 text-[#7B1FA2] hover:text-[#6A1B91] text-xs sm:text-sm font-medium"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email me
          </a>
        </div>

        <button
          onClick={onToggle}
          className={`absolute bottom-3 right-3 sm:bottom-5 sm:right-5 w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
            isExpanded ? 'bg-[#7B1FA2] text-white' : 'text-gray-400 hover:text-[#7B1FA2] border border-gray-300 hover:border-[#7B1FA2]'
          }`}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            {isExpanded
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            }
          </svg>
        </button>
      </div>
    </div>
  )
})

const ExpandedDetail = memo(function ExpandedDetail({ person, onClose, arrowPosition }: {
  person: Person; onClose: () => void; arrowPosition: 'left' | 'right'
}) {
  const profileLink = person.link || person.profileUrl || ''

  const stripHtml = (html: string) => {
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  return (
    <div className="relative animate-slideDown">
      {/* Arrow pointing to the source card */}
      <div
        className={`absolute -top-2 w-4 h-4 bg-white border-l border-t border-[#7B1FA2] rotate-45 z-10 hidden md:block ${
          arrowPosition === 'left' ? 'left-[25%]' : 'right-[25%]'
        }`}
      />

      <div className="border border-[#7B1FA2] bg-white rounded-sm overflow-hidden">
        <div className="p-4 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors z-10"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex flex-col md:flex-row gap-5 sm:gap-8 pr-6">
            <div className="md:w-2/5 min-w-0">
              {person.about && (
                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-4 sm:mb-5 line-clamp-4">
                  {stripHtml(person.about)}
                </p>
              )}

              {person.officeList && person.officeList.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-gray-800 mb-2">
                    {person.expandOfficeHeading || 'Offices'}
                  </h4>
                  <div className="space-y-2">
                    {person.officeList.map((office, i) => (
                      <div key={i}>
                        <p className="text-xs sm:text-sm text-gray-700">{office.office}</p>
                        {office.telNo && (
                          <a href={`tel:${office.telNo}`} className="text-xs sm:text-sm text-[#7B1FA2] hover:underline">
                            {office.telNo}
                          </a>
                        )}
                        {office.mobileNo && (
                          <a href={`tel:${office.mobileNo}`} className="text-xs sm:text-sm text-[#7B1FA2] hover:underline block">
                            {office.mobileNo}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {person.focusList && person.focusList.length > 0 && (
              <div className="md:w-3/5 min-w-0">
                <h4 className="text-xs sm:text-sm font-bold text-gray-800 mb-2">
                  {person.expandAOF || 'Areas of focus'}
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0.5">
                  {person.focusList.map((focus, i) => (
                    <p key={i} className="text-xs sm:text-sm text-gray-600">{focus.node}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {profileLink && (
            <div className="mt-4 sm:mt-5 flex justify-end">
              <a
                href={profileLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm font-medium text-[#7B1FA2] hover:text-[#6A1B91] hover:underline"
              >
                {person.expandVFP || 'View full profile'}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
