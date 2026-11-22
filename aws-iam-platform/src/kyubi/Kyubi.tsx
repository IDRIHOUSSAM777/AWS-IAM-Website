import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, ChevronUp, Lightbulb, Minus, Send, X } from 'lucide-react'
import { MessageText } from './MessageText'
import './kyubi.css'

const AVATAR = '/kyubi/kyubi-avatar.png'
const WAVE_VIDEO = '/kyubi/kyubi-wave.mp4'
const WAVE_POSTER = '/kyubi/kyubi-wave-poster.jpg'
const BADGE_VIDEO = '/kyubi/kyubi-badge.mp4'
const BADGE_POSTER = '/kyubi/kyubi-badge-poster.jpg'
const ENDPOINT = '/api/kyubi'
const HISTORY_LIMIT = 12
const BADGE_GREETING_MS = 10_000

const WELCOME =
  "Hey! I'm Kyubi 👋\nYour personal AWS IAM assistant.\nI can help you understand IAM, explore policies and troubleshoot access permissions."

const SUGGESTIONS = [
  'What is AWS IAM?',
  'Explain IAM Roles.',
  'What is the difference between Authentication and Authorization?',
  'Why is my S3 access denied?',
  'Explain this JSON IAM Policy.',
  'How does AWS STS work?',
  'What is the Principle of Least Privilege?',
]

type Role = 'user' | 'assistant'
type Message = { id: string; role: Role; content: string }
type Mood = 'idle' | 'thinking' | 'happy' | 'error'

const STORE_MESSAGES = 'kyubi:messages'
const STORE_GREETED = 'kyubi:greeted'

function readStore(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStore(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* storage can be blocked; the chat still works */
  }
}

function welcomeMessage(): Message {
  return { id: 'welcome', role: 'assistant', content: WELCOME }
}

function loadMessages(): Message[] {
  const stored = readStore(STORE_MESSAGES)
  if (!stored) return [welcomeMessage()]
  try {
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed) || !parsed.length) return [welcomeMessage()]
    const messages = parsed.filter(
      (entry): entry is Message =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as Message).content === 'string' &&
        ((entry as Message).role === 'user' || (entry as Message).role === 'assistant'),
    )
    return messages.length ? messages : [welcomeMessage()]
  } catch {
    return [welcomeMessage()]
  }
}

export default function Kyubi() {
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [greeting, setGreeting] = useState(false)
  const [badgeGreeting, setBadgeGreeting] = useState(false)
  const [badgePlaying, setBadgePlaying] = useState(false)

  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const badgeVideo = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false)
  const openRef = useRef(false)

  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const mood: Mood = sending ? 'thinking' : error ? 'error' : 'idle'
  const showSuggestions = messages.length === 1 && !sending && !error

  useEffect(() => {
    writeStore(STORE_MESSAGES, JSON.stringify(messages.slice(-HISTORY_LIMIT * 2)))
  }, [messages])

  useEffect(() => {
    if (!open || minimized || messages.length < 2) return
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, sending, error, open, minimized])

  useEffect(() => {
    if (!open || minimized) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 240)
    return () => window.clearTimeout(timer)
  }, [open, minimized])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setGreeting(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // One greeting per session, inside the chat body only.
  useEffect(() => {
    if (!open || minimized || greeting || readStore(STORE_GREETED)) return
    const timer = window.setTimeout(() => setGreeting(true), 120)
    return () => window.clearTimeout(timer)
  }, [open, minimized, greeting])

  const dismissGreeting = () => {
    setGreeting(false)
    writeStore(STORE_GREETED, '1')
  }

  // Occasional wave inside the circular button.
  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) return

    let timer = 0
    const schedule = (delay: number) => {
      timer = window.setTimeout(() => {
        if (document.visibilityState === 'visible' && !openRef.current) {
          setBadgeGreeting(true)
        }
        schedule(BADGE_GREETING_MS)
      }, delay)
    }
    schedule(5_000)
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  useEffect(() => {
    openRef.current = open && !minimized
  }, [open, minimized])

  useEffect(() => {
    const video = badgeVideo.current
    if (!video) return
    if (badgeGreeting) {
      video.currentTime = 0
      const attempt = video.play()
      if (attempt) attempt.catch(() => setBadgeGreeting(false))
    } else {
      video.pause()
    }
  }, [badgeGreeting])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busyRef.current) return
    busyRef.current = true
    setError(null)
    setInput('')
    dismissGreeting()

    const outgoing: Message[] = [...messages, { id: `u-${Date.now()}`, role: 'user', content }]
    setMessages(outgoing)
    setSending(true)

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: outgoing.slice(-HISTORY_LIMIT).map(({ role, content: text }) => ({ role, content: text })),
        }),
      })
      const data: { reply?: string; error?: { message?: string } } = await response.json().catch(() => ({}))
      if (!response.ok || typeof data.reply !== 'string') {
        throw new Error(data.error?.message || 'Kyubi could not answer right now. Please try again.')
      }
      setMessages((current) => [...current, { id: `k-${Date.now()}`, role: 'assistant', content: data.reply as string }])
    } catch (caught) {
      setError(
        caught instanceof TypeError
          ? 'Kyubi cannot reach the server. Make sure the dev server is running, then try again.'
          : caught instanceof Error
            ? caught.message
            : 'Something went wrong. Please try again.',
      )
    } finally {
      busyRef.current = false
      setSending(false)
    }
  }

  const lastQuestion = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return ''
  }, [messages])

  const resetChat = () => {
    setMessages([welcomeMessage()])
    setError(null)
    setInput('')
    writeStore(STORE_MESSAGES, JSON.stringify([welcomeMessage()]))
  }

  const toggleOpen = () => {
    if (!open) {
      setOpen(true)
      setMinimized(false)
      setBadgeGreeting(false)
      setBadgePlaying(false)
      return
    }
    if (minimized) {
      setMinimized(false)
      return
    }
    setOpen(false)
  }

  return (
    <div className="ky-root">
      {open && (
        <section
          className={`ky-panel${minimized ? ' is-min' : ''}`}
          role="dialog"
          aria-label="Kyubi, the AWS IAM security assistant"
        >
          <header className="ky-head">
            <span className={`ky-mood ky-mood-${mood}`}>
              <img src={AVATAR} alt="" width={44} height={44} />
              <i className="ky-live" aria-hidden="true" />
            </span>
            <div className="ky-id">
              <b>KYUBI</b>
              <span className="ky-role">IAM SECURITY ASSISTANT</span>
              <span className="ky-status">
                <i aria-hidden="true" />
                {sending ? 'Thinking…' : 'Online · Ready to help'}
              </span>
            </div>
            <div className="ky-actions">
              {messages.length > 1 && (
                <button type="button" onClick={resetChat} aria-label="Start a new conversation" title="New conversation">
                  ↺
                </button>
              )}
              <button
                type="button"
                onClick={() => setMinimized((value) => !value)}
                aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
                aria-expanded={!minimized}
              >
                {minimized ? <ChevronUp size={16} /> : <Minus size={16} />}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
                <X size={16} />
              </button>
            </div>
          </header>

          {!minimized && (
            <>
              <div className="ky-stage">
              <div className="ky-body" ref={scroller}>
                {messages.map((message) => (
                  <div key={message.id} className={`ky-row ky-${message.role}`}>
                    {message.role === 'assistant' && (
                      <img className="ky-mini" src={AVATAR} alt="" width={34} height={34} />
                    )}
                    <div className="ky-bubble">
                      <MessageText text={message.content} />
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className="ky-row ky-assistant">
                    <img className="ky-mini" src={AVATAR} alt="" width={34} height={34} />
                    <div className="ky-bubble ky-typing" role="status" aria-label="Kyubi is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="ky-error" role="alert">
                    <p>{error}</p>
                    {lastQuestion && (
                      <button type="button" onClick={() => send(lastQuestion)} disabled={sending}>
                        Try again
                      </button>
                    )}
                  </div>
                )}

                {showSuggestions && (
                  <div className="ky-suggest">
                    <p className="ky-suggest-title">
                      <Lightbulb size={14} aria-hidden="true" />
                      Suggested questions
                    </p>
                    {SUGGESTIONS.map((question) => (
                      <button key={question} type="button" onClick={() => send(question)}>
                        <span>{question}</span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}

              </div>

                {greeting && (
                  <div className="ky-greeting" onClick={dismissGreeting}>
                    <video
                      src={WAVE_VIDEO}
                      poster={WAVE_POSTER}
                      autoPlay
                      muted
                      playsInline
                      preload="auto"
                      onEnded={dismissGreeting}
                      onError={dismissGreeting}
                      aria-label="Kyubi waving hello"
                    />
                    <span>Kyubi says hello</span>
                  </div>
                )}
              </div>

              <form
                className="ky-composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  void send(input)
                }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask Kyubi anything about IAM…"
                  aria-label="Ask Kyubi a question"
                  maxLength={2000}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="ky-send"
                  aria-label="Send message"
                  disabled={!input.trim() || sending}
                >
                  <Send size={17} aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </section>
      )}

      <button
        type="button"
        className={`ky-launcher${open && !minimized ? ' is-active' : ''}`}
        onClick={toggleOpen}
        aria-label={open && !minimized ? 'Close Kyubi assistant' : 'Open Kyubi, the AWS IAM assistant'}
        aria-expanded={open && !minimized}
      >
        <img src={AVATAR} alt="" className={`ky-launcher-face${badgePlaying ? ' is-away' : ''}`} />
        <video
          ref={badgeVideo}
          src={BADGE_VIDEO}
          poster={BADGE_POSTER}
          muted
          playsInline
          preload="none"
          aria-hidden="true"
          className={`ky-launcher-video${badgePlaying ? ' is-on' : ''}`}
          onPlaying={() => setBadgePlaying(true)}
          onEnded={() => {
            setBadgePlaying(false)
            setBadgeGreeting(false)
          }}
        />
        <span className="ky-launcher-ping" aria-hidden="true" />
      </button>
    </div>
  )
}
