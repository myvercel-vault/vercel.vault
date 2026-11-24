<script setup>
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { ArrowLeft, ArrowRight, BookOpen, LockKeyhole, Shield } from 'lucide-vue-next'
import BrandMark from '../components/BrandMark.vue'
import VaultLink from '../components/VaultLink.vue'
import { canOpenPrivate, companyAddress } from '../config.js'

const pages = {
  guide: { icon: BookOpen, title: 'Vault guide', intro: 'Everything you need to get a vault organised and keep it that way.', sections: [
    ['getting-started','Get started','Create an account with your email and a long, unique master passphrase. Save the passphrase in a safe place: there is no reset mechanism. If you only want to look around, use the interactive demo and stick to made-up information.'],
    ['organise','Organise your vault','Choose Create item, pick a type, give the item a name, and fill in the details you want to save. Use Custom field to add text or a hidden value, then select Create. Find your saved items by category, folder, favourites, or by searching their names and non-secret labels.'],
    ['security-details','How encryption works','The browser derives keys using PBKDF2 with SHA-256 and 600,000 iterations, then uses HKDF to separate the authentication and encryption keys. The vault document is encrypted with AES-256-GCM before it syncs. The service stores an authentication verifier and an encrypted copy of your vault. Strong master passphrases still matter.'],
    ['tools','Tools and backups','The password generator uses browser randomness and a WebAssembly module. Settings lets you download an encrypted backup or restore one to the same account using its original master passphrase. The restore replaces the current vault, so export your latest copy first.'],
    ['lock','Lock when you step away','Select Lock vault to close the current session. The app also locks after inactivity or a page reload. The generator and reports never send saved passwords to an external service. Reports are basic local checks, not a breach scan.'],
  ] },
  privacy: { icon: Shield, title: 'Privacy', intro: 'What the vault receives and what stays in your browser.', sections: [
    ['account-data','Account data','The private vault service stores your email, sign-in verifier, key-derivation salt, encrypted vault, and session and rate-limit records. It does not receive your master passphrase or the decrypted contents of your items. The public demo does not send entries to the service and clears them when you reload.'],
    ['device','On your device','The unlocked vault and active session exist in browser memory. If you use Copy, the system clipboard may retain that value until you overwrite it. Encrypted backup files remain on the device or other storage location you choose.'],
    ['deletion','Deletion and backups','Use Settings to delete your account and the active vault from the service. Deleted data may remain in infrastructure backups until their retention period expires. Local downloads are yours to remove.'],
  ] },
  terms: { icon: LockKeyhole, title: 'Terms', intro: 'Use this early release with care.', sections: [
    ['use','Use of the service','Use only accounts and information you own or are authorised to manage. This is an independent project, not a service offered by or affiliated with any other vault or hosting provider. The interactive demo is for sample data only.'],
    ['recovery','Keep a recovery plan','Keep an encrypted backup and protect your master passphrase. The service cannot reset your passphrase or recover your encrypted items if you lose it. Do not rely on this release as your only copy.'],
    ['availability','Availability','This release has not undergone an independent security audit and is provided as-is. The operator should review these terms and privacy information before any public production deployment.'],
  ] },
}
const route = useRoute()
const page = computed(() => pages[route.name] || pages.guide)
</script>

<template>
  <div class="docs-page">
    <header class="docs-nav wrap"><BrandMark /><RouterLink class="button secondary compact" to="/"><ArrowLeft /> Back to home</RouterLink></header>
    <main id="main-content" class="wrap doc-wrap">
      <div class="doc-heading"><div class="doc-icon"><component :is="page.icon" :size="22" /></div><div class="kicker"><span class="tick"></span> My Vercel Vault</div><h1>{{ page.title }}</h1><p>{{ page.intro }}</p></div>
      <div class="doc-grid">
        <nav aria-label="On this page"><h2>On this page</h2><RouterLink v-for="[id, label] in page.sections" :key="id" :to="{name:route.name,hash:`#${id}`}">{{ label }}</RouterLink></nav>
        <div class="doc-body"><section v-for="[id, title, copy] in page.sections" :id="id" :key="id"><h2>{{ title }}</h2><p>{{ copy }}</p></section>
        <VaultLink v-if="canOpenPrivate" class="button primary">Open your vault <ArrowRight /></VaultLink><RouterLink v-else class="button primary" :to="{name:'demo'}">Explore the demo <ArrowRight /></RouterLink></div>
      </div>
    </main>
    <footer class="docs-foot wrap"><span>My Vercel Vault · {{ companyAddress || 'Company address not yet published' }}</span><div><RouterLink to="/guide">Guide</RouterLink><RouterLink to="/privacy">Privacy</RouterLink><RouterLink to="/terms">Terms</RouterLink></div></footer>
  </div>
</template>

<style scoped>
.docs-page{min-height:100svh;display:flex;flex-direction:column}.docs-nav{height:69px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #29292c}.doc-wrap{padding-block:58px 70px;max-width:1010px;flex:1}.doc-heading{padding-bottom:33px;border-bottom:1px solid #2b2b30;margin-bottom:34px}.doc-icon{width:45px;height:45px;display:grid;place-items:center;background:#1b1b1e;border:1px solid #37373b;border-radius:10px;margin-bottom:16px}.doc-heading h1{font-size:clamp(43px,7vw,73px);font-weight:630;letter-spacing:-.075em;line-height:1.05;margin-top:10px}.doc-heading p{font-size:16px;color:var(--muted);line-height:1.55;margin-top:10px}.doc-grid{display:grid;grid-template-columns:210px minmax(0,1fr);gap:48px}.doc-grid nav{display:grid;gap:12px;align-self:start;position:sticky;top:25px;padding-left:13px;border-left:1px solid #353538}.doc-grid nav h2{font-size:13px;font-weight:630}.doc-grid nav a{font-size:13px;color:var(--muted);line-height:1.4}.doc-grid nav a:hover,.docs-foot a:hover{color:#fff;text-decoration:underline;text-underline-offset:4px}.doc-body{display:grid;gap:27px;justify-items:start}.doc-body section{scroll-margin-top:28px}.doc-body h2{font-size:22px;font-weight:600;letter-spacing:-.04em;margin-bottom:7px}.doc-body p{font-size:15px;color:#acacb5;line-height:1.65;max-width:630px}.docs-foot{border-top:1px solid #29292d;padding-block:19px;display:flex;justify-content:space-between;gap:14px;color:var(--muted);font-size:12px}.docs-foot div{display:flex;gap:12px}
@media(max-width:640px){.doc-wrap{padding-block:40px}.doc-grid{grid-template-columns:1fr;gap:23px}.doc-grid nav{position:static}.docs-foot{flex-wrap:wrap}}
</style>
