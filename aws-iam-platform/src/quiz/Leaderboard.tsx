import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Trophy, X } from 'lucide-react'
import { fetchBoard, onQuizChange, type Board, type BoardEntry, type BoardPeriod } from './quizApi'
import { onLeaderboardOpen } from './leaderboardBus'
import './quiz.css'

const TONES = ['#ff9900', '#38bdf8', '#a855f7', '#5eead4', '#f472b6', '#facc15']
const STORAGE_KEY = 'iam:leaderboard-open'

const TABS: Array<{ id: BoardPeriod; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
]

function toneFor(name: string) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) % 9973
  return TONES[hash % TONES.length]
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1
    ? words.slice(0, 2).map((word) => word[0]).join('')
    : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase() || '?'
}

function preferredOpen() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'open') return true
    if (saved === 'closed') return false
  } catch {
    /* private mode can block storage */
  }
  return window.matchMedia('(min-width: 900px)').matches
}

function PlayerTile({ name, size }: { name: string; size: number }) {
  return (
    <span
      className="lb-ava"
      style={{ '--size': `${size}px`, '--tone': toneFor(name) } as CSSProperties}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  )
}

function Podium({ entries }: { entries: BoardEntry[] }) {
  // Second place on the left, first in the middle, third on the right.
  const places: Array<{ entry: BoardEntry | undefined; place: 1 | 2 | 3 }> = [
    { entry: entries[1], place: 2 },
    { entry: entries[0], place: 1 },
    { entry: entries[2], place: 3 },
  ]
  return (
    <div className="lb-podium" role="list" aria-label="Top three players">
      {places.map(({ entry, place }) => (
        <div className={`lb-place p${place}`} role="listitem" key={place}>
          <div className="lb-person">
            {entry
              ? <PlayerTile name={entry.name} size={place === 1 ? 58 : 48} />
              : <span className="lb-ava lb-ava-empty" style={{ '--size': `${place === 1 ? 58 : 48}px` } as CSSProperties} aria-hidden="true">?</span>}
            <b className="lb-place-name">{entry ? entry.name : 'Free place'}</b>
            <span className="lb-place-score">{entry ? `${entry.score} pts` : '—'}</span>
          </div>
          <div className="lb-block" aria-hidden="true">
            <span className="lb-stars">✦ ✦</span>
            <span className="lb-num">{place}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Leaderboard() {
  const [open, setOpen] = useState(preferredOpen)
  const [period, setPeriod] = useState<BoardPeriod>('all')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [monthLabel] = useState(() =>
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date()),
  )
  const [yearLabel] = useState(() => String(new Date().getFullYear()))
  const closeRef = useRef<HTMLButtonElement>(null)
  const tabRef = useRef<HTMLButtonElement>(null)
  const focusOnOpen = useRef(false)
  const requestRef = useRef(0)

  const load = useCallback(async (nextPeriod: BoardPeriod) => {
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setLoading(true)
    try {
      const next = await fetchBoard(nextPeriod)
      if (requestId !== requestRef.current) return
      setBoard(next)
      setFailed(false)
    } catch {
      if (requestId !== requestRef.current) return
      setFailed(true)
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(period)
    return onQuizChange(() => void load(period))
  }, [load, period])

  const openPanel = useCallback(() => {
    if (open) {
      closeRef.current?.focus()
      return
    }
    focusOnOpen.current = true
    setOpen(true)
  }, [open])

  useEffect(() => onLeaderboardOpen(openPanel), [openPanel])

  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false
      closeRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed')
    } catch {
      /* storage can be blocked */
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      window.requestAnimationFrame(() => tabRef.current?.focus())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const closePanel = () => {
    setOpen(false)
    window.requestAnimationFrame(() => tabRef.current?.focus())
  }

  const periodSub = period === 'all'
    ? 'All time'
    : period === 'week'
      ? 'This week'
      : period === 'month'
        ? monthLabel
        : yearLabel

  const changePeriod = (next: BoardPeriod) => {
    if (next === period) return
    setBoard(null)
    setFailed(false)
    setPeriod(next)
  }

  return (
    <div className="lb-dock">
      {open ? (
        <aside className="lb-drawer" id="lb-panel" aria-labelledby="lb-title">
          <div className="lb-hero">
            <header className="lb-head">
              <button ref={closeRef} className="lb-close" type="button" onClick={closePanel} aria-label="Hide leaderboard">
                <X size={16} aria-hidden="true" />
              </button>
              <div className="lb-headings">
                <p className="lb-kicker">AWS Student Builder</p>
                <h2 className="lb-title" id="lb-title">Leaderboard</h2>
                <p className="lb-sub">Season 01 · {periodSub}</p>
              </div>
              <span className="lb-crown" aria-hidden="true"><Trophy size={15} /></span>
            </header>

            <Podium entries={board?.entries ?? []} />
          </div>

          <div className="lb-panel">
            <div className="lb-tabs" role="group" aria-label="Leaderboard period">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={period === tab.id ? 'on' : ''}
                  aria-pressed={period === tab.id}
                  onClick={() => changePeriod(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className={`lb-body${loading ? ' is-loading' : ''}`} aria-busy={loading}>
              {!board ? (
                failed ? (
                  <p className="lb-state">The leaderboard is not available right now. Try again a little later.</p>
                ) : (
                  <p className="lb-state" role="status">Loading the leaderboard…</p>
                )
              ) : board.entries.length === 0 ? (
                <p className="lb-state">Nobody has answered this period yet. Be the first!</p>
              ) : (
                <ul className="lb-list" aria-label="All players">
                  {board.entries.map((entry) => {
                    const rank = entry.rank ?? 0
                    return (
                      <li key={`${entry.rank}-${entry.name}`} className={`lb-row${entry.isYou ? ' me' : ''}`}>
                        <span className={`lb-rank${rank <= 3 ? ' top' : ''}`}>{entry.rank}</span>
                        <PlayerTile name={entry.name} size={38} />
                        <span className="lb-who">
                          <span className="lb-who-name">
                            {entry.name}
                            {entry.isYou ? <span className="lb-you">You</span> : null}
                          </span>
                          <span className="lb-who-meta">{entry.answered} / {board.total} answered</span>
                        </span>
                        <span className="lb-score">{entry.score}<small>/{board.total}</small></span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>
      ) : (
        <button
          ref={tabRef}
          className="lb-tab"
          type="button"
          onClick={openPanel}
          title="Show the leaderboard"
        >
          <Trophy size={15} aria-hidden="true" />
          <span>Leaderboard</span>
        </button>
      )}
    </div>
  )
}
