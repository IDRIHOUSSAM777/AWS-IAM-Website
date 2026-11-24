export class ProfileApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<string | null> {
  const init: RequestInit = { method, credentials: 'same-origin' }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  let response: Response
  try {
    response = await fetch('/api/profile', init)
  } catch {
    throw new ProfileApiError('We could not reach the site just now. Please check your connection and try again.', 0)
  }

  if (!response.ok) {
    let message = 'Something went wrong on our side. Please try again in a moment.'
    try {
      const data = (await response.json()) as { error?: string }
      if (typeof data.error === 'string') message = data.error
    } catch {
      /* keep the default message */
    }
    throw new ProfileApiError(message, response.status)
  }

  const data = (await response.json()) as { name: string | null }
  return data.name
}

export const getProfileName = () => request('GET')
export const saveProfileName = (name: string) => request('POST', { name })
export const clearProfileName = () => request('DELETE')
