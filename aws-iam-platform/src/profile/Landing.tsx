import { useState, type CSSProperties, type FormEvent } from 'react'
import awsLogo from '../assets/aws-logo.png'
import awsCloud from '../assets/aws-cloud-keyless.png'
import { ProfileApiError, saveProfileName } from './profileApi'
import './profile.css'

type Props = {
  notice: string | null
  onSaved: (name: string) => void
  onSkip: () => void
}

export default function Landing({ notice, onSaved, onSkip }: Props) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSubmit = value.trim().length >= 2 && !busy

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const saved = await saveProfileName(value)
      if (saved) {
        onSaved(saved) // the page changes, so there is nothing to reset here
      } else {
        setError('We could not save your name just now. Please try again in a moment.')
        setBusy(false)
      }
    } catch (caught) {
      setError(caught instanceof ProfileApiError ? caught.message : 'Something went wrong on our side. Please try again in a moment.')
      setBusy(false)
    }
  }

  return (
    <main className="pf-landing">
      <div className="pf-card c">
        <div className="pf-top">
          <img className="pf-logo" src={awsLogo} alt="AWS" />
          <img className="pf-cloud" src={awsCloud} alt="" aria-hidden="true" />
        </div>
        <p className="t">Welcome to AWS Student Builder</p>
        <h1 className="pf-title">
          <span className="tw" style={{ '--n': 30, '--d': '1s', '--t': '.2s' } as CSSProperties}>
            Welcome! What may we call you?
          </span>
          <i className="pf-cursor" aria-hidden="true" />
        </h1>

        <p className="mu">We would love to greet you properly. Please tell us how you would like to be called.</p>

        <form className="pf-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="pf-name">Your first name or nickname</label>
          <input
            id="pf-name"
            name="name"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={30}
            autoFocus
            autoComplete="given-name"
            spellCheck={false}
            aria-describedby="pf-hint"
                      />
          <p id="pf-hint" className="pf-hint">Between 2 and 30 characters.</p>
          <button className="btn pf-submit" type="submit" disabled={!canSubmit}>
            {busy ? 'One moment…' : 'Continue'}
          </button>
          <p className="pf-error" role="alert">{error ?? ''}</p>
        </form>

        {notice && <p className="pf-notice">{notice}</p>}

        <button className="pf-skip" type="button" onClick={onSkip}>Skip for now</button>
      </div>
    </main>
  )
}
