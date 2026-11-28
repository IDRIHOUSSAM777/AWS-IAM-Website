export type QuizQuestion = {
  slot: number
  text: string
  options: string[]
  answered: boolean
  chosen: number | null
  correct: number | null
  isCorrect: boolean | null
  explanation: string | null
}

export type QuizState = {
  /** Anonymous id kept by this browser only. It is not a name, account or profile. */
  session: string
  questions: QuizQuestion[]
  answered: number
  score: number
  total: number
}

export type AnswerResult = {
  question: QuizQuestion
  alreadyAnswered: boolean
  score: number
  answered: number
  total: number
}

export class QuizApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const SESSION_KEY = 'quiz:session'
let memorySession: string | null = null

function isSession(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

function newSession(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Very old browsers: build a UUID v4 with the random generator where one exists.
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * The quiz keeps its nine questions and its score for this browser. A random id is stored in
 * localStorage (never in a cookie); it contains no personal data and is not a visitor profile.
 */
function sessionId(): string {
  if (memorySession) return memorySession
  try {
    const saved = window.localStorage.getItem(SESSION_KEY)
    if (isSession(saved)) {
      memorySession = saved
      return saved
    }
  } catch {
    /* private mode can block storage; the id still works for this page */
  }
  const created = newSession()
  memorySession = created
  try {
    window.localStorage.setItem(SESSION_KEY, created)
  } catch {
    /* storage can be blocked */
  }
  return created
}

function rememberSession(session: unknown) {
  if (!isSession(session)) return
  memorySession = session
  try {
    window.localStorage.setItem(SESSION_KEY, session)
  } catch {
    /* storage can be blocked */
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: { 'X-Quiz-Session': sessionId(), ...(init?.headers ?? {}) },
    })
  } catch {
    throw new QuizApiError('We could not reach the site just now. Please check your connection and try again.', 0)
  }
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // an empty or unreadable answer is handled below
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : 'Something went wrong on our side. Please try again in a moment.'
    throw new QuizApiError(message, response.status)
  }
  return data as T
}

export async function fetchQuiz(): Promise<QuizState> {
  const data = await request<QuizState>('/api/quiz')
  rememberSession(data.session)
  return data
}

export const submitAnswer = (slot: number, choice: number) =>
  request<AnswerResult>('/api/quiz/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, choice }),
  })
