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
  name: string
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

export type BoardEntry = {
  rank: number | null
  name: string
  score: number
  answered: number
  isYou: boolean
}

export type BoardPeriod = 'all' | 'week' | 'month' | 'year'

export type Board = {
  entries: BoardEntry[]
  me: BoardEntry | null
  players: number
  total: number
  period: BoardPeriod
}

export class QuizApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, { credentials: 'same-origin', ...init })
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

export const fetchQuiz = () => request<QuizState>('/api/quiz')
export const fetchBoard = (period: BoardPeriod = 'all') =>
  request<Board>(`/api/leaderboard?period=${period}`)
export const submitAnswer = (slot: number, choice: number) =>
  request<AnswerResult>('/api/quiz/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot, choice }),
  })

const EVENT = 'quiz:updated'
/** Tells the quiz and the leaderboard that a new answer was saved. */
export const announceQuizChange = () => window.dispatchEvent(new Event(EVENT))
export function onQuizChange(listener: () => void) {
  window.addEventListener(EVENT, listener)
  return () => window.removeEventListener(EVENT, listener)
}
