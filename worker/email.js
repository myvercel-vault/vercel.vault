const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

function layout({ title, preheader, userName, supportEmail, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#000000;color:#ffffff;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#000000">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border-collapse:collapse;border:1px solid #292929;background:#0a0a0a">
<tr><td style="background:#ffffff;padding:24px 32px"><span style="color:#111111;font-size:18px;font-weight:800;letter-spacing:-0.4px">MYVERCEL VAULT</span></td></tr>
<tr><td style="padding:36px 32px 20px;border-bottom:1px solid #242424">
<p style="margin:0 0 12px;color:#a1a1aa;font-size:12px;letter-spacing:2px;font-weight:bold">MYVERCEL VAULT</p>
<h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25">${escapeHtml(title)}</h1>
</td></tr>
<tr><td style="padding:28px 32px 36px;color:#d4d4d8;font-size:16px;line-height:1.65">
<p style="margin:0 0 20px">Hi ${escapeHtml(userName)},</p>
${body}
</td></tr>
<tr><td style="border-top:1px solid #242424;padding:24px 32px;color:#a1a1aa;font-size:13px;line-height:1.6">Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#ffffff;text-decoration:underline">${escapeHtml(supportEmail)}</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

export async function sendMailtrap(env, { to, subject, text, html }) {
  if (!env.MAILTRAP_API_TOKEN) throw new Error('MAILTRAP_API_TOKEN is not configured')
  if (!env.MAILTRAP_FROM_EMAIL) throw new Error('MAILTRAP_FROM_EMAIL is not configured')

  const response = await fetch('https://send.api.mailtrap.io/api/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MAILTRAP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: { email: env.MAILTRAP_FROM_EMAIL, name: env.MAILTRAP_FROM_NAME || 'MyVercel Vault' },
      to: [{ email: to }],
      subject,
      text,
      html,
    }),
  })

  if (!response.ok) {
    console.error('Mailtrap rejected email', response.status)
    throw new Error('Email could not be sent')
  }
}

export function accountCreatedEmail({ email, userName, supportEmail }) {
  const title = 'Verify your MyVercel Vault account'
  return {
    to: email,
    subject: title,
    text: `Hi ${userName},\n\nYour MyVercel Vault account has been created. Please verify your email address. We have sent a separate email with a six-digit verification code.\n\nNeed help? ${supportEmail}`,
    html: layout({
      title,
      preheader: 'Your account was created. Check your inbox for a six-digit verification code.',
      userName,
      supportEmail,
      body: `<p style="margin:0 0 18px">Your MyVercel Vault account has been created. Please verify your email address to finish setting up your account.</p>
<p style="margin:0 0 18px">We have sent a separate email with your six-digit verification code. Enter that code on the verification screen to continue.</p>
<p style="margin:0 0 8px;color:#ffffff;font-weight:bold">Didn't create this account?</p>
<p style="margin:0;color:#a1a1aa">You can ignore this email.</p>`,
    }),
  }
}

export function otpEmail({ email, userName, supportEmail, code, expiryMinutes }) {
  const title = 'Your email verification code'
  return {
    to: email,
    subject: title,
    text: `Hi ${userName},\n\nEnter this code to verify your email address: ${code}\n\nThis code expires in ${expiryMinutes} minutes. Never share this code.\n\nNeed help? ${supportEmail}`,
    html: layout({
      title,
      preheader: 'Use this six-digit code to verify your MyVercel Vault email address.',
      userName,
      supportEmail,
      body: `<p style="margin:0 0 18px">Enter this six-digit code to verify your email address:</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:1px solid #424242;background:#111111;padding:20px;font-size:34px;font-weight:bold;letter-spacing:10px;color:#ffffff">${escapeHtml(code)}</td></tr></table>
<p style="margin:18px 0 0">This code expires in <strong style="color:#ffffff">${expiryMinutes} minutes</strong>.</p>
<p style="margin:12px 0 0;color:#a1a1aa">Never share this code. If you didn't request it, you can ignore this email.</p>`,
    }),
  }
}

export function welcomeEmail({ email, userName, supportEmail, loginUrl }) {
  const title = 'Welcome to MyVercel Vault'
  const safeLoginUrl = escapeHtml(loginUrl)
  return {
    to: email,
    subject: title,
    text: `Hi ${userName},\n\nYour email address is verified and your account is ready.\n\nSign in: ${loginUrl}\n\nNeed help? ${supportEmail}`,
    html: layout({
      title,
      preheader: 'Your email is verified. Your vault is ready.',
      userName,
      supportEmail,
      body: `<p style="margin:0 0 22px">Your email address is verified, and your MyVercel Vault account is ready.</p>
<table role="presentation"><tr><td style="background:#ffffff;padding:14px 24px"><a href="${safeLoginUrl}" style="display:inline-block;color:#111111;text-decoration:none;font-weight:bold">Sign in to MyVercel Vault</a></td></tr></table>
<p style="margin:24px 0 6px;color:#a1a1aa;font-size:14px">If the button doesn't work, copy this link:</p>
<p style="margin:0;word-break:break-all;font-size:14px"><a href="${safeLoginUrl}" style="color:#ffffff;text-decoration:underline">${safeLoginUrl}</a></p>`,
    }),
  }
}
