import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { webcrypto } from 'node:crypto'
import { base64url, deriveSecrets, fromBase64url, seal, unseal, validEmail } from '../src/crypto.js'
import { blankItem, emptyDocument, normalizeDocument } from '../src/items.js'
if (!globalThis.crypto) globalThis.crypto = webcrypto

const sampleEmail = 'test@example.test'
const salt = base64url(Uint8Array.from({length:16},(_,i) => i))
const phrase = 'Test fixture only 8! Not in use.'

test('encrypted vault round-trips without leaking plaintext, and uses fresh IVs', async () => {
  const { key, proof } = await deriveSecrets(phrase,salt,sampleEmail)
  assert.match(proof,/^[A-Za-z0-9_-]{43}$/)
  assert.equal(key.extractable,false)
  const payload = { item:'Sensitive test fixture', count:4 }
  const first = await seal(payload,key,sampleEmail)
  const second = await seal(payload,key,sampleEmail)
  assert.equal(fromBase64url(first.iv).byteLength,12)
  assert.notEqual(first.iv,second.iv)
  assert.ok(!JSON.stringify(first).includes(payload.item))
  assert.deepEqual(await unseal(first,key,sampleEmail),payload)
  await assert.rejects(unseal(first,key,'wrong@example.test'),/could not be decrypted/)
  const corrupt = fromBase64url(first.data); corrupt[0] ^= 1
  await assert.rejects(unseal({...first,data:base64url(corrupt)},key,sampleEmail),/could not be decrypted/)
  const incorrect = await deriveSecrets(phrase+'x',salt,sampleEmail,false)
  await assert.rejects(unseal(first,incorrect.key,sampleEmail),/could not be decrypted/)
})

test('normalization preserves supported groups, custom fields and settings only', () => {
  const doc = emptyDocument()
  doc.folders.push('Home','Home',' ')
  doc.items.push({...blankItem('note','Home'), id:'a-1', title:'  My note  ', fields:{content:'Body', password:'unexpected'}, custom:[{label:' PIN ',value:'4321',kind:'secret'}]})
  const normalized = normalizeDocument(doc)
  assert.deepEqual(normalized.folders,['Home'])
  assert.equal(normalized.items[0].title,'My note')
  assert.equal(normalized.items[0].custom[0].kind,'secret')
  assert.equal(normalized.items[0].fields.password,undefined)
  assert.throws(() => normalizeDocument({...doc,items:[...doc.items,...doc.items]}),/invalid item/)
  assert.equal(validEmail(sampleEmail),true)
  assert.equal(validEmail('user@localhost'),false)
})

test('WebAssembly separates character types and rejects the biased tail of random words', async () => {
  const { instance } = await WebAssembly.instantiate(await readFile(new URL('../public/media/password.wasm',import.meta.url)))
  const { classify, sample_index } = instance.exports
  assert.equal(classify(97),1); assert.equal(classify(65),2); assert.equal(classify(57),4); assert.equal(classify(33),8)
  assert.equal(sample_index(9,7),2)
  assert.equal(sample_index(0,0),-1)
  assert.equal(sample_index(0xffffffff,10),-1)
  assert.equal(sample_index(4294967289,10),9)
})
