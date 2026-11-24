<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Grid2X2, KeyRound, LockKeyhole } from 'lucide-vue-next'
import BrandMark from '../components/BrandMark.vue'
import { cleanEmail, validEmail } from '../crypto.js'
import { closeVault, registerAccount, unlockAccount } from '../vault.js'

const route = useRoute()
const router = useRouter()
const signup = route.name === 'signup'
const step = ref('email')
const email = ref('')
const passphrase = ref('')
const confirmation = ref('')
const show = ref(false)
const error = ref('')
const status = ref(history.state?.vaultMessage || '')
const busy = ref(false)
const emailInput = ref()
const passInput = ref()
let mounted = true
onBeforeUnmount(() => { mounted = false; passphrase.value = confirmation.value = '' })

function submitEmail() {
  const value = cleanEmail(email.value)
  if (!validEmail(value)) { error.value = 'Enter a valid email address.'; return }
  email.value = value
  error.value = ''
  step.value = 'passphrase'
  nextTick(() => passInput.value?.focus())
}
function changeEmail() {
  step.value = 'email'; passphrase.value = confirmation.value = ''; show.value = false; error.value = ''
  nextTick(() => emailInput.value?.focus())
}
async function submitPassphrase() {
  if (busy.value) return
  error.value = ''
  if (signup && confirmation.value !== passphrase.value) { error.value = 'The passphrases do not match.'; return }
  busy.value = true
  try {
    await (signup ? registerAccount(email.value, passphrase.value) : unlockAccount(email.value, passphrase.value))
    if (!mounted) { await closeVault(); return }
    await router.replace({ name: 'vault' })
  } catch (err) { if (mounted) error.value = err.message || 'Could not open the vault. Try again.' }
  finally { busy.value = false }
}
</script>

<template>
  <div class="auth-page">
    <header class="auth-header"><BrandMark /><RouterLink :to="{ name: signup ? 'login' : 'signup' }" class="button secondary compact">{{ signup ? 'Log in' : 'Sign up' }}</RouterLink></header>
    <main id="main-content" class="auth-main">
      <section class="auth-box" aria-labelledby="auth-title">
        <div class="auth-icon"><KeyRound v-if="signup" :size="21" /><LockKeyhole v-else :size="20" /></div>
        <h1 id="auth-title">{{ signup ? 'Create your vault' : 'Unlock your vault' }}</h1>
        <p class="auth-intro">{{ signup ? 'A private home for what matters.' : 'Your private workspace awaits.' }}</p>
        <p v-if="status && step === 'email'" class="notice auth-status" role="status">{{ status }}</p>
        <form v-if="step === 'email'" class="auth-form" @submit.prevent="submitEmail">
          <label class="control" for="login-email">Email address
            <input id="login-email" ref="emailInput" v-model="email" type="email" autocomplete="username" placeholder="you@example.com" maxlength="254" required />
          </label>
          <button class="button primary" type="submit">Continue with email <ArrowRight /></button>
          <p v-if="error" role="alert" class="notice error">{{ error }}</p>
        </form>
        <form v-else class="auth-form" @submit.prevent="submitPassphrase">
          <input type="email" class="sr-only" :value="email" autocomplete="username" aria-label="Account email" tabindex="-1" readonly />
          <div class="auth-email"><span>{{ email }}</span><button type="button" class="button plain compact" :disabled="busy" @click="changeEmail">Change</button></div>
          <label class="control" for="main-passphrase">Master passphrase</label>
          <div class="field-actions auth-password">
            <input id="main-passphrase" ref="passInput" v-model="passphrase" :type="show ? 'text' : 'password'" :autocomplete="signup ? 'new-password' : 'current-password'" :minlength="signup ? 12 : undefined" maxlength="256" :placeholder="signup ? 'At least 12 characters' : 'Enter your passphrase'" required :disabled="busy" spellcheck="false" />
            <button type="button" class="icon-button" :aria-label="show ? 'Hide passphrase' : 'Show passphrase'" @click="show = !show"><EyeOff v-if="show" /><Eye v-else /></button>
          </div>
          <template v-if="signup"><label class="control" for="confirm-passphrase">Confirm master passphrase
            <input id="confirm-passphrase" v-model="confirmation" :type="show ? 'text' : 'password'" autocomplete="new-password" required maxlength="256" :disabled="busy" />
          </label><p class="helper">Choose something long and unique. There’s no password reset, so keep your passphrase somewhere safe.</p></template>
          <button class="button primary" type="submit" :disabled="busy">{{ busy ? (signup ? 'Creating…' : 'Unlocking…') : (signup ? 'Create vault' : 'Unlock vault') }} <ArrowRight v-if="!busy" /></button>
          <p v-if="error" role="alert" class="notice error">{{ error }}</p>
        </form>
        <div class="auth-separator"><span>or take a look around</span></div>
        <RouterLink class="button secondary auth-demo" :to="{ name:'demo' }"><Grid2X2 /> Explore the demo</RouterLink>
        <p class="auth-switch">{{ signup ? 'Already have a vault?' : 'New here?' }} <RouterLink :to="{ name: signup ? 'login' : 'signup' }">{{ signup ? 'Log in' : 'Create an account' }}</RouterLink></p>
      </section>
    </main>
    <footer class="auth-footer"><RouterLink to="/"><ArrowLeft :size="13" /> Home</RouterLink><RouterLink to="/guide">Help</RouterLink><RouterLink to="/privacy">Privacy</RouterLink><RouterLink to="/terms">Terms</RouterLink></footer>
  </div>
</template>

<style scoped>
.auth-page{min-height:100svh;display:grid;grid-template-rows:auto 1fr auto;background:radial-gradient(ellipse 520px 420px at 50% 43%,#101012,#0b0b0c 78%)}.auth-header{min-height:68px;display:flex;align-items:center;justify-content:space-between;padding:0 28px}.auth-main{display:grid;place-items:center;padding:38px 20px 52px}.auth-box{width:min(100%,348px);text-align:center}.auth-icon{width:43px;height:43px;border-radius:10px;display:grid;place-items:center;margin:0 auto 16px;border:1px solid #37373c;background:linear-gradient(150deg,#222225,#131315);color:#e0e0e5;box-shadow:inset 0 1px 0 #ffffff0d}.auth-box h1{font-size:31px;font-weight:630;letter-spacing:-.052em}.auth-intro{font-size:14px;margin:7px 0 23px;color:var(--muted);line-height:1.55}.auth-status{margin-bottom:14px;text-align:left}.auth-form{display:grid;gap:11px;text-align:left}.auth-form .button.primary{width:100%;margin-top:2px}.auth-form>label[for=main-passphrase]{margin-bottom:-5px}.auth-email{display:flex;align-items:center;justify-content:space-between;gap:7px;min-width:0;border-radius:7px;border:1px solid #25252a;padding:2px 3px 2px 10px;font-size:13px;color:var(--muted)}.auth-email>span{overflow-wrap:anywhere}.auth-email .button{min-height:30px}.auth-password{display:flex;gap:7px}.auth-password .icon-button{width:42px;height:42px;flex:none}.auth-form .helper{margin:0}.auth-separator{display:flex;gap:11px;align-items:center;color:#92929c;font:500 11px/1.3 var(--mono);margin:18px 0 15px}.auth-separator::before,.auth-separator::after{content:'';height:1px;background:#2d2d31;flex:1}.auth-demo{width:100%}.auth-switch{font-size:13px;margin-top:22px;color:var(--muted)}.auth-switch a{color:#f0f0f3;font-weight:560}.auth-switch a:hover,.auth-footer a:hover{text-decoration:underline;text-underline-offset:4px}.auth-footer{padding:12px 15px 20px;display:flex;align-items:center;justify-content:center;gap:17px;color:#9696a0;font-size:12px}.auth-footer a{display:inline-flex;align-items:center;gap:4px}.auth-footer a:hover{color:#fff}
@media(max-width:540px){.auth-header{min-height:59px;padding-inline:19px}.auth-main{padding-block:35px 42px}.auth-box h1{font-size:29px}}
</style>
