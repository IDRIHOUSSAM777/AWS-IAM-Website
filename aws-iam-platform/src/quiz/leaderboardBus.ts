const OPEN_EVENT = 'leaderboard:open'

/** Asks the leaderboard dock to open, from anywhere in the app. */
export const openLeaderboard = () => window.dispatchEvent(new Event(OPEN_EVENT))

export function onLeaderboardOpen(listener: () => void) {
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}
