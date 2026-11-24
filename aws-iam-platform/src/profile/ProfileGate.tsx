import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Landing from './Landing'
import { ProfileContext } from './profileContext'
import { clearProfileName, getProfileName } from './profileApi'

type Phase = 'loading' | 'landing' | 'app'

// Kyubi keeps its chat in sessionStorage. Forget it when the person changes, so the next
// person does not see (or get answers addressed to) the previous name.
function forgetKyubiChat() {
  try {
    window.sessionStorage.removeItem('kyubi:messages')
    window.sessionStorage.removeItem('kyubi:greeted')
  } catch {
    /* storage can be blocked */
  }
}

export default function ProfileGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [name, setName] = useState<string | null>(null)
  const [returning, setReturning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getProfileName()
      .then((saved) => {
        if (cancelled) return
        setName(saved)
        setReturning(Boolean(saved))
        setPhase(saved ? 'app' : 'landing')
      })
      .catch(() => {
        if (cancelled) return
        setNotice('We could not check whether we already know you. You can enter your name below, or skip for now.')
        setPhase('landing')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const clear = useCallback(async () => {
    await clearProfileName()
    forgetKyubiChat()
    setName(null)
    setReturning(false)
    setNotice(null)
    setPhase('landing')
  }, [])

  const value = useMemo(() => ({ name, returning, clear }), [name, returning, clear])

  if (phase === 'loading') {
    return <div className="pf-loading" role="status" aria-label="Loading" />
  }

  if (phase === 'landing') {
    return (
      <Landing
        notice={notice}
        onSaved={(saved) => {
          setName(saved)
          setReturning(false)
          setPhase('app')
        }}
        onSkip={() => {
          setName(null)
          setPhase('app')
        }}
      />
    )
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}
