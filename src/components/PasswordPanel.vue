<script setup>
import { onMounted, ref, watch } from 'vue'
import { Copy, KeyRound, RefreshCw } from 'lucide-vue-next'
import { generatePassword } from '../password.js'
const emit = defineEmits(['copy','save'])
const length = ref(24)
const options = ref({ lower:true, upper:true, numbers:true, symbols:true })
const labels = { lower:'Lowercase (a–z)', upper:'Uppercase (A–Z)', numbers:'Numbers (0–9)', symbols:'Symbols (!@#)' }
const generated = ref('')
const busy = ref(false)
const error = ref('')
let generation = 0
async function refresh() {
  const current = ++generation
  error.value = ''; busy.value = true
  try { const next = await generatePassword(length.value, options.value); if (current === generation) generated.value = next }
  catch (err) { if (current === generation) { error.value = err.message; generated.value = '' } }
  finally { if (current === generation) busy.value = false }
}
onMounted(refresh)
watch([length, options], refresh, {deep:true})
</script>

<template>
  <section class="workspace-panel generator" aria-label="Password options">
    <div class="tool-head"><span class="card-symbol"><KeyRound :size="20" /></span><div><h2>Generate a password</h2><p>Random passwords are generated locally using WebAssembly.</p></div></div>
    <output class="generator-output" aria-label="Generated password">{{ generated || (busy ? 'Generating…' : 'No password generated') }}</output>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <label class="generator-range" for="gen-length"><span>Password length</span><strong>{{ length }}</strong><input id="gen-length" v-model.number="length" type="range" min="8" max="96" /></label>
    <div class="generator-options"><label v-for="(label, option) in labels" :key="option" class="check-row"><input v-model="options[option]" type="checkbox" /> {{ label }}</label></div>
    <div class="generator-buttons"><button type="button" class="button secondary" :disabled="busy" @click="refresh"><RefreshCw /> Generate again</button><button type="button" class="button secondary" :disabled="!generated || busy" @click="emit('copy',generated,'Password')"><Copy /> Copy</button><button type="button" class="button primary" :disabled="!generated || busy" @click="emit('save',generated)">Save as login</button></div>
  </section>
</template>

<style scoped>
.generator{max-width:710px;display:grid;gap:19px}.generator-output{background:#0c0c0e;border:1px solid #37373c;border-radius:8px;padding:15px 13px;font:15px/1.5 var(--mono);overflow-wrap:anywhere;min-height:51px}.generator-range{display:grid;grid-template-columns:1fr auto;gap:9px;color:#d5d5d9;font-size:13px}.generator-range input{grid-column:1/-1;width:100%;margin:0}.generator-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 12px}.generator-buttons{display:flex;flex-wrap:wrap;gap:8px}.generator-output::selection{background:#efefef;color:#111}
</style>
