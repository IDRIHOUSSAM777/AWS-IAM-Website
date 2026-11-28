export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
export const QUESTIONS_PER_DIFFICULTY = 3
export const ATTEMPT_SIZE = DIFFICULTIES.length * QUESTIONS_PER_DIFFICULTY

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy · N1',
  medium: 'Medium · N2',
  hard: 'Hard · N3',
}

export type BankQuestion = {
  id: string
  difficulty: Difficulty
  question: string
  choices: string[]
  answer: number
  explanation?: string
}

export type QuizQuestion = {
  id: string
  difficulty: Difficulty
  question: string
  choices: string[]
  answer: number
  explanation: string
}

export type QuizBank = {
  version: number
  questions: BankQuestion[]
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    const held = copy[index]
    copy[index] = copy[swapWith]
    copy[swapWith] = held
  }
  return copy
}

/** Returns a list of problems with the bank; an empty list means it is usable. */
export function validateBank(questions: readonly BankQuestion[]): string[] {
  const problems: string[] = []
  const ids = new Set<string>()

  questions.forEach((question, position) => {
    const where = question.id || `question ${position + 1}`

    if (!question.id || !question.id.trim()) problems.push(`${where}: missing id`)
    else if (ids.has(question.id)) problems.push(`${where}: duplicate id`)
    ids.add(question.id)

    if (!DIFFICULTIES.includes(question.difficulty)) {
      problems.push(`${where}: difficulty must be easy, medium or hard`)
    }

    if (!question.question || !question.question.trim()) {
      problems.push(`${where}: missing question text`)
    }

    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      problems.push(`${where}: exactly 3 choices are required`)
    } else {
      if (question.choices.some((choice) => !choice || !choice.trim())) {
        problems.push(`${where}: every choice must have text`)
      }
      if (new Set(question.choices).size !== question.choices.length) {
        problems.push(`${where}: choices must be different from each other`)
      }
      if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) {
        problems.push(`${where}: answer must point to one of the choices`)
      }
    }
  })

  for (const level of DIFFICULTIES) {
    const available = questions.filter((question) => question.difficulty === level).length
    if (available < QUESTIONS_PER_DIFFICULTY) {
      problems.push(`${level}: needs at least ${QUESTIONS_PER_DIFFICULTY} questions, found ${available}`)
    }
  }

  return problems
}

/**
 * Draws 3 easy, 3 medium and 3 hard questions without repeats and keeps them in
 * stage order (all easy, then all medium, then all hard) so the attempt always
 * runs N1 -> N2 -> N3. Questions are shuffled inside each stage, never across
 * stages, and the choices of every question are shuffled with the correct
 * answer kept aligned.
 */
export function pickAttempt(
  bank: readonly BankQuestion[],
  random: () => number = Math.random,
): QuizQuestion[] {
  const picked: BankQuestion[] = []

  for (const level of DIFFICULTIES) {
    const pool = bank.filter((question) => question.difficulty === level)
    if (pool.length < QUESTIONS_PER_DIFFICULTY) {
      throw new Error(`The question bank needs at least ${QUESTIONS_PER_DIFFICULTY} ${level} questions.`)
    }
    picked.push(...shuffle(pool, random).slice(0, QUESTIONS_PER_DIFFICULTY))
  }

  return picked.map((question) => {
    const correctChoice = question.choices[question.answer]
    const choices = shuffle(question.choices, random)
    return {
      id: question.id,
      difficulty: question.difficulty,
      question: question.question,
      choices,
      answer: choices.indexOf(correctChoice),
      explanation: question.explanation ?? '',
    }
  })
}

export function scoreAttempt(
  questions: readonly QuizQuestion[],
  answers: readonly (number | null)[],
): number {
  return questions.reduce(
    (score, question, index) => score + (answers[index] === question.answer ? 1 : 0),
    0,
  )
}
