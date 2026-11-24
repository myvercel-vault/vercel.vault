<script setup>
import { computed, reactive } from 'vue'
import { Archive, ArrowUpRight, Copy, Eye, EyeOff, Pencil, RotateCcw, Star, Trash2 } from 'lucide-vue-next'
import { isSecret, typeOf } from '../items.js'
const props = defineProps({ item: {type:Object,required:true}, busy: Boolean, error: String })
const emit = defineEmits(['copy','edit','action'])
const revealing = reactive({})
const fields = computed(() => [
  ...typeOf(props.item.type).fields.filter(([key]) => props.item.fields[key]).map(([key,label,kind]) => ({key,label,kind,value:props.item.fields[key]})),
  ...props.item.custom.map((f,n) => ({...f,key:`custom-${n}`})),
])
const website = computed(() => {
  if (props.item.type !== 'login') return ''
  try { const u = new URL(props.item.fields.website); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : '' } catch { return '' }
})
</script>

<template>
  <div class="dialog-stack">
    <div v-if="item.folder" class="detail-folder">Folder · {{ item.folder }}</div>
    <p v-if="!fields.length" class="helper">No details added to this item.</p>
    <div v-for="field in fields" :key="field.key" class="detail-row">
      <div class="detail-value"><span>{{ field.label }}</span><span :class="{ cosecret:isSecret(field.kind) }">{{ field.value ? (isSecret(field.kind) && !revealing[field.key] ? '••••••••••••' : field.value) : '—' }}</span></div>
      <div class="detail-icons">
        <button v-if="isSecret(field.kind) && field.value" class="icon-button bare" type="button" :aria-label="`${revealing[field.key] ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`" @click="revealing[field.key] = !revealing[field.key]"><EyeOff v-if="revealing[field.key]" /><Eye v-else /></button>
        <button v-if="field.value" class="icon-button bare" type="button" :aria-label="`Copy ${field.label.toLowerCase()}`" @click="emit('copy',field.value,field.label)"><Copy /></button>
        <a v-if="field.key === 'website' && website" :href="website" class="icon-button bare" target="_blank" rel="noopener noreferrer" aria-label="Open saved website"><ArrowUpRight /></a>
      </div>
    </div>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <div class="dialog-actions detail-actions">
      <template v-if="item.status === 'active'">
        <button class="button secondary compact" type="button" :disabled="busy" @click="emit('action','favourite')"><Star /> {{ item.favorite ? 'Unfavourite' : 'Favourite' }}</button>
        <button class="button secondary compact" type="button" :disabled="busy" @click="emit('action','archived')"><Archive /> Archive</button>
        <button class="button secondary compact" type="button" :disabled="busy" @click="emit('action','trash')"><Trash2 /> Trash</button>
        <button class="button primary compact" type="button" :disabled="busy" @click="emit('edit')"><Pencil /> Edit</button>
      </template>
      <template v-else><button class="button secondary compact" type="button" :disabled="busy" @click="emit('action','active')"><RotateCcw /> Restore</button>
        <button v-if="item.status === 'trash'" class="button danger compact" type="button" :disabled="busy" @click="emit('action','purge')"><Trash2 /> Delete permanently</button>
        <button v-else class="button secondary compact" type="button" :disabled="busy" @click="emit('action','trash')"><Trash2 /> Trash</button></template>
    </div>
  </div>
</template>

<style scoped>
.detail-folder{font-size:12px;color:var(--muted)}.detail-row{border:1px solid #2d2d32;display:flex;justify-content:space-between;gap:8px;padding:9px 6px 9px 11px;border-radius:7px;align-items:flex-start;background:#151518;min-width:0}.detail-value{display:grid;gap:5px;min-width:0}.detail-value>span:first-child{color:#a2a2ad;font-size:11px}.detail-value>span:last-child{overflow-wrap:anywhere;white-space:pre-wrap;font-size:13px;max-height:170px;overflow:auto}.detail-value .cosecret{font-family:var(--mono)}.detail-icons{display:flex;gap:0}.detail-icons>.icon-button{width:29px;height:29px}.detail-icons>.icon-button svg{width:14px;height:14px}.detail-actions{justify-content:flex-start}
</style>
