<script setup>
import { computed, ref } from 'vue'
import { Download, FileLock2, Send, Upload } from 'lucide-vue-next'
import { deriveSecrets, randomSalt, seal, unseal } from '../crypto.js'
import { normalizeDocument } from '../items.js'
const props = defineProps({ items:Array, demo:Boolean })
const emit = defineEmits(['download','import','notice'])
const selected = ref('')
const sendPassword = ref('')
const receivePassword = ref('')
const receivedFile = ref(null)
const sendError = ref('')
const receiveError = ref('')
const sending = ref(false)
const receiving = ref(false)
const item = computed(() => props.items.find(x => x.id === selected.value))
const context = 'shared-item'
async function wrapItem() {
  sendError.value = ''; sending.value = true
  try {
    if (!item.value) throw new Error('Choose an item to share.')
    if ([...sendPassword.value].length < 12) throw new Error('Choose a share passphrase of at least 12 characters.')
    const salt = randomSalt()
    const { key } = await deriveSecrets(sendPassword.value,salt,context,false)
    const { title, type, fields, custom } = item.value
    const envelope = await seal({ title, type, fields, custom },key,context)
    emit('download',{format:'my-vercel-vault/send/1', salt, ...envelope},'my-vercel-vault.shared.json')
    sendPassword.value = ''; emit('notice','Encrypted share file downloaded.')
  } catch (error) { sendError.value = error.message }
  finally { sending.value = false }
}
async function openFile() {
  receiveError.value = ''; receiving.value = true
  try {
    if (!receivedFile.value || receivedFile.value.size > 201_000) throw new Error('Choose a valid share file.')
    let wrapper
    try { wrapper = JSON.parse(await receivedFile.value.text()) } catch { throw new Error('Choose a valid share file.') }
    if (wrapper?.format !== 'my-vercel-vault/send/1') throw new Error('This file is not a supported encrypted share.')
    const { key } = await deriveSecrets(receivePassword.value,wrapper.salt,context,false)
    const entry = await unseal(wrapper,key,context)
    if (!entry || typeof entry !== 'object') throw new Error('This file contains an invalid item.')
    const clean = normalizeDocument({items:[{...entry,id:'shared-item'}],folders:[]}).items[0]
    receivePassword.value = ''; emit('import',clean)
  } catch (error) { receiveError.value = error.message }
  finally { receiving.value = false }
}
</script>

<template>
  <div class="settings-grid share-grid">
    <section class="workspace-panel settings-panel"><div class="tool-head"><span class="card-symbol"><Send :size="19" /></span><div><h2>Send an item</h2><p>Download an encrypted copy. Nothing is uploaded.</p></div></div>
      <form class="dialog-stack" @submit.prevent="wrapItem"><label class="control" for="share-item-choice">Choose an item<select id="share-item-choice" v-model="selected" required><option value="" disabled>Select an item</option><option v-for="i in items" :key="i.id" :value="i.id">{{ i.title }}</option></select></label><label class="control" for="share-new-pass">New share passphrase<input id="share-new-pass" v-model="sendPassword" type="password" autocomplete="new-password" minlength="12" maxlength="256" required /></label><p class="helper">Use a new passphrase, not your master passphrase. Give it to the recipient separately from the file.</p><p v-if="sendError" class="notice error" role="alert">{{ sendError }}</p><button type="submit" class="button primary" :disabled="!item || sending"><Download />{{ sending ? 'Encrypting…' : 'Download encrypted file' }}</button></form>
    </section>
    <section class="workspace-panel settings-panel"><div class="tool-head"><span class="card-symbol"><FileLock2 :size="19" /></span><div><h2>Open a shared file</h2><p>Decrypt and review the item before saving it.</p></div></div>
      <p v-if="demo" class="helper">Use a sample file made in the demo, not your real vault information.</p>
      <form class="dialog-stack" @submit.prevent="openFile"><label class="control" for="share-upload">Encrypted share file<input id="share-upload" type="file" accept=".json,application/json" required @change="receivedFile = $event.target.files[0]" /></label><label class="control" for="share-open-pass">Share passphrase<input id="share-open-pass" v-model="receivePassword" type="password" autocomplete="off" maxlength="256" required /></label><p v-if="receiveError" class="notice error" role="alert">{{ receiveError }}</p><button type="submit" class="button secondary" :disabled="!receivedFile || receiving"><Upload />{{ receiving ? 'Decrypting…' : 'Open encrypted file' }}</button></form>
    </section>
  </div>
</template>
<style scoped>
.share-grid input[type=file]{padding:7px;font-size:12px}.share-grid input[type=file]::file-selector-button{border:1px solid #37373c;background:#242427;padding:5px 8px;border-radius:5px;color:#e9e9ed;margin-right:8px;cursor:pointer}.share-grid button[type=submit]{width:max-content;max-width:100%}
</style>
