export const types = [
  { id: 'login', label: 'Logins', single: 'Login', icon: 'key-round', description: 'Usernames, passwords, and websites.', fields: [['username','Username or email'],['password','Password','secret'],['website','Website URL','url']] },
  { id: 'card', label: 'Payment cards', single: 'Payment card', icon: 'credit-card', description: 'Card details and expiration dates.', fields: [['holder','Cardholder name'],['number','Card number','secret'],['expires','Expiry (MM/YY)']] },
  { id: 'note', label: 'Secure notes', single: 'Secure note', icon: 'file-lock-2', description: 'Private thoughts and recovery information.', fields: [['content','Note','textarea']] },
  { id: 'identity', label: 'Identities', single: 'Identity', icon: 'contact-round', description: 'Contact details and personal information.', fields: [['fullName','Full name'],['email','Email','email'],['phone','Phone','tel'],['address','Address','textarea']] },
  { id: 'ssh', label: 'SSH keys', single: 'SSH key', icon: 'terminal', description: 'Private keys and fingerprints.', fields: [['publicKey','Public key','textarea'],['privateKey','Private key','secret-area'],['fingerprint','Fingerprint']] },
]
export const typeOf = id => types.find(type => type.id === id) || types[0]
export const defaultPrefs = () => ({ lockMinutes: 10, layout: 'grid' })
export const emptyDocument = () => ({ items: [], folders: [], prefs: defaultPrefs() })
export function blankItem(type = 'login', folder = '') {
  return { id: '', title: '', type, folder, fields: {}, custom: [], favorite: false, status: 'active', updated: 0 }
}
export function demoDocument() {
  const sample = (id, title, type, fields, favorite = false, folder = '') => ({ ...blankItem(type, folder), id, title, fields, favorite, updated: 1704420000000 })
  return {
    ...emptyDocument(), folders: ['Personal', 'Studio'], items: [
      sample('sample-1', 'Studio workspace', 'login', { username: 'studio@example.test', password: 'Sample-Only-9!Cobalt', website: 'https://example.com/' }, true, 'Studio'),
      sample('sample-2', 'Personal email', 'login', { username: 'alex@example.test', password: 'sampleonly', website: 'https://example.org/' }, false, 'Personal'),
      sample('sample-3', 'Travel card', 'card', { holder: 'Alex Example', number: '0000 0000 0000 4829', expires: '07/30' }, false, 'Personal'),
      sample('sample-4', 'Recovery codes', 'note', { content: 'Sample recovery memo only. Replace with your own note in a private vault.' }, true, 'Studio'),
      sample('sample-5', 'Personal profile', 'identity', { fullName: 'Alex Example', email: 'alex@example.test' }, false, 'Personal'),
      sample('sample-6', 'Development machine', 'ssh', { fingerprint: 'SHA256:example-fingerprint' }, false, 'Studio'),
    ],
  }
}
export const isSecret = kind => kind === 'secret' || kind === 'secret-area'
export function subtitles(item) {
  const f = item.fields
  if (item.type === 'login') return f.username || f.website || 'Saved sign-in'
  if (item.type === 'card') return '•••• ' + (f.number?.replace(/\s/g, '').slice(-4) || '••••')
  if (item.type === 'identity') return f.fullName || 'Personal details'
  if (item.type === 'ssh') return 'Key and fingerprint'
  return 'Private note'
}
export function normalizeDocument(doc) {
  if (!doc || !Array.isArray(doc.items) || doc.items.length > 300 || !Array.isArray(doc.folders)) throw new Error('This file is not a compatible vault.')
  const text = (value, max) => typeof value === 'string' ? value.slice(0, max) : ''
  const folders = [...new Set(doc.folders.map(f => text(f, 50).trim()).filter(Boolean))].slice(0, 30)
  const ids = new Set()
  const items = doc.items.map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('This file contains an invalid item.')
    const type = typeOf(entry.type)
    const id = text(entry.id, 64)
    const title = text(entry.title, 100).trim()
    if (!title || !/^[a-z0-9-]+$/i.test(id) || ids.has(id)) throw new Error('This file contains an invalid item.')
    ids.add(id)
    return {
      id, title, type: type.id, folder: folders.includes(entry.folder) ? entry.folder : '',
      fields: Object.fromEntries(type.fields.map(([key]) => [key, text(entry.fields?.[key], 12000)])),
      custom: Array.isArray(entry.custom) ? entry.custom.slice(0, 15).filter(x => x && text(x.label, 60).trim()).map(x => ({ label: text(x.label, 60).trim(), value: text(x.value, 4000), kind: x.kind === 'secret' ? 'secret' : 'text' })) : [],
      favorite: Boolean(entry.favorite), status: ['active','archived','trash'].includes(entry.status) ? entry.status : 'active',
      updated: Number.isSafeInteger(entry.updated) ? entry.updated : 0,
    }
  })
  return { items, folders, prefs: { lockMinutes: [2, 5, 10, 20].includes(doc.prefs?.lockMinutes) ? doc.prefs.lockMinutes : 10, layout: doc.prefs?.layout === 'list' ? 'list' : 'grid' } }
}
