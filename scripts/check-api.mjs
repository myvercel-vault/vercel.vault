// Integration exercise for this project's own local Ruby or Wrangler server.
import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { deriveSecrets, randomSalt, seal, unseal } from '../src/crypto.js'
import { blankItem, emptyDocument } from '../src/items.js'
if (!globalThis.crypto) globalThis.crypto = webcrypto
const base = new URL(process.argv[2] || 'http://localhost:8080')
if (!['localhost','127.0.0.1','[::1]'].includes(base.hostname)) throw new Error('Run this test against your own local preview.')
async function api(path, method = 'GET', body, token, headers = {}) {
  const res = await fetch(new URL(`/api/${path}`,base), {
    method, headers: { ...(body ? {'Content-Type':'application/json'} : {}), ...(token ? {Authorization:`Bearer ${token}`} : {}), ...headers },
    ...(body ? {body:JSON.stringify(body)} : {}),
  })
  return [res.status, await res.json()]
}
const email = `test-${randomUUID()}@example.test`
const phrase = 'Local integration fixture 5# Not a real secret.'
assert.deepEqual(await api('health'),[200,{ok:true}])
assert.equal((await api('health','GET',null,null,{Origin:'https://test.invalid'}))[0],403)
assert.equal((await api('vault','PUT',{}))[0],401)
const salt = randomSalt()
const { key, proof } = await deriveSecrets(phrase,salt,email)
const initial = await seal(emptyDocument(),key,email)
const [creation, session] = await api('register','POST',{email,salt,proof,...initial})
assert.equal(creation,201,JSON.stringify(session))
assert.equal((await api('login','POST',{email,proof:'A'.repeat(43)}))[0],401)
assert.equal((await api('salt','POST',{email}))[1].salt,salt)
const updated = emptyDocument()
updated.items.push({...blankItem('note'), id:randomUUID(), title:'Check local encrypted vault', fields:{content:'This is a test fixture.'}})
const envelope = await seal(updated,key,email)
const [saved, snapshot] = await api('vault','PUT',{...envelope,revision:session.revision},session.token)
assert.equal(saved,200); assert.equal(snapshot.revision,2)
assert.equal((await api('vault','PUT',{...envelope,revision:1},session.token))[0],409)
assert.equal((await api('logout','POST',null,session.token))[0],200)
assert.equal((await api('vault','PUT',{...envelope,revision:2},session.token))[0],401)
const [access, login] = await api('login','POST',{email,proof})
assert.equal(access,200)
assert.deepEqual(await unseal(login,key,email),updated)
assert.equal((await api('account','DELETE',{proof:'A'.repeat(43)},login.token))[0],401)
assert.equal((await api('account','DELETE',{proof},login.token))[0],200)
assert.equal((await api('vault','PUT',{...envelope,revision:2},login.token))[0],401)
assert.equal((await api('login','POST',{email,proof}))[0],401)
console.log(`Local vault API OK (${base.origin}): registration, encryption, synchronization, session, and deletion.`)
