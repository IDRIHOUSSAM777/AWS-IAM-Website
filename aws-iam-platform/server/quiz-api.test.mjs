import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { createQuizApi, pickAssignments, toPublicQuestion } from './quiz-api.mjs'
import { QUIZ_BANK, QUIZ_SIZE } from './quiz-bank.mjs'

// A tiny in-memory stand-in for the database, just enough for the quiz queries.
function fakeDb() {
  const rows = []
  const pool = {
    async execute(sql, p = []) {
      if (sql.startsWith('SELECT slot')) return [rows.filter((r) => r.session_id === p[0]).sort((x, y) => x.slot - y.slot)]
      if (sql.startsWith('INSERT IGNORE')) {
        for (let i = 0; i < p.length; i += 4) {
          if (!rows.some((r) => r.session_id === p[i] && r.slot === p[i + 1])) {
            rows.push({ session_id: p[i], slot: p[i + 1], question_key: p[i + 2], option_order: p[i + 3], chosen_index: null, is_correct: null, answered_at: null })
          }
        }
        return [{ affectedRows: 1 }]
      }
      if (sql.includes('UPDATE quiz_assignments')) {
        const r = rows.find((x) => x.session_id === p[2] && x.slot === p[3] && !x.answered_at)
        if (!r) return [{ affectedRows: 0 }]
        Object.assign(r, { chosen_index: p[0], is_correct: p[1], answered_at: new Date() })
        return [{ affectedRows: 1 }]
      }
      throw new Error('unexpected sql ' + sql)
    },
  }
  return { pool, rows }
}

function call(api, method, url, session, body) {
  return new Promise((resolve) => {
    const req = new EventEmitter()
    const headers = { host: 'x' }
    if (session) headers['x-quiz-session'] = session
    Object.assign(req, { method, url, headers })
    const res = { writeHead(status) { this.status = status }, end(text) { resolve({ status: this.status, body: JSON.parse(text) }) } }
    api.handler(req, res)
    setImmediate(() => { if (body) req.emit('data', JSON.stringify(body)); req.emit('end') })
  })
}

test('each anonymous session gets 9 different questions with shuffled answers', () => {
  const picks = pickAssignments()
  assert.equal(picks.length, QUIZ_SIZE)
  assert.equal(new Set(picks.map((p) => p.key)).size, QUIZ_SIZE)
  for (const p of picks) assert.deepEqual([...p.order].sort(), [0, 1, 2])
})

test('quiz flow: anonymous session, answer once, point only for the right answer', async () => {
  const { pool, rows } = fakeDb()
  const api = createQuizApi({ getPool: () => pool })

  const first = await call(api, 'GET', '/api/quiz')
  assert.equal(first.status, 200)
  assert.match(first.body.session, /^[0-9a-f-]{36}$/)
  assert.equal(first.body.questions.length, 9)
  assert.equal(first.body.questions[0].correct, null, 'right answer must stay hidden')
  assert.equal('name' in first.body, false, 'no visitor name in the quiz payload')

  const session = first.body.session
  const second = await call(api, 'GET', '/api/quiz', session)
  assert.deepEqual(second.body.questions.map((q) => q.text), first.body.questions.map((q) => q.text))

  const row = rows.find((r) => r.slot === 1)
  const item = QUIZ_BANK.find((q) => q.key === row.question_key)
  const order = row.option_order.split(',').map(Number)
  const right = order.indexOf(item.answer)
  const ok = await call(api, 'POST', '/api/quiz/answer', session, { slot: 1, choice: right })
  assert.equal(ok.body.question.isCorrect, true)
  assert.equal(ok.body.score, 1)
  const again = await call(api, 'POST', '/api/quiz/answer', session, { slot: 1, choice: (right + 1) % 3 })
  assert.equal(again.body.alreadyAnswered, true)
  assert.equal(again.body.score, 1, 'no second point')

  const wrong = await call(api, 'POST', '/api/quiz/answer', session, { slot: 2, choice: order.length + 5 })
  assert.equal(wrong.status, 400)
})

test('the removed leaderboard endpoint is no longer served', async () => {
  const { pool } = fakeDb()
  const api = createQuizApi({ getPool: () => pool })
  const board = await call(api, 'GET', '/api/leaderboard')
  assert.equal(board.status, 404)
})

test('answers require an existing anonymous session', async () => {
  const { pool } = fakeDb()
  const api = createQuizApi({ getPool: () => pool })
  const missing = await call(api, 'POST', '/api/quiz/answer', null, { slot: 1, choice: 0 })
  assert.equal(missing.status, 400)
})

test('toPublicQuestion hides the answer until answered', () => {
  const item = QUIZ_BANK[0]
  const hidden = toPublicQuestion({ slot: 1, question_key: item.key, option_order: '0,1,2', chosen_index: null, is_correct: null })
  assert.equal(hidden.explanation, null)
})
