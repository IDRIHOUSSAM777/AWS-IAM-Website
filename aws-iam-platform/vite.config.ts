import type { IncomingMessage, ServerResponse } from 'node:http'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createKyubiHandler } from './server/kyubi-api.mjs'
import { createQuizHandler } from './server/quiz-api.mjs'

// KYUBI: keeps the Gemini key on the server in dev, preview and production.
function kyubiApi(): Plugin {
  return {
    name: 'kyubi-api',
    configureServer(server) {
      server.middlewares.use(createQuizHandler())
      server.middlewares.use(createKyubiHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createQuizHandler())
      server.middlewares.use(createKyubiHandler())
    },
  }
}

// An unknown /api/ path must answer as an API, not with the single-page HTML fallback.
function apiNotFound(): Plugin {
  const middleware = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => {
    if (!(req.url ?? '').startsWith('/api/')) return next()
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Not found.' }))
  }
  return {
    name: 'api-not-found',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kyubiApi(), apiNotFound()],
})
