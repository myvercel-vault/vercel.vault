import { reactive } from 'vue'
import { cleanEmail, deriveSecrets, randomSalt, seal, unseal, validEmail } from './crypto.js'
import { emptyDocument, normalizeDocument } from './items.js'

export const vault = reactive({ open: false, email: '', doc: emptyDocument(), synced: 0 })
let key, salt, token, revision, lockHandler, lockTimer
let generation = 0
let saveQueue = Promise.resolve()
const api = '/api'

async function request(path, { method = 'GET', body, auth } = {}) {
  let res
  try {
    res = await fetch(api + path, {
      method, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch { throw new Error('Could not reach the vault service. Try again shortly.') }
  let data
  try { data = await res.json() } catch { throw new Error('The vault service is unavailable.') }
  if (!res.ok) {
    const error = new Error(data.error || 'The request could not be completed.')
    error.status = res.status
    throw error
  }
  return data
}
export const getServiceStatus = () => request('/health')
function openSession(email, secrets, kdfSalt, session, doc) {
  generation++
  saveQueue = Promise.resolve()
  key = secrets.key; token = session.token; salt = kdfSalt; revision = session.revision
  vault.email = email; vault.doc = doc; vault.synced = session.updated || Date.now(); vault.open = true
}
export async function registerAccount(rawEmail, passphrase) {
  const email = cleanEmail(rawEmail)
  if (!validEmail(email)) throw new Error('Enter a valid email address.')
  if ([...passphrase].length < 12 || passphrase.length > 256) throw new Error('Use a master passphrase of 12–256 characters.')
  const kdfSalt = randomSalt()
  const secrets = await deriveSecrets(passphrase, kdfSalt, email)
  const doc = emptyDocument()
  const envelope = await seal(doc, secrets.key, email)
  const session = await request('/register', { method: 'POST', body: { email, proof: secrets.proof, salt: kdfSalt, ...envelope } })
  openSession(email, secrets, kdfSalt, session, doc)
}
export async function unlockAccount(rawEmail, passphrase) {
  const email = cleanEmail(rawEmail)
  if (!validEmail(email) || !passphrase || passphrase.length > 256) throw new Error('Enter your email and master passphrase.')
  const { salt: kdfSalt } = await request('/salt', { method: 'POST', body: { email } })
  const secrets = await deriveSecrets(passphrase, kdfSalt, email)
  const session = await request('/login', { method: 'POST', body: { email, proof: secrets.proof } })
  try {
    const doc = normalizeDocument(await unseal(session, secrets.key, email))
    openSession(email, secrets, kdfSalt, session, doc)
  } catch (error) {
    request('/logout', { method: 'POST', auth: session.token }).catch(() => {})
    throw error
  }
}
export function updateVault(makeChange) {
  const started = generation
  const pending = saveQueue.then(async () => {
    if (!vault.open || started !== generation) throw new Error('Your vault is locked. Unlock it before saving.')
    const doc = JSON.parse(JSON.stringify(vault.doc))
    makeChange(doc)
    const clean = normalizeDocument(doc)
    const envelope = await seal(clean, key, vault.email)
    if (!vault.open || started !== generation) throw new Error('Your vault is locked. Unlock it before saving.')
    try {
      const updated = await request('/vault', { method: 'PUT', auth: token, body: { ...envelope, revision } })
      if (started === generation) {
        revision = updated.revision; vault.doc = clean; vault.synced = updated.updated
      }
      return clean
    } catch (error) {
      if (started === generation && error.status === 401) lockHandler?.('Your session expired. Unlock your vault to continue.')
      throw error
    }
  })
  saveQueue = pending.catch(() => {})
  return pending
}
export async function closeVault() {
  generation++
  const auth = token
  token = null; key = null; salt = null; revision = null
  vault.open = false; vault.email = ''; vault.doc = emptyDocument(); vault.synced = 0
  if (auth) {
    try { await request('/logout', { method: 'POST', auth }) } catch { /* Session will expire on the server. */ }
  }
}
export function watchInactivity(handler) {
  lockHandler = handler
  let lastActive = Date.now()
  const events = ['pointerdown', 'keydown', 'touchstart']
  const tick = () => {
    if (!vault.open) return
    if (Date.now() - lastActive >= vault.doc.prefs.lockMinutes * 60_000) {
      handler('Your vault locked after a period of inactivity.')
    }
  }
  const reset = () => {
    tick()
    if (vault.open) lastActive = Date.now()
  }
  events.forEach(event => window.addEventListener(event, reset, { passive: true, capture: true }))
  document.addEventListener('visibilitychange', tick)
  lockTimer = setInterval(tick, 1000)
  return () => {
    clearInterval(lockTimer)
    events.forEach(event => window.removeEventListener(event, reset, { capture: true }))
    document.removeEventListener('visibilitychange', tick)
    if (lockHandler === handler) lockHandler = null
  }
}
export async function exportBackup() {
  if (!vault.open) throw new Error('Unlock your vault to make a backup.')
  const email = vault.email
  const kdfSalt = salt
  const envelope = await seal(vault.doc, key, email)
  return { format: 'my-vercel-vault/1', email, salt: kdfSalt, ...envelope }
}
export async function readBackup(file, passphrase) {
  if (!file || file.size > 201_000) throw new Error('Choose a valid vault backup file.')
  let data
  try { data = JSON.parse(await file.text()) } catch { throw new Error('Choose a valid vault backup file.') }
  if (data?.format !== 'my-vercel-vault/1' || !validEmail(data.email || '')) throw new Error('This is not a supported vault backup.')
  if (data.email !== vault.email) throw new Error('Unlock the account that owns this backup first.')
  const { key: backupKey } = await deriveSecrets(passphrase, data.salt, data.email, false)
  return normalizeDocument(await unseal(data, backupKey, data.email))
}
export async function deleteAccount(passphrase) {
  const auth = token
  if (!vault.open) throw new Error('Unlock your vault first.')
  const { proof } = await deriveSecrets(passphrase, salt, vault.email)
  await request('/account', { method: 'DELETE', auth, body: { proof } })
  await closeVault()
}
