const encoder = new TextEncoder()
const decoder = new TextDecoder('utf-8', { fatal: true })
export const KDF_ROUNDS = 600_000
export const MAX_PAYLOAD = 150_000

export function base64url(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('The encrypted file is not valid.')
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
}
export const randomSalt = () => base64url(crypto.getRandomValues(new Uint8Array(16)))
export const cleanEmail = (email) => email.trim().toLowerCase()
export const validEmail = email => email.length > 3 && email.length <= 254 && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)

export async function deriveSecrets(passphrase, salt, email, withProof = true) {
  if (!globalThis.crypto?.subtle) throw new Error('An HTTPS connection or localhost is required to unlock a vault.')
  const saltBytes = fromBase64url(salt)
  if (saltBytes.byteLength !== 16) throw new Error('The vault settings are not valid.')
  const rootInput = encoder.encode(passphrase)
  let rootBits
  try {
    const material = await crypto.subtle.importKey('raw', rootInput, 'PBKDF2', false, ['deriveBits'])
    rootBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: KDF_ROUNDS }, material, 256)
    const root = await crypto.subtle.importKey('raw', rootBits, 'HKDF', false, ['deriveBits', 'deriveKey'])
    const params = (purpose) => ({ name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: encoder.encode(`my-vercel-vault/v1/${purpose}/${email}`) })
    const key = await crypto.subtle.deriveKey(params('encryption'), root, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    if (!withProof) return { key }
    const proofBytes = new Uint8Array(await crypto.subtle.deriveBits(params('authentication'), root, 256))
    const proof = base64url(proofBytes)
    proofBytes.fill(0)
    return { key, proof }
  } finally {
    rootInput.fill(0)
    if (rootBits) new Uint8Array(rootBits).fill(0)
  }
}
const aad = email => encoder.encode(`my-vercel-vault/v1/data/${email}`)
export async function seal(value, key, email) {
  const bytes = encoder.encode(JSON.stringify(value))
  if (bytes.byteLength > MAX_PAYLOAD) throw new Error('This vault has reached its size limit. Remove unused items before saving more.')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  try {
    const result = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(email) }, key, bytes)
    return { iv: base64url(iv), data: base64url(result) }
  } finally { bytes.fill(0) }
}
export async function unseal(envelope, key, email) {
  if (!envelope || typeof envelope.data !== 'string' || envelope.data.length > 200_022) throw new Error('The encrypted vault is not valid.')
  let result
  try {
    const iv = fromBase64url(envelope.iv)
    if (iv.byteLength !== 12) throw new Error()
    result = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(email) }, key, fromBase64url(envelope.data))
    return JSON.parse(decoder.decode(result))
  } catch { throw new Error('The vault could not be decrypted with those details.') }
  finally { if (result) new Uint8Array(result).fill(0) }
}
