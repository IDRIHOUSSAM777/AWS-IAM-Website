import type { IncomingMessage, ServerResponse } from 'node:http'

export type ProfileNext = (error?: unknown) => void

export type ProfileMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: ProfileNext,
) => Promise<void> | void

export type ProfileDbConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
}

export declare function cleanName(raw: unknown): string
export declare function dbConfigFromEnv(env?: Record<string, string | undefined>): ProfileDbConfig
export declare function createProfileApi(getConfig?: () => ProfileDbConfig): {
  handler: ProfileMiddleware
  getVisitorName: (req: IncomingMessage) => Promise<string | null>
  getPool: () => unknown
  visitorIdFrom: (req: IncomingMessage) => string | null
  close: () => Promise<void> | undefined
}
export declare function createProfileHandler(): ProfileMiddleware
export declare function getVisitorName(req: IncomingMessage): Promise<string | null>
export declare function getSharedPool(): any
export declare function getVisitorId(req: IncomingMessage): string | null
