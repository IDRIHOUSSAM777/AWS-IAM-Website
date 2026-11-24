import type { IncomingMessage, ServerResponse } from 'node:http'

export type QuizNext = (error?: unknown) => void

export type QuizMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: QuizNext,
) => Promise<void> | void

export declare function createQuizHandler(): QuizMiddleware
