<script setup>
import { RouterLink } from 'vue-router'
import { media } from '../config.js'
defineProps({ iconOnly: Boolean, to: { type: String, default: '/' } })
</script>

<template>
  <RouterLink :to="to" class="brand" aria-label="My Vercel Vault home">
    <span class="brand-icon"><img :src="media('vault-mark.png')" alt="" width="32" height="34" /></span>
    <span v-if="!iconOnly" class="brand-name">My Vercel <span>Vault</span></span>
  </RouterLink>
</template>
