import { media } from './config.js'

export const sets = {
  lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789', symbols: '!@#$%^&*()-_=+[]{}:;,.?/',
}
let modulePromise
export async function passwordModule() {
  if (!modulePromise) modulePromise = (async () => {
    const response = await fetch(media('password.wasm'))
    if (!response.ok) throw new Error('Password generator failed to load. Try refreshing the page.')
    const { instance } = await WebAssembly.instantiate(await response.arrayBuffer())
    return instance.exports
  })().catch(error => { modulePromise = null; throw error })
  return modulePromise
}
export async function generatePassword(length, selected) {
  if (!Number.isInteger(length) || length < 8 || length > 96) throw new Error('Choose a length between 8 and 96.')
  const alphabets = Object.keys(sets).filter(key => selected[key]).map(key => sets[key])
  if (!alphabets.length) throw new Error('Select at least one character set.')
  const { sample_index } = await passwordModule()
  const pool = new Uint32Array(128)
  let offset = pool.length
  const index = (max) => {
    let result
    do {
      if (offset === pool.length) { crypto.getRandomValues(pool); offset = 0 }
      result = sample_index(pool[offset++], max)
    } while (result < 0)
    return result
  }
  const alphabet = alphabets.join('')
  const password = alphabets.map(s => s[index(s.length)])
  while (password.length < length) password.push(alphabet[index(alphabet.length)])
  for (let i = password.length - 1; i > 0; i--) {
    const j = index(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }
  pool.fill(0)
  return password.join('')
}
export function basicPasswordCheck(value, classify) {
  let classes = 0
  for (const ch of value) {
    const code = ch.codePointAt(0)
    classes |= classify ? classify(code) : /[a-z]/.test(ch) ? 1 : /[A-Z]/.test(ch) ? 2 : /[0-9]/.test(ch) ? 4 : 8
  }
  const diverse = (classes.toString(2).match(/1/g) || []).length
  return [...value].length < 12 || (value.length < 20 && diverse < 2) || /(.)\1{5}/u.test(value)
}
