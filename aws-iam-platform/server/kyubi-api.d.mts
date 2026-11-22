import type { IncomingMessage, ServerResponse } from 'node:http'

export type KyubiNext = (error?: unknown) => void

export type KyubiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: KyubiNext,
) => Promise<void> | void

export declare function createKyubiHandler(options?: { root?: string }): KyubiMiddleware

export declare function loadEnvFiles(root?: string): void
