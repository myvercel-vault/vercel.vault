const encoder = new TextEncoder()
const jsonTypes = /^application\/json\s*(?:;|$)/i
const scope = 'my-vercel-vault/v1'
const MAX_BODY_BYTES = 206_000
const SESSION_MS = 2 * 60 * 60 * 1000
const BUCKET_MS = 10 * 60 * 1000
const originSite = request => new URL(request.url).origin
const responseHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }

function json(value, status = 200, headers = {}) {
  return Response.json(value, { status, headers: { ...responseHeaders, ...headers } })
}
function fail(status, error) { return json({ error }, status) }
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromBase64url(value) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) }
const base64Length = (value, length) => typeof value === 'string' && value.length === length && /^[A-Za-z0-9_-]+$/.test(value)
const emailValid = email => typeof email === 'string' && email.length > 3 && email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)
const envelopeValid = ({ iv, data }) => base64Length(iv, 16) && typeof data === 'string' && data.length >= 22 && data.length <= 200_022 && data.length % 4 !== 1 && /^[A-Za-z0-9_-]+$/.test(data)
const digest = async value => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))))
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)))
const hmacKey = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign', 'verify'])
const macInput = (purpose, ...parts) => encoder.encode([scope, purpose, ...parts].join('\0'))
const sign = (key, purpose, ...parts) => crypto.subtle.sign('HMAC', key, macInput(purpose, ...parts))
const check = (key, signature, purpose, ...parts) => crypto.subtle.verify('HMAC', key, fromBase64url(signature), macInput(purpose, ...parts))
const statement = (env, sql, ...params) => env.DB.prepare(sql).bind(...params)

async function readJson(request) {
  if (!jsonTypes.test(request.headers.get('Content-Type') || '')) throw 415
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) throw 413
  if (!request.body) throw 400
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal:true })
  let length = 0, text = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_BODY_BYTES) { void reader.cancel().catch(() => {}); throw 413 }
      text += decoder.decode(value, { stream:true })
    }
    text += decoder.decode()
    const body = JSON.parse(text)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw 400
    return body
  } catch (error) { if (error === 413) throw error; throw 400 }
  finally { reader.releaseLock() }
}
async function limit(env, key, kind, value, maximum, now) {
  const identity = base64url(new Uint8Array(await sign(key, 'limit', kind, value)))
  const bucket = Math.floor(now / BUCKET_MS)
  const row = await statement(env,
    `INSERT INTO rate_limits (scope, bucket, hits) VALUES (?, ?, 1)
    ON CONFLICT (scope, bucket) DO UPDATE SET hits = MIN(hits + 1, 1000000)
    RETURNING hits`, identity, bucket).first()
  return row.hits <= maximum
}
const slow = () => json({ error: 'Too many requests. Wait a few minutes and try again.' }, 429, { 'Retry-After': '600' })
async function newSession(env, email, now) {
  const token = random()
  await statement(env, 'INSERT INTO sessions (token_hash, email, expires) VALUES (?, ?, ?)', await digest(token), email, now + SESSION_MS).run()
  return token
}
async function sessionFrom(request, env, now) {
  const header = request.headers.get('Authorization') || ''
  if (!/^Bearer [A-Za-z0-9_-]{43}$/.test(header)) return null
  const hash = await digest(header.slice(7))
  const session = await statement(env, 'SELECT email FROM sessions WHERE token_hash = ? AND expires > ?', hash, now).first()
  return session ? { email:session.email, hash } : null
}

async function api(request, env, path) {
  const origin = request.headers.get('Origin')
  if ((origin && origin !== originSite(request)) || ['cross-site', 'same-site'].includes(request.headers.get('Sec-Fetch-Site'))) return fail(403, 'Open the vault on its own website.')
  const method = request.method
  const key = await hmacKey(env.VAULT_PEPPER)
  const now = Date.now()
  const ip = request.headers.get('CF-Connecting-IP') || 'local'
  if (path === '/api/health' && method === 'GET') {
    await statement(env, 'SELECT 1 FROM accounts LIMIT 1').all()
    return json({ ok:true })
  }

  if (method === 'POST' && ['/api/salt','/api/login','/api/register'].includes(path)) {
    const mode = path.slice(5)
    if (!(await limit(env, key, `${mode}/ip`, ip, mode === 'register' ? 12 : 120, now))) return slow()
    const body = await readJson(request)
    const { email, salt, proof } = body
    if (!emailValid(email)) return fail(400, 'Enter a valid email address.')
    if (mode === 'salt') {
      const row = await statement(env, 'SELECT salt FROM accounts WHERE email = ?', email).first()
      const alternate = new Uint8Array(await sign(key, 'placeholder-salt', email)).slice(0, 16)
      return json({ salt: row?.salt || base64url(alternate) })
    }
    if (!base64Length(proof, 43)) return fail(400, 'Invalid authentication data.')
    if (!(await limit(env, key, `${mode}/account`, email, mode === 'register' ? 5 : 12, now))) return slow()
    if (mode === 'register') {
      if (env.REGISTRATION_OPEN !== 'true') return fail(403, 'New account registration is currently closed.')
      if (!base64Length(salt, 22) || !envelopeValid(body)) return fail(400, 'Invalid encrypted vault.')
      const verifier = base64url(new Uint8Array(await sign(key, 'verifier', email, salt, proof)))
      const inserted = await statement(env,
        'INSERT OR IGNORE INTO accounts (email, salt, verifier, iv, ciphertext, updated) VALUES (?, ?, ?, ?, ?, ?)',
        email, salt, verifier, body.iv, body.data, now).run()
      if (!inserted.meta.changes) return fail(409, 'Could not create that account. If this is your email, try unlocking your vault.')
      return json({ token:await newSession(env, email, now), revision:1, updated:now }, 201)
    }
    const row = await statement(env, 'SELECT salt, verifier, iv, ciphertext, revision, updated FROM accounts WHERE email = ?', email).first()
    const ok = await check(key, row?.verifier || 'A'.repeat(43), 'verifier', email, row?.salt || 'A'.repeat(22), proof)
    if (!row || !ok) return fail(401, 'The email or master passphrase is incorrect.')
    return json({ token:await newSession(env, email, now), revision:row.revision, iv:row.iv, data:row.ciphertext, updated:row.updated })
  }

  if (['/api/vault','/api/logout','/api/account'].includes(path)) {
    const session = await sessionFrom(request, env, now)
    if (!session) return fail(401, 'Your vault session has ended.')
    const { email, hash } = session
    if (path === '/api/logout' && method === 'POST') {
      await statement(env, 'DELETE FROM sessions WHERE token_hash = ?', hash).run()
      return json({ ok:true })
    }
    if (path === '/api/vault' && method === 'PUT') {
      if (!(await limit(env, key, 'write/account', email, 180, now))) return slow()
      const body = await readJson(request)
      if (!envelopeValid(body) || !Number.isSafeInteger(body.revision) || body.revision < 1) return fail(400, 'Invalid encrypted vault.')
      const result = await statement(env, 'UPDATE accounts SET iv = ?, ciphertext = ?, revision = revision + 1, updated = ? WHERE email = ? AND revision = ?', body.iv, body.data, now, email, body.revision).run()
      if (!result.meta.changes) return fail(409, 'Your vault changed on another device. Lock and unlock again before saving. Your changes were not saved.')
      return json({ revision:body.revision + 1, updated:now })
    }
    if (path === '/api/account' && method === 'DELETE') {
      if (!(await limit(env, key, 'delete/account', email, 5, now))) return slow()
      const { proof } = await readJson(request)
      const row = await statement(env, 'SELECT salt, verifier FROM accounts WHERE email = ?', email).first()
      if (!row || !base64Length(proof, 43) || !(await check(key, row.verifier, 'verifier', email, row.salt, proof))) return fail(401, 'The master passphrase is incorrect.')
      await statement(env, 'DELETE FROM accounts WHERE email = ?', email).run()
      return json({ ok:true })
    }
  }
  return fail(404, 'This API route does not exist.')
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname
    if (path !== '/api' && !path.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found.', { status:404 })
    if (!env.DB || !env.VAULT_PEPPER || env.VAULT_PEPPER.length < 32) return fail(503, 'The vault service is not configured.')
    try { return await api(request, env, path) }
    catch (error) {
      if (error === 400) return fail(400, 'The request body is not valid.')
      if (error === 413) return fail(413, 'The encrypted request is too large.')
      if (error === 415) return fail(415, 'Send the body as application/json.')
      console.error('Vault API internal error', request.method, path)
      return fail(500, 'The vault service could not complete the request.')
    }
  },
  async scheduled(_event, env) {
    const now = Date.now()
    await env.DB.batch([
      statement(env, 'DELETE FROM sessions WHERE expires <= ?', now),
      statement(env, 'DELETE FROM rate_limits WHERE bucket < ?', Math.floor(now / BUCKET_MS) - 1),
    ])
  },
}
