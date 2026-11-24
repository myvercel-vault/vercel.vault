<script setup>
import { onMounted, ref } from 'vue'
import { X } from 'lucide-vue-next'
defineProps({ title: { type: String, required: true }, subtitle: String, wide: Boolean, busy: Boolean })
const emit = defineEmits(['close'])
const dialog = ref()
onMounted(() => dialog.value?.showModal())
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="modal" :class="{ wide }" aria-labelledby="dialog-title" @cancel.prevent="!busy && emit('close')" @click.self="!busy && emit('close')">
      <div class="modal-inner">
        <div class="modal-head">
          <div><h2 id="dialog-title">{{ title }}</h2><p v-if="subtitle">{{ subtitle }}</p></div>
          <button type="button" class="icon-button bare" aria-label="Close dialog" :disabled="busy" @click="emit('close')"><X /></button>
        </div>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>

<style>
.modal{width:min(500px,calc(100% - 30px));padding:0;max-height:calc(100% - 30px);color:var(--white);background:#111113;border:1px solid #353539;border-radius:14px;box-shadow:0 34px 100px #000d;overflow:auto;overscroll-behavior:contain}.modal.wide{width:min(570px,calc(100% - 30px))}.modal::backdrop{background:#000b;backdrop-filter:blur(5px)}.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:22px}.modal-head h2{font-size:22px;font-weight:620;letter-spacing:-.04em}.modal-head p{color:var(--muted);font-size:13px;margin-top:5px;line-height:1.55}.modal-inner{padding:23px}.modal-head>.icon-button{margin:-5px -7px 0 0;flex:none}.dialog-stack{display:grid;gap:14px}.dialog-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:wrap;margin-top:5px}.dialog-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field-actions{display:flex;gap:6px;align-items:flex-start}.field-actions .control,.field-actions input,.field-actions textarea{min-width:0;flex:1}.field-actions>.icon-button{height:42px;width:40px;flex:none}.hint-line{margin-top:-5px}.modal input[type=file]{background:transparent;padding:7px;font-size:12px}.modal input[type=file]::file-selector-button{border:1px solid #37373c;background:#242427;padding:5px 8px;border-radius:5px;color:#e9e9ed;margin-right:8px;cursor:pointer}.check-row{display:flex;gap:8px;align-items:center;color:#c5c5cb;font-size:13px}.check-row input{width:15px;height:15px;margin:0;flex:none}
@media(max-width:460px){.modal-inner{padding:18px}.dialog-split{grid-template-columns:1fr}}
</style>
