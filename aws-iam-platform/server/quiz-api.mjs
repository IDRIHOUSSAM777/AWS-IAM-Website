import { QUIZ_BANK, QUIZ_SIZE } from './quiz-bank.mjs'
import { getSharedPool, getVisitorId } from './profile-api.mjs'

const BY_KEY = new Map(QUIZ_BANK.map((item) => [item.key, item]))

const QUIZ_PATH = '/api/quiz'
const ANSWER_PATH = '/api/quiz/answer'
const BOARD_PATH = '/api/leaderboard'

const BOARD_PERIODS = new Set(['all', 'week', 'month', 'year'])
// Fixed SQL fragments (never built from user input): the board can be filtered to this
// calendar week, month or year. "all" keeps every answer ever saved.
const PERIOD_FILTERS = {
  week: " AND a.answered_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)",
  month: " AND a.answered_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')",
  year: ' AND a.answered_at >= MAKEDATE(YEAR(CURDATE()), 1)',
}

/** Fisher-Yates shuffle on a copy. `rand` can be replaced in tests. */
export function shuffle(list, rand = Math.random) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Nine different questions for one visitor, each with its own order of answers. */
export function pickAssignments(rand = Math.random) {
  return shuffle(QUIZ_BANK, rand)
    .slice(0, QUIZ_SIZE)
    .map((item, index) => ({
      slot: index + 1,
      key: item.key,
      order: shuffle(item.options.map((_, i) => i), rand),
    }))
}

function parseOrder(text, size) {
  const order = String(text ?? '').split(',').map(Number)
  const valid = order.length === size && new Set(order).size === size && order.every((n) => Number.isInteger(n) && n >= 0 && n < size)
  return valid ? order : null
}

/** What the browser may see. The right answer is only revealed once the question is answered. */
export function toPublicQuestion(row) {
  const item = BY_KEY.get(row.question_key)
  if (!item) return null
  const order = parseOrder(row.option_order, item.options.length)
  if (!order) return null
  const answered = row.chosen_index !== null && row.chosen_index !== undefined
  return {
    slot: Number(row.slot),
    text: item.q,
    options: order.map((i) => item.options[i]),
    answered,
    chosen: answered ? Number(row.chosen_index) : null,
    correct: answered ? order.indexOf(item.answer) : null,
    isCorrect: answered ? Number(row.is_correct) === 1 : null,
    explanation: answered ? item.explain : null,
  }
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(JSON.stringify(body))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 512) {
        reject(new Error('too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function sameOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return true
  try { return new URL(origin).host === req.headers.host } catch { return false }
}

const UNAVAILABLE = 'The quiz is not available at the moment. Please try again a little later.'
const DB_CODES = [
  'ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ECONNREFUSED', 'ENOTFOUND',
  'ETIMEDOUT', 'ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR',
]

/**
 * @param {{ getPool?: () => import('mysql2/promise').Pool, visitorIdFrom?: (req: any) => string | null }} deps
 * Both default to the shared database connection of the profile API.
 */
export function createQuizApi({ getPool = getSharedPool, visitorIdFrom = getVisitorId } = {}) {
  async function findVisitor(id) {
    if (!id) return null
    const [rows] = await getPool().execute('SELECT display_name FROM visitors WHERE id = ?', [id])
    return rows[0] ? { id, name: rows[0].display_name } : null
  }

  async function loadRows(id) {
    const [rows] = await getPool().execute(
      'SELECT slot, question_key, option_order, chosen_index, is_correct FROM quiz_assignments WHERE visitor_id = ? ORDER BY slot',
      [id],
    )
    return rows
  }

  // One single INSERT IGNORE: if two requests arrive together (a page opened twice), the first
  // one wins completely and the second one adds nothing, so nobody ends up with a mixed set.
  async function ensureAssignments(id) {
    let rows = await loadRows(id)
    if (rows.length > 0) return rows
    const picks = pickAssignments()
    const marks = picks.map(() => '(?, ?, ?, ?)').join(', ')
    const values = picks.flatMap((p) => [id, p.slot, p.key, p.order.join(',')])
    await getPool().execute(
      `INSERT IGNORE INTO quiz_assignments (visitor_id, slot, question_key, option_order) VALUES ${marks}`,
      values,
    )
    rows = await loadRows(id)
    return rows
  }

  function summarize(rows) {
    const questions = rows.map(toPublicQuestion).filter(Boolean)
    const answered = questions.filter((q) => q.answered).length
    const score = questions.filter((q) => q.isCorrect).length
    return { questions, answered, score, total: questions.length }
  }

  async function leaderboard(visitor, period = 'all') {
    const [rows] = await getPool().query(
      `SELECT v.id, v.display_name,
              COUNT(CASE WHEN a.is_correct = 1 THEN 1 END) AS score,
              COUNT(a.answered_at) AS answered,
              MAX(a.answered_at) AS last_at
         FROM visitors v
         JOIN quiz_assignments a ON a.visitor_id = v.id
        WHERE a.answered_at IS NOT NULL${PERIOD_FILTERS[period] ?? ''}
        GROUP BY v.id, v.display_name
        ORDER BY score DESC, answered ASC, last_at ASC
        LIMIT 200`,
    )
    const entries = rows.map((row, index) => ({
      rank: index + 1,
      name: row.display_name,
      score: Number(row.score),
      answered: Number(row.answered),
      isYou: Boolean(visitor) && row.id === visitor.id,
    }))
    let me = entries.find((entry) => entry.isYou) ?? null
    if (!me && visitor) me = { rank: null, name: visitor.name, score: 0, answered: 0, isYou: true }
    return { entries, me, players: entries.length, total: QUIZ_SIZE, period }
  }

  async function handler(req, res, next) {
    const path = (req.url ?? '').split('?')[0]
    if (path !== QUIZ_PATH && path !== ANSWER_PATH && path !== BOARD_PATH) {
      if (typeof next === 'function') return next()
      return send(res, 404, { error: 'Not found.' })
    }

    try {
      const visitor = await findVisitor(visitorIdFrom(req))

      if (path === BOARD_PATH) {
        if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' })
        const period = new URL(req.url ?? '/', 'http://localhost').searchParams.get('period') ?? 'all'
        if (!BOARD_PERIODS.has(period)) return send(res, 400, { error: 'Unknown leaderboard period.' })
        return send(res, 200, await leaderboard(visitor, period))
      }

      if (!visitor) {
        return send(res, 401, { error: 'Please choose a name first, so we can keep your score.' })
      }

      if (path === QUIZ_PATH) {
        if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.' })
        const summary = summarize(await ensureAssignments(visitor.id))
        return send(res, 200, { name: visitor.name, ...summary })
      }

      // ANSWER_PATH
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.' })
      if (!sameOrigin(req)) return send(res, 403, { error: 'This request is not allowed.' })
      let body
      try { body = await readJson(req) } catch { return send(res, 400, { error: 'Your answer could not be read.' }) }
      const slot = Number(body?.slot)
      const choice = Number(body?.choice)
      if (!Number.isInteger(slot) || !Number.isInteger(choice) || slot < 1 || slot > QUIZ_SIZE || choice < 0 || choice > 9) {
        return send(res, 400, { error: 'Please choose one of the answers.' })
      }

      const rows = await ensureAssignments(visitor.id)
      const row = rows.find((r) => Number(r.slot) === slot)
      if (!row) return send(res, 404, { error: 'This question was not found.' })
      const current = toPublicQuestion(row)
      if (!current) return send(res, 404, { error: 'This question was not found.' })
      if (choice >= current.options.length) return send(res, 400, { error: 'Please choose one of the answers.' })

      let alreadyAnswered = current.answered
      if (!alreadyAnswered) {
        const item = BY_KEY.get(row.question_key)
        const order = parseOrder(row.option_order, item.options.length)
        const isCorrect = order[choice] === item.answer
        // "answered_at IS NULL" guarantees one point at most, even if the button is pressed twice.
        const [result] = await getPool().execute(
          `UPDATE quiz_assignments
              SET chosen_index = ?, is_correct = ?, answered_at = CURRENT_TIMESTAMP
            WHERE visitor_id = ? AND slot = ? AND answered_at IS NULL`,
          [choice, isCorrect ? 1 : 0, visitor.id, slot],
        )
        if (!result.affectedRows) alreadyAnswered = true
      }

      const summary = summarize(await loadRows(visitor.id))
      const question = summary.questions.find((q) => q.slot === slot)
      return send(res, 200, { question, alreadyAnswered, score: summary.score, answered: summary.answered, total: summary.total })
    } catch (error) {
      console.error('[quiz-api]', error?.code ?? '', error?.message ?? error)
      if (DB_CODES.includes(error?.code)) return send(res, 503, { error: UNAVAILABLE })
      return send(res, 500, { error: 'Something went wrong on our side. Please try again in a moment.' })
    }
  }

  return { handler }
}

let shared
export const createQuizHandler = () => (req, res, next) => (shared ??= createQuizApi()).handler(req, res, next)
