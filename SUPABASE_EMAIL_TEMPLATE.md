# Supabase Email Template Customization

## How to Customize Password Reset Emails

To make password reset emails clearer and more branded for CollabCanvas:

### 1. Go to Supabase Dashboard
Navigate to: https://supabase.com/dashboard → Your Project → Authentication → Email Templates

### 2. Select "Reset Password" Template

### 3. Replace the Template with This:

```html
<h2>Reset Your CollabCanvas Password</h2>

<p>Hi there,</p>

<p>Someone requested a password reset for your <strong>CollabCanvas</strong> account associated with {{ .Email }}.</p>

<p>If this was you, click the button below to reset your password:</p>

<p><a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a></p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p><strong>This link will expire in 1 hour.</strong></p>

<p>If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

<hr>

<p style="color: #6b7280; font-size: 12px;">
  This email was sent from <strong>CollabCanvas</strong> - Your Real-Time Collaborative Design Platform<br>
  <a href="https://collabcanvas.vercel.app">collabcanvas.vercel.app</a>
</p>
```

### 4. Customize the Subject Line (Optional)

Change the subject to:
```
Reset Your CollabCanvas Password
```

### 5. Save the Template

Click "Save" to apply your changes.

---

## Alternative: Basic Text Template

If you prefer a simpler text-only version:

```
Reset Your CollabCanvas Password
==================================

Hi there,

Someone requested a password reset for your CollabCanvas account ({{ .Email }}).

If this was you, click here to reset your password:
{{ .ConfirmationURL }}

This link will expire in 1 hour.

If you didn't request this, you can safely ignore this email.

---
CollabCanvas - Real-Time Collaborative Design Platform
https://collabcanvas.vercel.app
```

---

## Testing

After saving, test the password reset flow:
1. Go to your login page
2. Click "Forgot password?"
3. Enter your email
4. Check your inbox for the branded email

The email will now clearly indicate it's from CollabCanvas and include your branding!

