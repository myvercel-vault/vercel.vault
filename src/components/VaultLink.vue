<script setup>
import { RouterLink } from 'vue-router'
import { pagesMode, vaultHost } from '../config.js'
defineProps({ mode: { type: String, default: 'signup' } })
</script>

<template>
  <a v-if="pagesMode && vaultHost" :href="`${vaultHost}/${mode}`"><slot /></a>
  <RouterLink v-else :to="{ name: pagesMode ? 'guide' : mode }"><slot /></RouterLink>
</template>
