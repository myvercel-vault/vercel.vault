import { createApp, nextTick } from 'vue'
import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import HomeView from './views/HomeView.vue'
import { vault, closeVault } from './vault.js'
import { pagesMode } from './config.js'
import './base.css'

const privateRoutes = pagesMode ? [
  { path: '/login', redirect: '/demo' }, { path: '/signup', redirect: '/demo' }, { path: '/vault', redirect: '/demo' },
] : [
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue') },
  { path: '/signup', name: 'signup', component: () => import('./views/LoginView.vue') },
  { path: '/vault', name: 'vault', component: () => import('./views/WorkspaceView.vue') },
]
const router = createRouter({
  history: pagesMode ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    ...privateRoutes,
    { path: '/demo', name: 'demo', component: () => import('./views/WorkspaceView.vue') },
    { path: '/guide', name: 'guide', component: () => import('./views/DocsView.vue') },
    { path: '/privacy', name: 'privacy', component: () => import('./views/DocsView.vue') },
    { path: '/terms', name: 'terms', component: () => import('./views/DocsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  async scrollBehavior(to, from, saved) {
    await nextTick()
    if (to.hash) {
      const el = document.getElementById(to.hash.slice(1))
      if (el) return { el, top: parseFloat(getComputedStyle(el).scrollMarginTop) || 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }
    }
    if (to.path === from.path) return
    return saved || { top: 0 }
  },
})
router.beforeEach((to, from) => {
  if (to.name === 'vault' && !vault.open) return { name: 'login' }
  if (from.name === 'vault' && to.name !== 'vault' && vault.open) closeVault().catch(() => {})
})
router.afterEach((to) => {
  const titles = { login: 'Unlock', signup: 'Create your vault', vault: 'My vault', demo: 'Interactive demo', guide: 'Vault guide', privacy: 'Privacy', terms: 'Terms' }
  document.title = to.name === 'home' ? 'My Vercel Vault — Your digital life. Under lock.' : `${titles[to.name] ?? 'Workspace'} — My Vercel Vault`
})
createApp(App).use(router).mount('#app')
