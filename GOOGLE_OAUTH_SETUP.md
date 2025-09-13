# Google OAuth Setup Verification Guide

This document verifies the Google OAuth configuration for both Vercel deployment and Supabase integration according to the [official Supabase documentation](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Current Configuration

### Supabase Project Details
- **Project URL**: `https://bwkqyjfizhvrrylqjxng.supabase.co`
- **Callback URL**: `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`

### Google OAuth Credentials
- **Client ID**: `[YOUR_GOOGLE_CLIENT_ID].apps.googleusercontent.com`
- **Client Secret**: `[YOUR_GOOGLE_CLIENT_SECRET]`

> **Note**: Replace placeholders with your actual Google OAuth credentials from the Google Cloud Console.

### Production URLs
- **Vercel App**: `https://agets.vercel.app`
- **Login Page**: `https://agets.vercel.app/login.html`

## Required Google Cloud Console Configuration

### 1. Authorized JavaScript Origins
Add these URLs to your Google Cloud Console OAuth client:
```
https://agets.vercel.app
http://localhost:3000
```

### 2. Authorized Redirect URLs
Add this exact URL (from Supabase dashboard):
```
https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback
```

### 3. Consent Screen Configuration
- **Authorized domains**: Add `bwkqyjfizhvrrylqjxng.supabase.co`
- **Scopes**: Configure these non-sensitive scopes:
  - `.../auth/userinfo.email`
  - `.../auth/userinfo.profile`
  - `openid`

## Supabase Dashboard Configuration

### Google Auth Provider Settings
In your Supabase Dashboard → Authentication → Providers → Google:

1. **Enable Google provider**: ✅ Toggle ON
2. **Client ID**: `[YOUR_GOOGLE_CLIENT_ID].apps.googleusercontent.com`
3. **Client Secret**: `[YOUR_GOOGLE_CLIENT_SECRET]`

## Environment Variables

### For Local Development (.env file)
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://bwkqyjfizhvrrylqjxng.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU
VITE_REQUIRE_AUTH=true
VITE_GOOGLE_REDIRECT_TO=https://agets.vercel.app/login.html
```

### For Vercel Deployment
Add these environment variables in your Vercel dashboard:
```
VITE_SUPABASE_URL=https://bwkqyjfizhvrrylqjxng.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3a3F5amZpemh2cnJ5bHFqeG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxNzQ1ODQsImV4cCI6MjA3Mjc1MDU4NH0.yHHslRbEfFtVScZGf5stehBsZvrMbD8223Gd0apNxBU
VITE_REQUIRE_AUTH=true
VITE_GOOGLE_REDIRECT_TO=https://agets.vercel.app/login.html
```

## Code Configuration

### Enhanced OAuth Parameters
The `signInWithGoogle()` function now includes:
- `prompt: 'select_account'` - Forces account selection
- `access_type: 'offline'` - Enables refresh tokens for better session management

### Redirect Flow
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. After consent, Google redirects to: `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`
4. Supabase processes the OAuth response
5. User is redirected to: `https://agets.vercel.app/login.html`
6. User is authenticated and can access the app

## Verification Checklist

### Google Cloud Console ✅
- [ ] OAuth client created with correct application type (Web application)
- [ ] Authorized JavaScript origins include both production and localhost URLs
- [ ] Authorized redirect URLs include the exact Supabase callback URL
- [ ] Consent screen configured with proper scopes and authorized domains

### Supabase Dashboard ✅
- [ ] Google provider enabled
- [ ] Client ID and Secret correctly entered
- [ ] Callback URL matches Google Console configuration

### Code Configuration ✅
- [ ] `signInWithGoogle()` function uses production redirect URL
- [ ] OAuth parameters include `access_type: 'offline'` for refresh tokens
- [ ] Environment variables properly configured for both local and production

### Testing ✅
- [ ] Local development OAuth flow works
- [ ] Production OAuth flow works on Vercel
- [ ] Users can successfully authenticate and access the app
- [ ] Session persistence works correctly

## Troubleshooting

### Common Issues
1. **"redirect_uri_mismatch"**: Ensure Google Console redirect URLs exactly match Supabase callback URL
2. **"invalid_client"**: Verify Client ID and Secret are correctly entered in Supabase Dashboard
3. **"access_denied"**: Check consent screen configuration and authorized domains
4. **Session not persisting**: Ensure `access_type: 'offline'` is included in OAuth parameters

### Debug Steps
1. Check browser console for OAuth errors
2. Verify Supabase logs in the dashboard
3. Test with different browsers/incognito mode
4. Ensure all URLs use HTTPS in production

## Security Notes

- Never commit `.env` files to version control
- Use environment variables for all sensitive configuration
- Regularly rotate OAuth credentials
- Monitor authentication logs for suspicious activity
- Enable RLS (Row Level Security) on user data tables

## References

- [Supabase Google OAuth Documentation](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
