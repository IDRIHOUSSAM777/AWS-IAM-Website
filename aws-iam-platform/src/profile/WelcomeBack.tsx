import { useEffect, useState } from 'react'
import Avatar from '../quiz/Avatar'
import { ProfileApiError } from './profileApi'
import { useProfile } from './profileContext'
import './profile.css'

const TYPE_DELAY = 280
const TYPE_SPEED = 55

export default function WelcomeBack() {
  const { name, returning, clear } = useProfile()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reduceMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!name || reduceMotion) return
    let index = 0
    let timer = window.setTimeout(function type() {
      index += 1
      setTyped(name.slice(0, index))
      if (index < name.length) timer = window.setTimeout(type, TYPE_SPEED)
    }, TYPE_DELAY)
    return () => window.clearTimeout(timer)
  }, [name, reduceMotion])

  if (!name) return null

  const visibleName = reduceMotion ? name : typed

  async function handleChangeName() {
    setBusy(true)
    setError(null)
    try {
      await clear() // success: the gate shows the landing page, so this component disappears
    } catch (caught) {
      setError(caught instanceof ProfileApiError ? caught.message : 'Something went wrong on our side. Please try again in a moment.')
      setBusy(false)
    }
  }

  return (
    <div className="pf-welcome">
      <Avatar name={name} size={76} randomCharacter />
      <div className="pf-id">
        <p className="pf-hello">
          <span className="pf-hello-label">{returning ? 'Welcome back,' : 'Welcome,'}</span>
          <b className="pf-name">
            <span className="pf-sr">{name}</span>
            <span aria-hidden="true">{visibleName}</span>
            <i className="pf-caret" aria-hidden="true" />
          </b>
        </p>
        <button className="pf-change" type="button" onClick={handleChangeName} disabled={busy}>
          {busy ? 'One moment…' : 'Not you? Change name'}
        </button>
      </div>
      <p className="pf-welcome-error" role="alert">{error ?? ''}</p>
    </div>
  )
}
