import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { createKyubiHandler } from './kyubi-api.mjs'
import { createQuizHandler } from './quiz-api.mjs'

const root = process.cwd()
const dist = resolve(root, 'dist')
const port = Number(process.env.PORT) || 4173
const host = process.env.HOST || '127.0.0.1'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

if (!existsSync(dist)) {
  console.error('dist/ is missing. Run "npm run build" first.')
  process.exit(1)
}

const kyubi = createKyubiHandler({ root })
const quiz = createQuizHandler()

function serveFile(res, file, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('Cache-Control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  createReadStream(file).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    if ((req.url ?? '').startsWith('/api/')) {
      await quiz(req, res, () => kyubi(req, res))
      if (!res.writableEnded) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'Not found.' }))
      }
      return
    }

    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0])
    let file = resolve(dist, `.${pathname}`)
    if (!file.startsWith(dist)) {
      res.statusCode = 403
      res.end('Forbidden')
      return
    }
    if (existsSync(file) && statSync(file).isFile()) {
      serveFile(res, file)
      return
    }
    serveFile(res, resolve(dist, 'index.html'))
  } catch (error) {
    console.error('[server]', error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Internal server error')
  }
})

server.listen(port, host, () => {
  console.log(`aws-iam-platform running at http://${host}:${port}`)
})
