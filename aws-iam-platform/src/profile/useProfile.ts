import { useCallback, useEffect, useState } from 'react'
import { clearProfileName, getProfileName } from './profileApi'

export function useProfile() {
  const [name, setName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getProfileName()
      .then((n) => { if (!cancelled) setName(n) })
      .catch(() => { /* no name known: treat as a new visitor */ })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Throws ProfileApiError on failure, so the UI can show a message
  const clear = useCallback(async () => {
    await clearProfileName()
    setName(null)
  }, [])

  return { name, loading, setName, clear }
}