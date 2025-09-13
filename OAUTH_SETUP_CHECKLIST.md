# OAuth Setup Checklist for Vercel + Supabase

Based on the [Supabase Google Auth documentation](https://supabase.com/docs/guides/auth/social-login/auth-google), here's your complete setup checklist:

## ✅ Code Implementation (COMPLETED)

Your `src/auth.js` implementation is now properly configured with:
- ✅ Production redirect URL: `https://agets.vercel.app/login.html`
- ✅ `access_type: 'offline'` for refresh tokens
- ✅ `prompt: 'select_account'` for better UX
- ✅ Proper error handling

## 🔧 Google Cloud Console Configuration (REQUIRED)

### 1. Consent Screen Setup
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Navigate to **APIs & Services > Consent Screen**
- [ ] Under **Authorized domains**, add: `bwkqyjfizhvrrylqjxng.supabase.co`
- [ ] Configure required scopes:
  - [ ] `.../auth/userinfo.email`
  - [ ] `.../auth/userinfo.profile` 
  - [ ] `openid`

### 2. OAuth Client Configuration
- [ ] Go to **APIs & Services > Credentials**
- [ ] Click **Create credentials > OAuth Client ID**
- [ ] Choose **Web application**
- [ ] Under **Authorized JavaScript origins**, add:
  - [ ] `https://agets.vercel.app`
  - [ ] `http://localhost:3000` (for local development)
- [ ] Under **Authorized redirect URLs**, add:
  - [ ] `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`
  - [ ] `https://agets.vercel.app/login.html`

## 🔧 Supabase Dashboard Configuration (REQUIRED)

### 1. Google Provider Setup
- [ ] Go to your [Supabase Dashboard](https://supabase.com/dashboard)
- [ ] Navigate to **Authentication > Providers**
- [ ] Enable **Google** provider
- [ ] Add your Google OAuth credentials:
  - [ ] **Client ID**: (from Google Cloud Console)
  - [ ] **Client Secret**: (from Google Cloud Console)

### 2. Redirect URLs Configuration
- [ ] In Supabase Dashboard, go to **Authentication > URL Configuration**
- [ ] Add to **Redirect URLs**:
  - [ ] `https://agets.vercel.app/login.html`
  - [ ] `https://agets.vercel.app/`
  - [ ] `http://localhost:3000/login.html` (for local dev)

## 🔧 Vercel Environment Variables (REQUIRED)

Set these in your Vercel project settings:

```bash
VITE_SUPABASE_URL=https://bwkqyjfizhvrrylqjxng.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU
VITE_GOOGLE_REDIRECT_TO=https://agets.vercel.app/login.html
VITE_REQUIRE_AUTH=true
```

## 🔧 Local Development Environment

Create `.env` file in your project root:

```bash
VITE_SUPABASE_URL=https://bwkqyjfizhvrrylqjxng.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU
VITE_GOOGLE_REDIRECT_TO=http://localhost:3000/login.html
VITE_REQUIRE_AUTH=false
```

## 🧪 Testing Checklist

### Local Testing
- [ ] Run `npm run dev`
- [ ] Navigate to `http://localhost:3000`
- [ ] Click "Sign in with Google"
- [ ] Verify redirect to Google OAuth
- [ ] Complete authentication
- [ ] Verify redirect back to localhost

### Production Testing
- [ ] Deploy to Vercel
- [ ] Navigate to `https://agets.vercel.app`
- [ ] Click "Sign in with Google"
- [ ] Verify redirect to Google OAuth
- [ ] Complete authentication
- [ ] Verify redirect back to production URL

## 🚨 Common Issues & Solutions

### Issue: "redirect_uri_mismatch"
**Solution**: Ensure redirect URLs in Google Cloud Console exactly match:
- `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`

### Issue: "unauthorized_client"
**Solution**: Verify Client ID and Secret are correctly set in Supabase Dashboard

### Issue: "access_denied"
**Solution**: Check that your domain is added to Google Cloud Console authorized domains

### Issue: Session not persisting
**Solution**: Verify `detectSessionInUrl: true` is set in Supabase client config (✅ already configured)

## 📋 Next Steps

1. Complete Google Cloud Console configuration
2. Complete Supabase Dashboard configuration  
3. Set Vercel environment variables
4. Test locally and in production
5. Monitor authentication logs in Supabase Dashboard

## 🔗 Important Links

- [Supabase Google Auth Docs](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
