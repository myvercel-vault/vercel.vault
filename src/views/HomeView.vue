<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, CreditCard, FileLock2, Fingerprint, Grid2X2, KeyRound, LockKeyhole, Menu, Plus, ShieldCheck, Zap, X } from 'lucide-vue-next'
import BrandMark from '../components/BrandMark.vue'
import VaultLink from '../components/VaultLink.vue'
import { canOpenPrivate, companyAddress, media } from '../config.js'

const links = [ ['Features', '#features'], ['Security', '#security'], ['FAQ', '#faq'] ]
const features = [
  { n: '01', icon: Grid2X2, title: 'A place for everything.', text: 'Give every login, payment card, secure note, identity or SSH key a home. Find the right item without digging.' },
  { n: '02', icon: KeyRound, title: 'Stronger by default.', text: 'Generate a unique password in your browser with WebAssembly. Choose the length and the characters you want to use.' },
  { n: '03', icon: Plus, title: 'Make it your own.', text: 'Add custom fields for the details you actually need. Mark items as favourites and group them in folders.' },
]
const questions = [
  ['What can I store in my vault?', 'Keep website logins, payment card details, secure notes, identities and SSH keys in one place. Each item can have its own custom text or hidden fields.'],
  ['How is my information protected?', 'Your browser derives an encryption key from your master passphrase and encrypts your vault with AES‑256‑GCM before it syncs. The service receives the encrypted vault, not your master passphrase or the unencrypted item contents.'],
  ['Can I unlock the vault on another device?', 'Yes. On the private vault site, sign in using the same email and master passphrase. Your browser decrypts the latest synced copy locally.'],
  ['What if I forget my master passphrase?', 'This version does not offer a passphrase reset or email recovery. Keep your master passphrase somewhere safe. An encrypted backup still needs the passphrase it was made with.'],
  ['Can I try it before making an account?', 'Yes. Open the interactive demo to use the sample vault without an account. Demo changes live in memory and reset when you reload. Use made-up data only.'],
]
const statements = [[ShieldCheck, 'AES-256-GCM'], [Fingerprint, 'Client-side encryption'], [Zap, 'WebAssembly generator']]
const openFaq = ref(-1)
const menu = ref(false)
const art = ref()
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const paused = ref(false)
const reduced = ref(reduceMotion.matches)
const updateMotion = () => { reduced.value = reduceMotion.matches; if (reduced.value) resetArt() }
onMounted(() => reduceMotion.addEventListener('change', updateMotion))
onBeforeUnmount(() => reduceMotion.removeEventListener('change', updateMotion))
function toggleWallpaper() { paused.value = !paused.value; resetArt() }
function parallax(event) {
  if (reduced.value || paused.value || event.pointerType !== 'mouse' || !art.value) return
  const box = art.value.getBoundingClientRect()
  art.value.style.setProperty('--dx', `${(event.clientX - box.left - box.width / 2) / 39}px`)
  art.value.style.setProperty('--dy', `${(event.clientY - box.top - box.height / 2) / 42}px`)
}
function resetArt() {
  art.value?.style.setProperty('--dx', '0px')
  art.value?.style.setProperty('--dy', '0px')
}
</script>

<template>
  <header class="site-header">
    <div class="wrap site-header-inner">
      <BrandMark />
      <nav class="site-nav" aria-label="Main navigation"><RouterLink v-for="[label, hash] in links" :key="hash" :to="{ name:'home', hash }">{{ label }}</RouterLink></nav>
      <div class="site-actions">
        <VaultLink v-if="canOpenPrivate" mode="login" class="button plain compact">Log in</VaultLink>
        <VaultLink class="button primary compact nav-start">{{ canOpenPrivate ? "Get started" : "Read the guide" }} <ArrowUpRight /></VaultLink>
        <button type="button" class="icon-button mobile-toggle" :aria-expanded="menu" aria-controls="mobile-nav" :aria-label="menu ? 'Close navigation' : 'Open navigation'" @click="menu = !menu"><X v-if="menu" /><Menu v-else /></button>
      </div>
    </div>
    <nav v-if="menu" id="mobile-nav" class="mobile-nav" aria-label="Mobile navigation">
      <RouterLink v-for="[label, hash] in links" :key="hash" :to="{ name:'home', hash }" @click="menu = false">{{ label }} <ArrowUpRight :size="14" /></RouterLink>
      <VaultLink v-if="canOpenPrivate" mode="login" @click="menu = false">Log in <ArrowRight :size="14" /></VaultLink>
    </nav>
  </header>
  <main id="main-content" class="home-main">
    <section class="hero wrap" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="hero-badge"><span class="hero-badge-icon"><LockKeyhole :size="12" /></span> THE PRIVATE WORKSPACE</div>
        <h1 id="hero-title">Your digital life.<br><span>Under lock.</span></h1>
        <p>Passwords, notes, cards, and everything you keep close. One beautifully simple vault, built for what’s yours.</p>
        <div class="hero-actions">
          <VaultLink class="button primary hero-button">{{ canOpenPrivate ? "Create your vault" : "Read the vault guide" }} <ArrowRight /></VaultLink>
          <RouterLink class="button secondary hero-button" :to="{ name:'demo' }"><Grid2X2 /> Explore demo</RouterLink>
        </div>
      </div>
      <div ref="art" class="hero-art" :class="{ 'wallpaper-paused':paused || reduced }" @pointermove="parallax" @pointerleave="resetArt">
        <div class="visual-index" aria-hidden="true"><span>FIG. 01</span><i></i><span>THE VAULT</span></div>
        <div class="art-frame" aria-hidden="true">
          <img class="phone-art" :src="media('vault-phone.webp')" alt="" width="1024" height="1024" fetchpriority="high" />
          <div class="phone-screen"><div class="wallpaper">
            <div class="screen-aura"></div><div class="screen-outline"></div>
            <img :src="media('vault-mark.png')" width="356" height="380" alt="" />
            <div class="wallpaper-type"><span>MY VERCEL VAULT</span><i></i></div>
          </div></div>
        </div>
        <span v-if="reduced" class="visual-state"><i></i><span>WALLPAPER STATIC</span></span>
        <button v-else class="visual-state state-control" type="button" :aria-label="paused ? 'Play wallpaper' : 'Pause wallpaper'" :title="paused ? 'Play wallpaper' : 'Pause wallpaper'" @click="toggleWallpaper"><i></i><span>{{ paused ? 'WALLPAPER PAUSED' : 'LIVE WALLPAPER' }}</span></button>
        <span class="art-plus" aria-hidden="true">+</span>
      </div>
      <RouterLink class="hero-index" :to="{ name:'home', hash:'#features' }"><ArrowDownRight :size="13" /> EXPLORE THE VAULT</RouterLink>
    </section>
    <div class="trust-shell"><div class="wrap trust-band">
      <div v-for="[icon, title] in statements" :key="title" class="trust-item"><component :is="icon" :size="17" />{{ title }}</div>
    </div></div>

    <section id="features" class="wrap feature-section" aria-labelledby="features-title">
      <div class="section-heading">
        <div class="kicker"><span class="tick"></span> 01 / The essentials</div>
        <h2 id="features-title">Space for what matters.</h2>
        <p>Keep everything important organised, protected, and right where you left it.</p>
      </div>
      <div class="feature-grid">
        <article v-for="feature in features" :key="feature.n" class="feature-card">
          <div class="feature-top"><span class="feature-icon"><component :is="feature.icon" :size="21" /></span><span class="feature-number">/ {{ feature.n }}</span></div>
          <h3>{{ feature.title }}</h3><p>{{ feature.text }}</p>
        </article>
      </div>
      <RouterLink class="inline-link feature-link" :to="{ name:'demo' }">See the workspace in action <ArrowUpRight :size="16" /></RouterLink>
    </section>

    <section id="security" class="wrap security-section" aria-labelledby="security-title">
      <div class="security-card">
        <div class="security-copy">
          <div class="kicker"><span class="tick"></span> 02 / Built for privacy</div>
          <h2 id="security-title">Your vault.<br><span>Your key.</span></h2>
          <p>Your vault is encrypted in your browser before it leaves your device. Your master passphrase stays with you.</p>
          <ul><li><Check :size="15" /> Unlock and decrypt locally</li><li><Check :size="15" /> Encrypted vault backups</li><li><Check :size="15" /> Automatic locking when idle</li></ul>
          <RouterLink class="inline-link" :to="{ name:'guide', hash:'#security-details' }">Read the security guide <ArrowUpRight :size="16" /></RouterLink>
        </div>
        <div class="security-visual"><img :src="media('vault-dial.webp')" alt="A brushed-metal vault dial with concentric rings" width="896" height="896" loading="lazy" /><div class="security-caption"><span>FIG. 02</span><span>///</span><span>THE LOCK</span></div></div>
      </div>
    </section>

    <section id="faq" class="wrap faq-section" aria-labelledby="faq-title">
      <div class="section-heading faq-heading"><div class="kicker"><span class="tick"></span> 03 / Good to know</div><h2 id="faq-title">A few answers.</h2><p>Everything you need to know before you lock things away.</p><RouterLink class="inline-link" :to="{name:'guide'}"><CircleHelp :size="16" /> Open the guide <ArrowUpRight :size="15" /></RouterLink></div>
      <div class="accordion">
        <div v-for="([question, answer], n) in questions" :key="question" class="faq-item">
          <h3><button type="button" :aria-expanded="openFaq === n" :aria-controls="`faq-answer-${n}`" @click="openFaq = openFaq === n ? -1 : n">{{ question }} <ChevronDown :size="17" /></button></h3>
          <div v-show="openFaq === n" :id="`faq-answer-${n}`" class="faq-answer">{{ answer }}</div>
        </div>
      </div>
    </section>

    <section class="closing" aria-labelledby="closing-title"><div class="wrap closing-inner">
      <span class="closing-mark"><img :src="media('vault-mark.png')" width="34" height="37" alt="" /></span>
      <h2 id="closing-title">Some things should stay yours.</h2>
      <p>Give your digital life a place to call home.</p>
      <VaultLink class="button primary hero-button">{{ canOpenPrivate ? "Create your vault" : "Read the vault guide" }} <ArrowRight /></VaultLink>
    </div></section>
  </main>
  <footer class="site-footer"><div class="wrap">
    <div class="footer-main">
      <div class="footer-brand"><BrandMark /><p>A private workspace for the things you keep close.</p><address><span>Company address</span>{{ companyAddress || 'Not yet published.' }}</address></div>
      <div class="footer-links"><h3>Product</h3><RouterLink :to="{name:'home',hash:'#features'}">Features</RouterLink><RouterLink :to="{name:'home',hash:'#security'}">Security</RouterLink><RouterLink :to="{name:'demo'}">Interactive demo</RouterLink></div>
      <div class="footer-links"><h3>Resources</h3><RouterLink :to="{name:'guide'}">Vault guide</RouterLink><RouterLink :to="{name:'home',hash:'#faq'}">FAQ</RouterLink><VaultLink v-if="canOpenPrivate" mode="login">Log in</VaultLink></div>
      <div class="footer-links"><h3>Legal</h3><RouterLink :to="{name:'privacy'}">Privacy</RouterLink><RouterLink :to="{name:'terms'}">Terms</RouterLink></div>
    </div>
    <div class="footer-end"><span>© {{ new Date().getFullYear() }} My Vercel Vault. Independent project.</span><span><span class="footer-dot"></span> DESIGNED FOR PRIVACY</span></div>
  </div></footer>
</template>

<style src="./home.css"></style>
