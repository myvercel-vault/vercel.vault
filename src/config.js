export const pagesMode = import.meta.env.VITE_HOSTING === 'pages'
export const media = (file) => `${import.meta.env.BASE_URL}media/${file}`
let configuredVault = ''
try {
  const url = new URL(import.meta.env.VITE_VAULT_URL)
  if (url.protocol === 'https:' && !url.username && !url.password) configuredVault = url.origin
} catch { /* Standalone demo build */ }
export const vaultHost = configuredVault
export const canOpenPrivate = !pagesMode || Boolean(vaultHost)
export const companyAddress = import.meta.env.VITE_COMPANY_ADDRESS?.trim() || ''
