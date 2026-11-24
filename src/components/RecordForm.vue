<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { Eye, EyeOff, Plus, Trash2, WandSparkles } from 'lucide-vue-next'
import { typeOf, types, isSecret } from '../items.js'
import { generatePassword } from '../password.js'
const props = defineProps({ initial: {type:Object,required:true}, folders: Array, busy: Boolean, error: String })
const emit = defineEmits(['save', 'close'])
const form = reactive(JSON.parse(JSON.stringify(props.initial)))
const reveal = reactive({})
const generating = ref(false)
const generatorError = ref('')
watch(() => form.type, () => { form.fields = {}; generatorError.value = '' })
async function generate() {
  generating.value = true; generatorError.value = ''
  try {
    const value = await generatePassword(22, {lower:true,upper:true,numbers:true,symbols:true})
    if (form.type === 'login') { form.fields.password = value; reveal.password = false }
  }
  catch { generatorError.value = 'The generator could not load. Try again or type a password.' }
  finally { generating.value = false }
}
function addCustom() {
  if (form.custom.length >= 15) return
  const index = form.custom.length
  form.custom.push({label:'',value:'',kind:'text'})
  nextTick(() => document.getElementById(`custom-name-${index}`)?.focus())
}
function removeCustom(n) {
  form.custom.splice(n,1)
  for (const name of Object.keys(reveal)) if (name.startsWith('custom-')) delete reveal[name]
}
</script>

<template>
  <form class="dialog-stack" @submit.prevent="emit('save', form)">
    <label for="record-title" class="control">Item name<input id="record-title" v-model.trim="form.title" placeholder="e.g. Personal email" maxlength="100" required autofocus /></label>
    <div class="dialog-split">
      <label for="record-type" class="control">Category<select id="record-type" v-model="form.type" :disabled="Boolean(form.id)"><option v-for="type in types" :key="type.id" :value="type.id">{{ type.single }}</option></select></label>
      <label for="record-folder" class="control">Folder<select id="record-folder" v-model="form.folder"><option value="">No folder</option><option v-for="folder in folders" :key="folder">{{ folder }}</option></select></label>
    </div>
    <template v-for="[key, label, style] in typeOf(form.type).fields" :key="`${form.type}-${key}`">
      <div class="record-control">
        <label :for="`record-${key}`" class="control">{{ label }}</label>
        <div class="field-actions">
          <textarea v-if="style === 'textarea' || (style === 'secret-area' && reveal[key])" :id="`record-${key}`" v-model="form.fields[key]" maxlength="12000" spellcheck="false" />
          <input v-else :id="`record-${key}`" v-model="form.fields[key]" :type="isSecret(style) ? (reveal[key] ? 'text' : 'password') : (style || 'text')" maxlength="2000" autocomplete="off" spellcheck="false" />
          <button v-if="isSecret(style)" type="button" class="icon-button" :aria-label="`${reveal[key] ? 'Hide' : 'Show'} ${label.toLowerCase()}`" @click="reveal[key] = !reveal[key]"><EyeOff v-if="reveal[key]" /><Eye v-else /></button>
          <button v-if="key === 'password'" type="button" class="icon-button" aria-label="Generate a password for this item" title="Generate password" :disabled="generating" @click="generate"><WandSparkles /></button>
        </div>
      </div>
    </template>
    <p v-if="generatorError" class="notice" role="alert">{{ generatorError }}</p>
    <div class="custom-section">
      <div class="custom-head"><div><h3>Additional details</h3><p class="helper">Make the item fit your needs.</p></div><button class="button secondary compact" type="button" :disabled="form.custom.length >= 15" @click="addCustom"><Plus /> Custom field</button></div>
      <div v-for="(field,n) in form.custom" :key="n" class="custom-fields">
        <div class="custom-first">
          <label class="control" :for="`custom-name-${n}`">Field name<input :id="`custom-name-${n}`" v-model.trim="field.label" placeholder="e.g. Account ID" maxlength="60" required /></label>
          <label class="control" :for="`custom-type-${n}`">Type<select :id="`custom-type-${n}`" v-model="field.kind"><option value="text">Text</option><option value="secret">Hidden</option></select></label>
          <button type="button" class="icon-button" :aria-label="`Remove custom field ${n+1}`" @click="removeCustom(n)"><Trash2 /></button>
        </div>
        <label class="control" :for="`custom-value-${n}`">Value</label>
        <div class="field-actions"><input :id="`custom-value-${n}`" v-model="field.value" :type="field.kind === 'secret' && !reveal[`custom-${n}`] ? 'password' : 'text'" maxlength="4000" autocomplete="off" spellcheck="false" /><button v-if="field.kind === 'secret'" type="button" class="icon-button" :aria-label="`${reveal[`custom-${n}`] ? 'Hide' : 'Show'} custom value ${n+1}`" @click="reveal[`custom-${n}`] = !reveal[`custom-${n}`]"><EyeOff v-if="reveal[`custom-${n}`]" /><Eye v-else /></button></div>
      </div>
    </div>
    <label class="check-row"><input v-model="form.favorite" type="checkbox" /> Mark as a favourite</label>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div class="dialog-actions"><button type="button" class="button secondary" :disabled="busy" @click="emit('close')">Cancel</button><button class="button primary" :disabled="busy || generating" type="submit">{{ busy ? 'Saving…' : (form.id ? 'Save changes' : 'Create') }}</button></div>
  </form>
</template>

<style scoped>
.record-control,.custom-fields{display:grid;gap:7px}.custom-section{display:grid;gap:11px;border-top:1px solid #303032;padding-top:14px}.custom-head{display:flex;justify-content:space-between;align-items:center;gap:6px}.custom-head h3{font-size:14px;font-weight:630}.custom-fields{background:#17171a;border:1px solid #303035;border-radius:8px;padding:10px}.custom-first{display:grid;grid-template-columns:minmax(0,1fr) minmax(75px,.52fr) 36px;gap:7px;align-items:end}.custom-first .icon-button{height:42px;width:36px}.custom-first select{padding-inline:7px}
</style>
