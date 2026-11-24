<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Archive, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChartNoAxesColumn, ChevronDown, ContactRound, CreditCard, FileLock2, Folder, FolderPlus, Grid2X2, KeyRound, List, LockKeyhole, Menu, Plus, Search, Send, Settings2, ShieldCheck, Star, Terminal, Trash2, X } from 'lucide-vue-next'
import BrandMark from '../components/BrandMark.vue'
import VaultLink from '../components/VaultLink.vue'
import ModalShell from '../components/ModalShell.vue'
import RecordForm from '../components/RecordForm.vue'
import RecordDetail from '../components/RecordDetail.vue'
import PasswordPanel from '../components/PasswordPanel.vue'
import SharePanel from '../components/SharePanel.vue'
import { canOpenPrivate } from '../config.js'
import { blankItem, demoDocument, isSecret, normalizeDocument, subtitles, types, typeOf } from '../items.js'
import { basicPasswordCheck, passwordModule } from '../password.js'
import { closeVault, deleteAccount, exportBackup, readBackup, updateVault, vault, watchInactivity } from '../vault.js'

const route = useRoute()
const router = useRouter()
const demo = route.name === 'demo'
const sandboxDoc = ref(demoDocument())
const doc = computed(() => demo ? sandboxDoc.value : vault.doc)
const view = ref('all')
const search = ref('')
const query = computed(() => search.value.trim().toLowerCase())
const searchInput = ref()
const menu = ref(false)
const layout = computed(() => doc.value.prefs.layout)
const sections = reactive({ category:true, folder:true, tools:true })
const modal = ref('')
const formItem = ref()
const recordId = ref('')
const editFolder = ref('')
const folderName = ref('')
const formError = ref('')
const modalMessage = ref('')
const busy = ref(false)
const notice = ref('')
const transferFile = ref(null)
const transferPass = ref('')
const confirm = ref(false)
const wasmClassify = ref()
const loadingSettings = ref(false)
let toastTimer, stopInactivity
const typeIcons = {login:KeyRound, card:CreditCard, note:FileLock2, identity:ContactRound, ssh:Terminal}
const mainNav = [{id:'all', label:'All items', icon:Grid2X2},{id:'faves', label:'Favourites', icon:Star}]
const tools = [{id:'send',label:'Send',icon:Send},{id:'generator',label:'Password generator',icon:KeyRound},{id:'reports',label:'Reports',icon:ChartNoAxesColumn},{id:'settings',label:'Settings',icon:Settings2}]
const specials = [{id:'archived',label:'Archive',icon:Archive},{id:'trash',label:'Trash',icon:Trash2}]
const folderPrefix = 'folder:'
const active = computed(() => doc.value.items.filter(x => x.status === 'active'))
const itemInView = computed(() => doc.value.items.find(x => x.id === recordId.value))
const currentType = computed(() => types.find(t => t.id === view.value))
const folderView = computed(() => view.value.startsWith(folderPrefix) ? view.value.slice(folderPrefix.length) : null)
const toolView = computed(() => tools.some(x => x.id === view.value))
const display = computed(() => {
  switch (view.value) {
    case 'all': return ['My vault', 'A place for all the things you keep close.']
    case 'faves': return ['Favourites', 'Keep frequently used items close at hand.']
    case 'archived': return ['Archive', 'Items you want to keep but don’t need every day.']
    case 'trash': return ['Trash', 'Restore items or delete them permanently.']
    case 'send': return ['Send', 'Share a single item as a passphrase-protected file.']
    case 'generator': return ['Password generator', 'Create a unique password when you need one.']
    case 'reports': return ['Reports', 'Review weak or reused login passwords on this device.']
    case 'settings': return ['Settings', 'Manage this workspace and its backups.']
    default: return currentType.value ? [currentType.value.label, currentType.value.description] : [folderView.value || 'No folder', 'Find the vault items collected here.']
  }
})
const counts = computed(() => Object.fromEntries(types.map(x => [x.id, active.value.filter(item => item.type === x.id).length])))
const filtered = computed(() => {
  let set = ['trash','archived'].includes(view.value) ? doc.value.items.filter(x => x.status === view.value) : active.value
  if (view.value === 'faves') set = set.filter(x => x.favorite)
  if (currentType.value) set = set.filter(x => x.type === currentType.value.id)
  if (folderView.value !== null) set = set.filter(x => x.folder === folderView.value)
  if (query.value) set = set.filter(item => [item.title, item.folder, typeOf(item.type).label, item.fields.username, item.fields.website, item.fields.fullName, ...item.custom.filter(x => !isSecret(x.kind)).map(x => x.label)].some(value => value?.toLowerCase().includes(query.value)))
  return [...set].sort((a,b) => b.updated - a.updated || a.title.localeCompare(b.title))
})
const groups = computed(() => types.map(type => ({...type, entries:filtered.value.filter(x => x.type === type.id)})).filter(type => type.entries.length))
const report = computed(() => {
  if (view.value !== 'reports') return {weak:[],reused:[],total:0}
  const values = active.value.filter(x => x.type === 'login' && x.fields.password)
  const counts = new Map()
  values.forEach(x => counts.set(x.fields.password, (counts.get(x.fields.password) || 0) + 1))
  return { total:values.length, weak:values.filter(x => basicPasswordCheck(x.fields.password, wasmClassify.value)), reused:values.filter(x => counts.get(x.fields.password) > 1) }
})
const initials = computed(() => demo ? 'D' : (vault.email[0]?.toUpperCase() || 'V'))
const syncLabel = computed(() => vault.synced ? new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(vault.synced) : 'Not yet synced')

function showNotice(message) {
  notice.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { notice.value = '' }, 3600)
}
function selectView(id, keepSearch = false) {
  view.value = id
  if (!keepSearch) search.value = ''
  menu.value = false
  if (id === 'reports') passwordModule().then(x => { wasmClassify.value = x.classify }).catch(() => {})
  nextTick(() => window.scrollTo({ top:0, behavior:'instant' }))
}
function jumpToSearch(event) {
  if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) && !modal.value) {
    event.preventDefault()
    if (toolView.value) selectView('all')
    nextTick(() => searchInput.value?.focus())
  }
}
const save = async (mutation) => {
  if (!demo) return updateVault(mutation)
  const copy = JSON.parse(JSON.stringify(sandboxDoc.value)); mutation(copy); sandboxDoc.value = normalizeDocument(copy); return sandboxDoc.value
}
function openModal(mode) {
  formError.value = ''; modalMessage.value = ''; transferFile.value = null; transferPass.value = ''; confirm.value = false
  modal.value = mode
}
function dismiss() {
  if (busy.value) return
  modal.value = ''; formItem.value = undefined; recordId.value = ''; transferFile.value = null; transferPass.value = ''
}
function createItem(type = currentType.value?.id || 'login', password = '') {
  formItem.value = blankItem(type, folderView.value || '')
  if (view.value === 'faves') formItem.value.favorite = true
  if (password) formItem.value.fields.password = password
  openModal('form')
}
function openItem(id) { recordId.value = id; openModal('item') }
function editItem() { formItem.value = itemInView.value; openModal('form') }
async function submitItem(form) {
  const item = JSON.parse(JSON.stringify(form))
  if (!item.title?.trim()) { formError.value = 'Give the item a name.'; return }
  if (item.custom.some(x => !x.label.trim())) { formError.value = 'Give each custom field a name.'; return }
  const existing = Boolean(item.id)
  item.id ||= crypto.randomUUID(); item.updated = Date.now()
  busy.value = true; formError.value = ''
  try {
    await save(data => {
      if (existing) data.items = data.items.map(x => x.id === item.id ? item : x)
      else data.items.push(item)
    })
    busy.value = false
    if (toolView.value || ['trash','archived'].includes(view.value) || (currentType.value && currentType.value.id !== item.type) || (folderView.value !== null && folderView.value !== item.folder) || (view.value === 'faves' && !item.favorite)) selectView('all')
    search.value = ''
    dismiss(); showNotice(existing ? 'Changes saved.' : 'Item created.')
  } catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
async function recordAction(action) {
  if (action === 'purge') { openModal('purge'); return }
  const id = recordId.value
  busy.value = true; formError.value = ''
  try {
    await save(data => {
      const item = data.items.find(x => x.id === id)
      if (!item) return
      if (action === 'favourite') item.favorite = !item.favorite
      else item.status = action
      item.updated = Date.now()
    })
    busy.value = false
    if (action !== 'favourite') dismiss()
    const message = action === 'favourite' ? (itemInView.value?.favorite ? 'Added to favourites.' : 'Removed from favourites.') : {archived:'Item archived.', trash:'Item moved to trash.', active:'Item restored.'}[action]
    if (action === 'favourite') modalMessage.value = message
    else showNotice(message)
  } catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
async function purge() {
  busy.value = true; formError.value = ''
  try {
    await save(data => { data.items = data.items.filter(x => x.id !== recordId.value) })
    busy.value = false; dismiss(); showNotice('Item deleted permanently.')
  } catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
function folderDialog(name = '') { folderName.value = editFolder.value = name; openModal('folder') }
async function submitFolder(remove = false) {
  const old = editFolder.value
  const name = folderName.value.trim()
  if (!remove && (!name || (name !== old && doc.value.folders.some(x => x.toLowerCase() === name.toLowerCase() && x !== old)))) {
    formError.value = 'Choose a new, unique folder name.'; return
  }
  if (!old && doc.value.folders.length >= 30) { formError.value = 'This vault already has 30 folders.'; return }
  busy.value = true; formError.value = ''
  try {
    await save(data => {
      if (remove) data.folders = data.folders.filter(x => x !== old)
      else if (old) data.folders = data.folders.map(x => x === old ? name : x)
      else data.folders.push(name)
      if (old) data.items.forEach(item => { if (item.folder === old) item.folder = remove ? '' : name })
    })
    selectView(folderPrefix + (remove ? '' : name)); sections.folder = true
    busy.value = false; dismiss(); showNotice(remove ? 'Folder removed. Its items were kept.' : old ? 'Folder updated.' : 'Folder created.')
  } catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
async function copy(value, label) {
  let text
  try { await navigator.clipboard.writeText(value); text = `${label} copied.` }
  catch { text = 'Clipboard access was denied. You can select and copy the value manually.' }
  if (modal.value) modalMessage.value = text
  else showNotice(text)
}
async function setPref(key, value) {
  loadingSettings.value = true
  try { await save(data => { data.prefs[key] = value }); if (key === 'lockMinutes') showNotice('Auto-lock updated.') }
  catch (error) { showNotice(error.message) }
  finally { loadingSettings.value = false }
}
async function lock(reason = '') {
  if (!vault.open) return
  const closing = closeVault()
  await router.replace({name:'login', state:{vaultMessage:reason}})
  await closing
}
function download(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'}))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function backup() {
  loadingSettings.value = true
  try { download(await exportBackup(), 'my-vercel-vault.encrypted.json'); showNotice('Encrypted backup downloaded.') }
  catch (error) { showNotice(error.message) }
  finally { loadingSettings.value = false }
}
async function restore() {
  busy.value = true; formError.value = ''
  try {
    const backup = await readBackup(transferFile.value, transferPass.value)
    await save(data => Object.assign(data, backup)); busy.value = false; dismiss(); showNotice('Backup restored.')
  } catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
async function removeAccount() {
  busy.value = true; formError.value = ''
  try { await deleteAccount(transferPass.value); await router.replace({name:'signup'}) }
  catch (error) { formError.value = error.message }
  finally { busy.value = false }
}
function importSent(item) { formItem.value = { ...blankItem(item.type), title:item.title, fields:item.fields, custom:item.custom }; openModal('form') }
function clearDemo() { sandboxDoc.value = demoDocument(); dismiss(); selectView('all'); showNotice('Demo reset.') }
onMounted(() => { window.addEventListener('keydown', jumpToSearch); if (!demo) stopInactivity = watchInactivity(lock) })
onBeforeUnmount(() => { window.removeEventListener('keydown', jumpToSearch); stopInactivity?.(); clearTimeout(toastTimer); transferPass.value = ''; formItem.value = undefined })
</script>

<template>
  <div class="workspace">
    <header class="workspace-top">
      <div class="workspace-wordmark"><BrandMark /><span class="top-slash">/</span><span class="top-location">Workspace</span></div>
      <div class="top-controls">
        <span class="workspace-status"><i></i>{{ demo ? 'Demo mode' : 'Vault unlocked' }}</span>
        <RouterLink v-if="demo" class="button secondary compact top-lock" :to="{name:'home'}"><ArrowLeft /> <span>Exit demo</span></RouterLink>
        <button v-else type="button" class="button secondary compact top-lock" aria-label="Lock vault" @click="lock()"><LockKeyhole /><span>Lock vault</span></button>
        <button type="button" class="workspace-avatar" aria-label="Open workspace settings" @click="selectView('settings')">{{ initials }}</button>
      </div>
    </header>
    <div class="workspace-shell">
      <aside id="workspace-navigation" class="workspace-sidebar" :class="{ 'mobile-open':menu }">
        <nav aria-label="Vault navigation">
          <div class="sidebar-block"><div class="side-label">Workspace</div>
            <button v-for="link in mainNav" :key="link.id" type="button" class="side-link" :aria-current="view === link.id ? 'page' : undefined" @click="selectView(link.id)"><component :is="link.icon" :size="16" /><span>{{ link.label }}</span><small>{{ link.id === 'all' ? active.length : active.filter(x => x.favorite).length }}</small></button>
          </div>
          <div class="sidebar-block"><button type="button" class="side-label side-toggle" :aria-expanded="sections.category" aria-controls="nav-categories" @click="sections.category = !sections.category">Categories <ChevronDown :size="13" /></button>
            <div v-show="sections.category" id="nav-categories"><button v-for="link in types" :key="link.id" type="button" class="side-link" :aria-current="view === link.id ? 'page' : undefined" @click="selectView(link.id)"><component :is="typeIcons[link.id]" :size="16" /><span>{{ link.label }}</span><small>{{ counts[link.id] }}</small></button></div>
          </div>
          <div class="sidebar-block"><div class="side-heading"><button type="button" class="side-label side-toggle" :aria-expanded="sections.folder" aria-controls="nav-folders" @click="sections.folder = !sections.folder">Folders <ChevronDown :size="13" /></button><button type="button" class="icon-button bare side-plus" aria-label="Create folder" title="Create folder" @click="folderDialog()"><Plus /></button></div>
            <div v-show="sections.folder" id="nav-folders"><button v-for="folder in ['', ...doc.folders]" :key="folder" type="button" class="side-link" :aria-current="view === folderPrefix + folder ? 'page' : undefined" @click="selectView(folderPrefix + folder)"><Folder :size="16" /><span>{{ folder || 'No folder' }}</span></button></div>
          </div>
          <div class="sidebar-block"><button type="button" class="side-label side-toggle" :aria-expanded="sections.tools" aria-controls="nav-tools" @click="sections.tools = !sections.tools">Tools <ChevronDown :size="13" /></button>
            <div v-show="sections.tools" id="nav-tools"><button v-for="link in tools" :key="link.id" type="button" class="side-link" :aria-current="view === link.id ? 'page' : undefined" @click="selectView(link.id)"><component :is="link.icon" :size="16" /><span>{{ link.label }}</span></button></div>
          </div>
          <div class="sidebar-block sidebar-secondary"><button v-for="link in specials" :key="link.id" type="button" class="side-link" :aria-current="view === link.id ? 'page' : undefined" @click="selectView(link.id)"><component :is="link.icon" :size="16" /><span>{{ link.label }}</span></button></div>
        </nav>
        <div class="side-bottom"><RouterLink class="side-link" :to="{name:'guide'}"><BookOpen :size="16" /><span>Vault guide</span><ArrowUpRight :size="13" /></RouterLink></div>
      </aside>
      <main id="main-content" class="workspace-main">
        <button type="button" class="button secondary compact workspace-mobile-menu" :aria-expanded="menu" aria-controls="workspace-navigation" @click="menu = !menu"><X v-if="menu" /><Menu v-else />{{ menu ? 'Close navigation' : 'Browse vault' }}</button>
        <div class="workspace-main-inner">
          <div class="workspace-heading"><div><div class="kicker"><span class="tick"></span>{{ demo ? 'Interactive demo' : 'Personal workspace' }}</div><h1>{{ display[0] }}</h1><p>{{ display[1] }}</p></div>
            <div class="workspace-heading-actions"><button v-if="folderView" type="button" class="button secondary compact" @click="folderDialog(folderView)"><Settings2 /> Manage folder</button><button type="button" class="button primary" @click="createItem()"><Plus /> Create item</button></div>
          </div>

          <div v-if="view === 'all' && !query" class="workspace-banner"><div class="banner-copy"><span class="card-symbol"><ShieldCheck :size="20" /></span><div><h2>{{ demo ? 'This is the sample vault' : 'Your vault is unlocked' }}</h2><p>{{ demo ? 'Try every tool with made-up data. Changes reset on reload.' : 'Your items are decrypted here and encrypted before every sync.' }}</p></div></div><VaultLink v-if="demo" class="button secondary compact">{{ canOpenPrivate ? 'Get a private vault' : 'Vault guide' }} <ArrowUpRight /></VaultLink><RouterLink v-else class="button secondary compact" :to="{name:'guide',hash:'#security-details'}">Security guide <ArrowUpRight /></RouterLink></div>
          <template v-if="!toolView">
            <div class="workspace-toolbar"><label class="workspace-search"><Search :size="16" /><input ref="searchInput" v-model="search" type="search" placeholder="Search your vault…" aria-label="Search your vault" /><button v-if="search" type="button" class="icon-button bare" aria-label="Clear search" @click="search = ''; searchInput?.focus()"><X :size="14" /></button><kbd v-else><span>Ctrl</span> K</kbd></label><div class="toolbar-end"><span class="result-count" aria-live="polite">{{ filtered.length }} {{ filtered.length === 1 ? 'item' : 'items' }}</span><div class="layout-switch" aria-label="Vault layout"><button type="button" class="icon-button bare" aria-label="Grid view" :aria-pressed="layout === 'grid'" :disabled="loadingSettings" @click="setPref('layout','grid')"><Grid2X2 /></button><button type="button" class="icon-button bare" aria-label="List view" :aria-pressed="layout === 'list'" :disabled="loadingSettings" @click="setPref('layout','list')"><List /></button></div></div></div>
            <div v-if="!filtered.length" class="workspace-empty"><span class="empty-symbol"><Search v-if="query" :size="24" /><FolderPlus v-else :size="25" /></span><h2>{{ query ? 'No matching items' : 'Nothing here yet' }}</h2><p>{{ query ? 'Try a different name, category or username.' : 'This space is ready for your saved items.' }}</p><button v-if="query" type="button" class="button secondary compact" @click="search = ''">Clear search</button><button v-else-if="!['trash','archived'].includes(view)" type="button" class="button secondary compact" @click="createItem()"><Plus /> Create an item</button></div>
            <section v-for="group in groups" :key="group.id" class="vault-category" :aria-labelledby="`group-${group.id}`">
              <div class="category-head"><div><component :is="typeIcons[group.id]" :size="16" /><h2 :id="`group-${group.id}`">{{ group.label }}</h2><span>{{ group.entries.length }}</span></div><button v-if="view === 'all'" type="button" class="button plain compact category-more" :aria-label="`View all ${group.label.toLowerCase()}`" @click="selectView(group.id, Boolean(query))">View all <ArrowRight /></button></div>
              <div class="record-grid" :class="{ 'list-layout':layout === 'list' }">
                <article v-for="item in (view === 'all' && !query ? group.entries.slice(0, 6) : group.entries)" :key="item.id" class="record-card">
                  <div class="record-top"><span class="card-symbol"><component :is="typeIcons[group.id]" :size="18" /></span><Star v-if="item.favorite" class="record-star" :size="15" aria-label="Favourite" /></div>
                  <div class="record-labels"><h3>{{ item.title }}</h3><p>{{ subtitles(item) }}</p></div>
                  <div class="record-bottom"><button type="button" class="button secondary compact" :aria-label="`Open ${item.title}`" @click="openItem(item.id)">Open <ArrowRight /></button><span v-if="item.folder" class="card-folder"><Folder :size="12" /> {{ item.folder }}</span><span v-else class="card-folder">{{ group.single }}</span></div>
                </article>
              </div>
            </section>
          </template>

          <PasswordPanel v-if="view === 'generator'" @copy="copy" @save="createItem('login', $event)" />
          <SharePanel v-if="view === 'send'" :items="active" :demo="demo" @download="download" @import="importSent" @notice="showNotice" />
          <template v-if="view === 'reports'">
            <div class="report-grid"><div class="workspace-panel metric-panel"><span>Logins checked</span><strong>{{ report.total }}</strong></div><div class="workspace-panel metric-panel"><span>Weak passwords</span><strong>{{ report.weak.length }}</strong></div><div class="workspace-panel metric-panel"><span>Reused passwords</span><strong>{{ report.reused.length }}</strong></div></div>
            <p class="report-helper helper">These basic checks run locally. They don’t check data breaches or guarantee that a password is strong.</p>
            <section v-for="[label, entries] in [['Weak passwords',report.weak],['Reused passwords',report.reused]]" :key="label" class="workspace-panel report-section"><h2>{{ label }}</h2><p v-if="!entries.length" class="helper">No items flagged.</p><div v-for="item in entries" :key="item.id" class="report-row"><span>{{ item.title }}</span><button class="button secondary compact" type="button" :aria-label="`Review ${item.title}`" @click="openItem(item.id)">Review <ArrowRight /></button></div></section>
          </template>
          <div v-if="view === 'settings'" class="settings-grid">
            <section class="workspace-panel settings-panel"><div class="tool-head"><span class="card-symbol"><Settings2 :size="19" /></span><div><h2>Workspace preferences</h2><p>{{ demo ? 'Preferences apply to this demo tab.' : vault.email }}</p></div></div><label class="control" for="settings-layout">Saved item layout<select id="settings-layout" :value="layout" :disabled="loadingSettings" @change="setPref('layout',$event.target.value)"><option value="grid">Grid</option><option value="list">List</option></select></label><label v-if="!demo" class="control" for="settings-timeout">Auto-lock after inactivity<select id="settings-timeout" :value="doc.prefs.lockMinutes" :disabled="loadingSettings" @change="setPref('lockMinutes',Number($event.target.value))"><option v-for="minutes in [2,5,10,20]" :key="minutes" :value="minutes">{{ minutes }} minutes</option></select></label></section>
            <section v-if="!demo" class="workspace-panel settings-panel"><div class="tool-head"><span class="card-symbol"><FileLock2 :size="19" /></span><div><h2>Encrypted backups</h2><p>Last synced: {{ syncLabel }}</p></div></div><p class="helper">Keep an encrypted backup in a safe place. It requires your master passphrase to restore.</p><div class="generator-buttons"><button type="button" class="button secondary compact" :disabled="loadingSettings" @click="backup">Download backup</button><button type="button" class="button secondary compact" @click="openModal('restore')">Restore backup</button></div></section>
            <section v-if="!demo" class="workspace-panel settings-panel"><h2>Delete account</h2><p class="helper">Deletes this account and its current synced vault. You’ll need to confirm your master passphrase.</p><button type="button" class="button danger compact" @click="openModal('delete')"><Trash2 /> Delete account</button></section>
            <section v-else class="workspace-panel settings-panel"><h2>Reset the demo</h2><p class="helper">Discard your changes and bring back the original sample items.</p><button type="button" class="button secondary compact" @click="openModal('reset')">Reset demo vault</button></section>
          </div>
        </div>
      </main>
    </div>

    <ModalShell v-if="modal === 'form' && formItem" :title="formItem.id ? 'Edit item' : 'Create an item'" subtitle="Store the details you need, in one place." wide :busy="busy" @close="dismiss"><RecordForm :initial="formItem" :folders="doc.folders" :busy="busy" :error="formError" @save="submitItem" @close="dismiss" /></ModalShell>
    <ModalShell v-if="modal === 'item' && itemInView" :title="itemInView.title" :subtitle="typeOf(itemInView.type).single" :busy="busy" @close="dismiss"><RecordDetail :item="itemInView" :busy="busy" :error="formError" @copy="copy" @edit="editItem" @action="recordAction" /><p v-if="modalMessage" class="helper modal-message" role="status">{{ modalMessage }}</p></ModalShell>
    <ModalShell v-if="modal === 'folder'" :title="editFolder ? 'Manage folder' : 'Create a folder'" subtitle="Group related things together." :busy="busy" @close="dismiss"><form class="dialog-stack" @submit.prevent="submitFolder()"><label class="control" for="folder-name">Folder name<input id="folder-name" v-model="folderName" maxlength="50" required autofocus /></label><template v-if="editFolder"><label class="check-row"><input v-model="confirm" type="checkbox" /> I want to remove this folder without deleting its items.</label></template><p v-if="formError" class="notice error" role="alert">{{ formError }}</p><div class="dialog-actions"><button v-if="editFolder && confirm" class="button danger" type="button" :disabled="busy" @click="submitFolder(true)">Remove folder</button><button class="button secondary" type="button" :disabled="busy" @click="dismiss">Cancel</button><button class="button primary" :disabled="busy" type="submit">{{ editFolder ? 'Save changes' : 'Create' }}</button></div></form></ModalShell>
    <ModalShell v-if="modal === 'purge'" title="Delete this item?" :busy="busy" @close="dismiss"><div class="dialog-stack"><p class="helper"><strong>{{ itemInView?.title }}</strong> will be permanently removed from the vault.</p><p v-if="formError" class="notice error" role="alert">{{ formError }}</p><div class="dialog-actions"><button class="button secondary" type="button" :disabled="busy" @click="openModal('item')">Cancel</button><button class="button danger" :disabled="busy" type="button" @click="purge">Delete permanently</button></div></div></ModalShell>
    <ModalShell v-if="modal === 'restore'" title="Restore encrypted backup" :busy="busy" @close="dismiss"><form class="dialog-stack" @submit.prevent="restore"><label class="control" for="backup-file">Backup file<input id="backup-file" type="file" accept=".json,application/json" required @change="transferFile = $event.target.files[0]" /></label><label class="control" for="backup-pass">Original master passphrase<input id="backup-pass" v-model="transferPass" type="password" autocomplete="off" maxlength="256" required /></label><label class="check-row"><input v-model="confirm" type="checkbox" required /> Replace all current vault items and folders.</label><p v-if="formError" class="notice error" role="alert">{{ formError }}</p><div class="dialog-actions"><button class="button secondary" type="button" :disabled="busy" @click="dismiss">Cancel</button><button class="button primary" :disabled="busy || !confirm || !transferFile" type="submit">Restore backup</button></div></form></ModalShell>
    <ModalShell v-if="modal === 'delete'" title="Delete your account?" :busy="busy" @close="dismiss"><form class="dialog-stack" @submit.prevent="removeAccount"><label class="control" for="delete-pass">Confirm master passphrase<input id="delete-pass" v-model="transferPass" type="password" autocomplete="current-password" maxlength="256" required /></label><label class="check-row"><input v-model="confirm" type="checkbox" required /> Permanently remove this account and its current vault.</label><p v-if="formError" class="notice error" role="alert">{{ formError }}</p><div class="dialog-actions"><button class="button secondary" type="button" :disabled="busy" @click="dismiss">Cancel</button><button class="button danger" :disabled="busy || !confirm" type="submit">Delete account</button></div></form></ModalShell>
    <ModalShell v-if="modal === 'reset'" title="Reset the demo?" subtitle="Your changes will be replaced by the original sample vault." @close="dismiss"><div class="dialog-actions"><button class="button secondary" type="button" @click="dismiss">Cancel</button><button class="button primary" type="button" @click="clearDemo">Reset demo</button></div></ModalShell>
    <div v-if="notice" class="workspace-toast" role="status"><span>{{ notice }}</span><button type="button" class="icon-button bare" aria-label="Dismiss notification" @click="notice = ''"><X /></button></div>
  </div>
</template>

<style src="./workspace.css"></style>
