// Run with the database settings from .env:
//   node --env-file=.env --test server/profile-api.test.mjs
// It writes and then deletes its own test rows in the visitors table.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { cleanName, createProfileApi, dbConfigFromEnv } from './profile-api.mjs'

let server
let base
let api
const cleanup = []

const listen = (handlerApi) =>
  new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      handlerApi.handler(req, res, () => { res.writeHead(404); res.end() })
    })
    s.listen(0, '127.0.0.1', () => resolve(s))
  })

before(async () => {
  api = createProfileApi()
  server = await listen(api)
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  for (const cookie of cleanup) await call('DELETE', { cookie })
  server.close()
  await api.close()
})

const call = (method, { body, cookie, headers, url = base } = {}) =>
  fetch(`${url}/api/profile`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

const save = async (name) => {
  const res = await call('POST', { body: { name } })
  const cookie = res.headers.get('set-cookie')?.split(';')[0]
  if (cookie) cleanup.push(cookie)
  return { res, cookie }
}

test('cleanName keeps names readable and strips risky characters', () => {
  assert.equal(cleanName('  Sara   B  '), 'Sara B')
  assert.equal(cleanName('Sara<script>'), 'Sarascript')
  assert.equal(cleanName('"; DROP TABLE visitors; --'), 'DROP TABLE visitors --')
  assert.equal(cleanName("Jean-Luc O'Neil"), "Jean-Luc O'Neil")
  assert.equal(cleanName('علاء'), 'علاء')
  assert.equal(cleanName('x'.repeat(80)).length, 30)
})

test('new visitor has no name', async () => {
  assert.equal((await (await call('GET')).json()).name, null)
})

test('rejects names that are too short', async () => {
  assert.equal((await call('POST', { body: { name: 'a' } })).status, 400)
  assert.equal((await call('POST', { body: { name: '<>' } })).status, 400)
})

test('full flow: save, read, rename, delete', async () => {
  const { res, cookie } = await save('Sara')
  assert.equal(res.status, 200)
  assert.equal((await res.json()).name, 'Sara')
  assert.match(res.headers.get('set-cookie'), /HttpOnly/)

  assert.equal((await (await call('GET', { cookie })).json()).name, 'Sara')

  await call('POST', { body: { name: 'Sarah' }, cookie })
  assert.equal((await (await call('GET', { cookie })).json()).name, 'Sarah')

  const removed = await call('DELETE', { cookie })
  assert.equal(removed.status, 200)
  assert.equal((await removed.json()).name, null)
  assert.match(removed.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal((await (await call('GET', { cookie })).json()).name, null)
})

test('names with quotes, accents and Arabic are stored safely', async () => {
  for (const name of ["O'Neil", 'Zoë', 'علاء']) {
    const { res, cookie } = await save(name)
    assert.equal((await res.json()).name, name)
    assert.equal((await (await call('GET', { cookie })).json()).name, name)
  }
})

test('DELETE without a cookie still succeeds', async () => {
  assert.equal((await call('DELETE')).status, 200)
})

test('cross-origin DELETE and POST are refused', async () => {
  const headers = { Origin: 'https://evil.example' }
  assert.equal((await call('DELETE', { headers })).status, 403)
  assert.equal((await call('POST', { body: { name: 'Sara' }, headers })).status, 403)
})

test('POST needs JSON and other methods are refused', async () => {
  const res = await fetch(`${base}/api/profile`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hi' })
  assert.equal(res.status, 415)
  assert.equal((await call('PUT')).status, 405)
})

test('getVisitorName reads the name from the cookie (used by KYUBI)', async () => {
  const { cookie } = await save('Alaa')
  assert.equal(await api.getVisitorName({ headers: { cookie } }), 'Alaa')
  assert.equal(await api.getVisitorName({ headers: {} }), null)
})

test('other URLs are passed on', async () => {
  assert.equal((await fetch(`${base}/api/other`)).status, 404)
})

test('database problems give a clear 503 and never break getVisitorName', async () => {
  const good = dbConfigFromEnv()
  const cases = [
    ['wrong password', { ...good, password: 'definitely-wrong' }, /Cannot connect to MySQL/],
    ['unknown database', { ...good, database: 'no_such_database_xyz' }, /Cannot connect to MySQL|not set up/],
    ['server down', { ...good, port: 1 }, /Cannot connect to MySQL/],
  ]
  for (const [label, config, message] of cases) {
    const broken = createProfileApi(() => config)
    const s = await listen(broken)
    const url = `http://127.0.0.1:${s.address().port}`
    const res = await call('GET', { url })
    assert.equal(res.status, 503, label)
    assert.match((await res.json()).error, message, label)
    assert.equal(await broken.getVisitorName({ headers: { cookie: 'visitor_id=00000000-0000-0000-0000-000000000000' } }), null, label)
    s.close()
    await broken.close()
  }
})
