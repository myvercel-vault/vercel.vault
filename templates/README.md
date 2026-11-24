# MyVercel Vault email templates

These are three independent, provider-neutral HTML emails. Send them in this order:

1. `01-account-created.html` — Subject: **Verify your MyVercel Vault account**. Preheader: Your account was created. Check your inbox for a six-digit verification code.
2. `02-verification-otp.html` — Subject: **Your email verification code**. Preheader: Use this six-digit code to verify your MyVercel Vault email address.
3. `03-welcome.html` — Subject: **Welcome to MyVercel Vault**. Preheader: Your email is verified. Your vault is ready.

The welcome email is appropriate only after successful verification. Replace placeholders server-side with HTML-escaped values. Validate `login_url` as a trusted HTTPS URL. The email display does not enforce OTP expiry; the backend must enforce the actual configured period. Replace the placeholder in the subject if you change the brand.

| Placeholder | Used in | Meaning |
| --- | --- | --- |
| `{{user_name}}` | All | Customer's display name |
| `{{support_email}}` | All | Support address |
| `{{otp_code}}` | OTP | Six-digit code, shown only in the body |
| `{{otp_expiry_minutes}}` | OTP | Actual validity period configured in the backend |
| `{{login_url}}` | Welcome | Trusted HTTPS sign-in link |

The supplied external SVG logo is in a white header so its dark lettering stays visible. Some email clients block external images or SVG; the text heading and instructions remain readable. If your sending provider strips SVG, host an equivalent PNG logo and replace the image URL.

## Plain-text alternatives

### Account created
Subject: Verify your MyVercel Vault account

Hi {{user_name}},

Your MyVercel Vault account has been created. Please verify your email address to finish setting up your account.

We have sent a separate email with your six-digit verification code. Enter that code on the verification screen to continue.

Didn't create this account? You can ignore this email. Need help? Contact {{support_email}}.

MyVercel Vault

### Verification OTP
Subject: Your email verification code

Hi {{user_name}},

Enter this six-digit code to verify your email address for MyVercel Vault:

{{otp_code}}

This code expires in {{otp_expiry_minutes}} minutes. Never share this code. If you didn't request it, you can ignore this email.

Need help? Contact {{support_email}}.

MyVercel Vault

### Welcome
Subject: Welcome to MyVercel Vault

Hi {{user_name}},

Your email address is verified, and your MyVercel Vault account is ready. You can now sign in and start organizing your vault.

Sign in: {{login_url}}

Need help? Contact {{support_email}}.

MyVercel Vault
