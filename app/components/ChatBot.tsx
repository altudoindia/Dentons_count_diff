'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  id: string
  role: 'bot' | 'user'
  text: string
  links?: { label: string; href: string }[]
  loading?: boolean
}

interface PersonResult {
  firstName: string
  lastName: string | null
  jobTitle: string
  link: string
  officeDetails?: string
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'bot',
  text: "Hi! I'm the Dentons Assistant. I can help you search for lawyers, check insights & news counts, or navigate the app. Try asking me something!",
  links: [
    { label: 'Search a lawyer', href: '#' },
    { label: 'Insights count', href: '#' },
    { label: 'Latest news', href: '#' },
  ],
}

function matchIntent(msg: string): { intent: string; params: Record<string, string> } {
  const m = msg.toLowerCase().trim()

  if (/^(hi|hello|hey|howdy|good\s*(morning|evening|afternoon)|namaste|hola)/i.test(m)) {
    return { intent: 'greet', params: {} }
  }

  if (/help|what can you do|commands|features/i.test(m)) {
    return { intent: 'help', params: {} }
  }

  const searchMatch = m.match(
    /(?:find|search|look\s*(?:for|up)|show|who is|lawyer|attorney|bio)\s+(.+)/i
  )
  if (searchMatch) {
    return { intent: 'search_people', params: { query: searchMatch[1].trim() } }
  }

  const nameMatch = m.match(/^([a-z]+(?:\s+[a-z]+)?)$/i)
  if (nameMatch && m.split(/\s+/).length <= 3 && m.length > 2 && !/^(yes|no|ok|thanks|thank|bye|hi|hello|hey)$/i.test(m)) {
    return { intent: 'search_people', params: { query: nameMatch[1].trim() } }
  }

  if (/insight|article|publication/i.test(m)) {
    if (/count|how many|total|number/i.test(m)) {
      return { intent: 'insights_count', params: {} }
    }
    return { intent: 'insights_nav', params: {} }
  }

  if (/news|press|announcement/i.test(m)) {
    if (/count|how many|total|number/i.test(m)) {
      return { intent: 'news_count', params: {} }
    }
    return { intent: 'news_nav', params: {} }
  }

  if (/count|how many|total|stats|statistics/i.test(m)) {
    return { intent: 'all_counts', params: {} }
  }

  if (/compare|server|nacd|eucd|s10|uat/i.test(m)) {
    return { intent: 'compare_nav', params: {} }
  }

  if (/people|bio|lawyer|search/i.test(m)) {
    return { intent: 'people_nav', params: {} }
  }

  if (/thank|bye|goodbye|see you/i.test(m)) {
    return { intent: 'bye', params: {} }
  }

  return { intent: 'unknown', params: {} }
}

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const addBotMsg = useCallback((text: string, links?: Message['links']) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'bot',
      text,
      links,
    }])
  }, [])

  const fetchPeople = useCallback(async (query: string) => {
    setTyping(true)
    try {
      const words = query.split(/\s+/)
      let url: string
      if (words.length >= 2) {
        const names = `${words[0]},${words.slice(1).join(' ')}`
        url = `/api/people?names=${encodeURIComponent(names)}&contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=5`
      } else {
        url = `/api/people?keywords=${encodeURIComponent(query)}&contextLanguage=en&contextSite=dentons&pageNumber=1&pageSize=5`
      }

      const res = await fetch(url)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      const persons: PersonResult[] = data.persons || []
      const total: number = data.totalResult || 0

      if (persons.length === 0) {
        addBotMsg(`No results found for "${query}". Try a different name or keyword.`)
      } else {
        const list = persons.map(p => {
          const name = `${p.firstName} ${p.lastName || ''}`.trim()
          const title = p.jobTitle ? ` — ${p.jobTitle}` : ''
          return `**${name}**${title}`
        }).join('\n')

        addBotMsg(
          `Found ${total.toLocaleString()} result${total > 1 ? 's' : ''} for "${query}":\n\n${list}${total > 5 ? `\n\n...and ${(total - 5).toLocaleString()} more` : ''}`,
          [{ label: `View all ${total.toLocaleString()} results`, href: `/?keyword=${encodeURIComponent(query)}` }]
        )
      }
    } catch {
      addBotMsg('Sorry, I couldn\'t fetch the results right now. Please try again.')
    } finally {
      setTyping(false)
    }
  }, [addBotMsg])

  const fetchCount = useCallback(async (service: string) => {
    setTyping(true)
    try {
      const res = await fetch(`/api/server-proxy?domain=www.dentons.com&service=${service}&pageSize=1`)
      if (!res.ok) throw new Error('API error')
      const data = await res.json()
      return data.totalResult as number
    } catch {
      return null
    } finally {
      setTyping(false)
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text) return

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }])
    setInput('')

    const { intent, params } = matchIntent(text)

    switch (intent) {
      case 'greet':
        setTimeout(() => addBotMsg('Hello! How can I help you today? You can search for lawyers, check insights/news counts, or navigate the app.'), 400)
        break

      case 'help':
        setTimeout(() => addBotMsg(
          'Here\'s what I can do:\n\n' +
          '• **Search lawyers** — "Find Martin Abadi" or just type a name\n' +
          '• **Insights count** — "How many insights?"\n' +
          '• **News count** — "How many news articles?"\n' +
          '• **All counts** — "Show me stats"\n' +
          '• **Navigate** — "Go to insights", "Open compare"',
          [
            { label: 'People Search', href: '/' },
            { label: 'Server Compare', href: '/insights' },
          ]
        ), 400)
        break

      case 'search_people':
        await fetchPeople(params.query)
        break

      case 'insights_count': {
        const count = await fetchCount('insights')
        addBotMsg(
          count !== null
            ? `There are currently **${count.toLocaleString()}** insights on Dentons.`
            : 'Sorry, I couldn\'t fetch the insights count right now.',
          [{ label: 'Open Server Compare', href: '/insights' }]
        )
        break
      }

      case 'news_count': {
        const count = await fetchCount('news')
        addBotMsg(
          count !== null
            ? `There are currently **${count.toLocaleString()}** news articles on Dentons.`
            : 'Sorry, I couldn\'t fetch the news count right now.',
          [{ label: 'Open News Page', href: '/news' }]
        )
        break
      }

      case 'all_counts': {
        setTyping(true)
        const [insights, people, news] = await Promise.all([
          fetchCount('insights'),
          fetchCount('people'),
          fetchCount('news'),
        ])
        setTyping(false)
        addBotMsg(
          `Here are the current counts on **www.dentons.com**:\n\n` +
          `• **Insights**: ${insights?.toLocaleString() ?? 'N/A'}\n` +
          `• **People/Bio**: ${people?.toLocaleString() ?? 'N/A'}\n` +
          `• **News**: ${news?.toLocaleString() ?? 'N/A'}`,
          [{ label: 'Compare Servers', href: '/insights' }]
        )
        break
      }

      case 'insights_nav':
        setTimeout(() => addBotMsg(
          'You can view and compare insights across servers on the comparison dashboard.',
          [{ label: 'Open Server Compare', href: '/insights' }]
        ), 300)
        break

      case 'news_nav':
        setTimeout(() => addBotMsg(
          'Check out the news comparison page.',
          [{ label: 'Open News Page', href: '/news' }]
        ), 300)
        break

      case 'compare_nav':
        setTimeout(() => addBotMsg(
          'The server comparison dashboard lets you compare Insights, People, and News counts between any two Dentons servers.',
          [{ label: 'Open Compare Dashboard', href: '/insights' }]
        ), 300)
        break

      case 'people_nav':
        setTimeout(() => addBotMsg(
          'The People Search page lets you find Dentons lawyers by name, keyword, or alphabet.',
          [{ label: 'Open People Search', href: '/' }]
        ), 300)
        break

      case 'bye':
        setTimeout(() => addBotMsg('Goodbye! Feel free to ask anytime. 👋'), 400)
        break

      default:
        setTimeout(() => addBotMsg(
          `I'm not sure I understood that. Try one of these:`,
          [
            { label: 'Search a lawyer', href: '#' },
            { label: 'Show stats', href: '#' },
            { label: 'What can you do?', href: '#' },
          ]
        ), 400)
    }
  }, [input, addBotMsg, fetchPeople, fetchCount])

  const handleQuickAction = (label: string, href: string) => {
    if (href !== '#') {
      window.location.href = href
      return
    }
    const map: Record<string, string> = {
      'Search a lawyer': 'Find ',
      'Insights count': 'How many insights?',
      'Latest news': 'How many news articles?',
      'Show stats': 'Show me all counts',
      'What can you do?': 'help',
    }
    const text = map[label]
    if (text) {
      if (text.endsWith(' ')) {
        setInput(text)
        inputRef.current?.focus()
      } else {
        setInput(text)
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text }])
          setInput('')
          const { intent, params } = matchIntent(text)
          if (intent === 'all_counts') {
            fetchCount('insights').then(() => {})
          }
          handleIntentDirect(intent, params)
        }, 100)
      }
    }
  }

  const handleIntentDirect = useCallback(async (intent: string, params: Record<string, string>) => {
    switch (intent) {
      case 'insights_count': {
        const c = await fetchCount('insights')
        addBotMsg(c !== null ? `There are **${c.toLocaleString()}** insights.` : 'Could not fetch.', [{ label: 'Open Compare', href: '/insights' }])
        break
      }
      case 'news_count': {
        const c = await fetchCount('news')
        addBotMsg(c !== null ? `There are **${c.toLocaleString()}** news articles.` : 'Could not fetch.', [{ label: 'Open News', href: '/news' }])
        break
      }
      case 'all_counts': {
        setTyping(true)
        const [i, p, n] = await Promise.all([fetchCount('insights'), fetchCount('people'), fetchCount('news')])
        setTyping(false)
        addBotMsg(`**www.dentons.com** counts:\n• Insights: ${i?.toLocaleString() ?? 'N/A'}\n• People: ${p?.toLocaleString() ?? 'N/A'}\n• News: ${n?.toLocaleString() ?? 'N/A'}`, [{ label: 'Compare Servers', href: '/insights' }])
        break
      }
      case 'help':
        addBotMsg('I can search lawyers, show counts, and navigate. Try: "Find Martin" or "How many insights?"')
        break
      default:
        break
    }
  }, [addBotMsg, fetchCount])

  const renderText = (text: string) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      return (
        <span key={i}>
          {i > 0 && <br />}
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
            }
            return <span key={j}>{part}</span>
          })}
        </span>
      )
    })
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          open ? 'bg-gray-700 rotate-0' : 'bg-[#7B1FA2] hover:bg-[#6A1B9A] hover:scale-110'
        }`}
        aria-label="Toggle chat"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.477 2 2 6.253 2 11.471c0 2.952 1.412 5.585 3.625 7.326L4.5 22l3.875-2.15c1.15.39 2.38.6 3.625.6 5.523 0 10-4.253 10-9.48C22 6.254 17.523 2 12 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[370px] max-w-[calc(100vw-40px)] h-[520px] max-h-[calc(100vh-120px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-chatOpen">
          {/* Header */}
          <div className="bg-[#1a1a2e] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#7B1FA2] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Dentons Assistant</h3>
              <p className="text-gray-400 text-[10px]">Ask me about lawyers, insights & news</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 scrollbar-hide">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#7B1FA2] text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm'
                  }`}
                >
                  {renderText(msg.text)}
                  {msg.links && msg.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.links.map((link, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuickAction(link.label, link.href)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                            msg.role === 'user'
                              ? 'border-white/30 text-white/90 hover:bg-white/10'
                              : 'border-[#7B1FA2]/20 text-[#7B1FA2] hover:bg-[#7B1FA2]/5'
                          }`}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-3 bg-white">
            <form
              onSubmit={e => { e.preventDefault(); handleSend() }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 text-sm px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#7B1FA2]/30 focus:border-[#7B1FA2] bg-gray-50"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-xl bg-[#7B1FA2] text-white flex items-center justify-center disabled:opacity-30 hover:bg-[#6A1B9A] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
