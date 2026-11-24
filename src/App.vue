<script setup>
import { RouterView } from 'vue-router'
</script>
 
<template>
  <a href="#main-content" class="skip-link">Skip to content</a>
  <RouterView v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" key="$route.path" />
    </transition>
  </RouterView>
</template>
 
<style scoped>
.skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
  
.skip-link:focus {
  position: fixed;
  top: 12px;
  left: 12px;
  width: auto;
  height: auto;
  padding: 8px 14px;
  background: #09090a;
  color: #f0f0f3;
  border: 1px solid #f0f0f3;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  z-index: 10000;
  text-decoration: none;
  clip: auto;
  overflow: visible;

}

.fade-enter-active, .fade-leave-active {

  transition: opacity 0.22s ease;

} 
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
