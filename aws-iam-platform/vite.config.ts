import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { createKyubiHandler } from './server/kyubi-api.mjs'
import { createProfileHandler } from './server/profile-api.mjs'
import { createQuizHandler } from './server/quiz-api.mjs'

// KYUBI: keeps the Gemini key on the server in dev, preview and production.
function kyubiApi(): Plugin {
  return {
    name: 'kyubi-api',
    configureServer(server) {
      server.middlewares.use(createProfileHandler())
      server.middlewares.use(createQuizHandler())
      server.middlewares.use(createKyubiHandler())
    },
    configurePreviewServer(server) {
      server.middlewares.use(createProfileHandler())
      server.middlewares.use(createQuizHandler())
      server.middlewares.use(createKyubiHandler())
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), kyubiApi()],
})
