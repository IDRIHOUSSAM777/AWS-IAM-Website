import { createContext, useContext } from 'react'

export type ProfileState = {
  /** null when the visitor chose "Continue without a name" */
  name: string | null
  /** true when the name was already saved before this page load */
  returning: boolean
  /** Deletes the saved name on the server, then returns to the landing page. Throws ProfileApiError on failure. */
  clear: () => Promise<void>
}

export const ProfileContext = createContext<ProfileState | null>(null)

export function useProfile(): ProfileState {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfile must be used inside <ProfileGate>')
  return value
}
