import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SYSTEM_PROMPT } from './kyubi-system-prompt.mjs'

const DEFAULT_MODEL = 'gemini-3.5-flash-lite'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const ENDPOINT = '/api/kyubi'
const MAX_BODY_BYTES = 96 * 1024
const MAX_MESSAGES = 14
const MAX_MESSAGE_CHARS = 4000
const RATE_WINDOW_MS = 5 * 60 * 1000
const RATE_MAX = 40

/**
 * Minimal .env reader: no dependency. `.env` is applied first and `.env.local` last, so
 * `.env.local` wins when both define the same name. The files are re-read on every call:
 * that is what lets an edited `.env` take effect after Vite restarts itself, instead of
 * keeping the previous key that is already sitting in `process.env`.
 */
export function loadEnvFiles(root = process.cwd()) {
  for (const name of ['.env', '.env.local']) {
    const file = resolve(root, name)
    if (!existsSync(file)) continue
    let raw = ''
    try {
      raw = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (!match) continue
      const key = match[1]
      let value = match[2].trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      } else {
        const hash = value.indexOf(' #')
        if (hash !== -1) value = value.slice(0, hash).trim()
      }
      process.env[key] = value
    }
  }
}

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value)
  res.end(body)
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isSameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  if (!host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function normalizeMessages(input) {
  if (!Array.isArray(input)) return null
  const messages = []
  for (const entry of input.slice(-MAX_MESSAGES)) {
    if (!entry || typeof entry !== 'object') return null
    const role = entry.role === 'assistant' ? 'model' : entry.role === 'user' ? 'user' : null
    const content = typeof entry.content === 'string' ? entry.content.trim() : ''
    if (!role || !content) return null
    messages.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) })
  }
  while (messages.length && messages[0].role !== 'user') messages.shift()
  if (!messages.length) return null
  return messages
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return ''
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim()
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress ?? 'unknown'
}

export function createKyubiHandler({ root = process.cwd() } = {}) {
  loadEnvFiles(root)
  const hits = new Map()

  return async function kyubiMiddleware(req, res, next) {
    // Cheap and idempotent: pick up a `.env` the teammate just edited, without any restart.
    loadEnvFiles(root)

    const path = (req.url ?? '').split('?')[0]
    if (path !== ENDPOINT) {
      if (typeof next === 'function') return next()
      sendJson(res, 404, { error: { code: 'not_found', message: 'Not found' } })
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: { code: 'method_not_allowed', message: 'Use POST.' } }, { Allow: 'POST' })
      return
    }

    if (!isSameOrigin(req)) {
      sendJson(res, 403, { error: { code: 'forbidden_origin', message: 'Cross-origin requests are not allowed.' } })
      return
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
      sendJson(res, 503, {
        error: {
          code: 'not_configured',
          message:
            'Kyubi is not connected yet. Add GEMINI_API_KEY to the .env file of aws-iam-platform and restart the server.',
        },
      })
      return
    }

    const now = Date.now()
    const ip = clientIp(req)
    const recent = (hits.get(ip) ?? []).filter((time) => now - time < RATE_WINDOW_MS)
    if (recent.length >= RATE_MAX) {
      sendJson(
        res,
        429,
        { error: { code: 'rate_limited', message: 'Too many messages in a short time. Please wait a minute and try again.' } },
        { 'Retry-After': '60' },
      )
      return
    }
    recent.push(now)
    hits.set(ip, recent)
    if (hits.size > 500) {
      for (const [key, times] of hits) {
        if (!times.some((time) => now - time < RATE_WINDOW_MS)) hits.delete(key)
      }
    }

    let payload
    try {
      payload = JSON.parse(await readBody(req))
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'payload-too-large'
      sendJson(res, tooLarge ? 413 : 400, {
        error: {
          code: tooLarge ? 'payload_too_large' : 'invalid_json',
          message: tooLarge ? 'That message is too long.' : 'The request body must be valid JSON.',
        },
      })
      return
    }

    const messages = normalizeMessages(payload?.messages)
    if (!messages) {
      sendJson(res, 400, {
        error: { code: 'invalid_messages', message: 'Send a non-empty messages array of user and assistant turns.' },
      })
      return
    }

    const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
    const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: messages.map(({ role, content }) => ({ role, parts: [{ text: content }] })),
      generationConfig: { temperature: 0.65, topP: 0.95, maxOutputTokens: 2048 },
    })

    let upstream
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        upstream = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: requestBody,
          signal: AbortSignal.timeout(60_000),
        })
      } catch (error) {
        const timedOut = error instanceof Error && error.name === 'TimeoutError'
        sendJson(res, timedOut ? 504 : 502, {
          error: {
            code: timedOut ? 'upstream_timeout' : 'upstream_unreachable',
            message: timedOut
              ? 'Kyubi took too long to answer. Please try again.'
              : 'Kyubi could not reach the AI service. Check the server connection and try again.',
          },
        })
        return
      }
      // Google occasionally answers 503/429 for a moment; one quiet retry usually succeeds.
      const retryable = upstream.status === 503 || upstream.status === 429
      if (upstream.ok || !retryable || attempt === 1) break
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error(`[kyubi] Gemini ${upstream.status}: ${detail.slice(0, 400)}`)
      const invalidKey =
        upstream.status === 401 || upstream.status === 403 || detail.includes('API_KEY_INVALID')
      const badModel = upstream.status === 404 || detail.includes('NOT_FOUND')
      const quota = upstream.status === 429
      const busy = upstream.status === 503
      sendJson(res, invalidKey ? 502 : quota ? 429 : busy ? 503 : 502, {
        error: {
          code: invalidKey
            ? 'invalid_api_key'
            : badModel
              ? 'model_unavailable'
              : quota
                ? 'quota_exceeded'
                : busy
                  ? 'model_busy'
                  : 'upstream_error',
          message: invalidKey
            ? 'The Gemini API key was rejected. Check GEMINI_API_KEY on the server.'
            : badModel
              ? `The model "${model}" is not available for this key. Set GEMINI_MODEL to a supported model.`
              : quota
                ? 'The Gemini quota for this key is exhausted right now. Try again in a moment.'
                : busy
                  ? 'Kyubi is in high demand right now. Please send that again in a moment.'
                  : 'The AI service returned an error. Please try again.',
        },
      })
      return
    }

    let data
    try {
      data = await upstream.json()
    } catch {
      sendJson(res, 502, { error: { code: 'bad_response', message: 'The AI service returned an unreadable answer.' } })
      return
    }

    const reply = extractText(data)
    if (!reply) {
      const blocked = data?.promptFeedback?.blockReason
      sendJson(res, 200, {
        reply: blocked
          ? "I can't answer that one. Let's keep it to AWS, IAM and this website. 🦊"
          : 'I did not get an answer for that. Could you rephrase your AWS IAM question?',
      })
      return
    }

    sendJson(res, 200, { reply })
  }
}
