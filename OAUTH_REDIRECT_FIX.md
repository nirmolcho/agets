# OAuth Redirect URL Fix

## Problem
After Google OAuth authentication, users are redirected to `http://localhost:3000/login.html` instead of the production URL `https://agets.vercel.app/login.html`.

## Root Cause
The issue is in the Google Cloud Console configuration, NOT in the application code. Google OAuth redirects to the URLs configured in the Google Cloud Console, regardless of what the application requests.

## Solution

### 1. Update Google Cloud Console (CRITICAL)

Go to your Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs → [Your Client ID]

**Current problematic configuration:**
```
Authorized redirect URIs:
- http://localhost:3000/login.html  ❌ (This is causing the issue)
```

**Correct configuration should be:**
```
Authorized redirect URIs:
- https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback  ✅ (Supabase callback)
- http://localhost:3000/login.html  ✅ (For local development only)
```

### 2. Verify Supabase Configuration

In your Supabase Dashboard → Authentication → Settings → Site URL:
```
Site URL: https://agets.vercel.app
```

In your Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
```
- https://agets.vercel.app/login.html  ✅
- http://localhost:3000/login.html    ✅ (for local dev)
```

### 3. Environment Variables Check

Verify your Vercel deployment has these environment variables:
```
VITE_SUPABASE_URL=https://bwkqyjfizhvrrylqjxng.supabase.co
VITE_SUPABASE_ANON_KEY=[your_anon_key]
VITE_GOOGLE_REDIRECT_TO=https://agets.vercel.app/login.html
VITE_REQUIRE_AUTH=true
```

## How OAuth Flow Should Work

1. User clicks "Sign in with Google" on `https://agets.vercel.app`
2. User is redirected to Google OAuth consent screen
3. After consent, Google redirects to: `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`
4. Supabase processes the OAuth response
5. Supabase redirects to: `https://agets.vercel.app/login.html` (with auth tokens)
6. User is authenticated and can access the app

## Current Flow (Broken)

1. User clicks "Sign in with Google" on `https://agets.vercel.app`
2. User is redirected to Google OAuth consent screen  
3. After consent, Google redirects to: `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`
4. Supabase processes the OAuth response
5. **BUG**: Supabase redirects to: `http://localhost:3000/login.html` ❌

## Action Items

### Immediate Fix (Google Cloud Console)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID: `794582827851-2n49mnogc3cvuvmukca5mhidcq1nkjmu.apps.googleusercontent.com`
4. Remove or update any localhost redirect URIs
5. Ensure only the Supabase callback URL is configured: `https://bwkqyjfizhvrrylqjxng.supabase.co/auth/v1/callback`

### Verification Steps
1. Clear browser cache and cookies
2. Try OAuth flow again in production
3. Verify redirect goes to `https://agets.vercel.app/login.html`
4. Test that authentication works end-to-end

## Important Notes

- The `redirectTo` parameter in your application code is used by Supabase to determine where to redirect after processing the OAuth callback
- Google OAuth always redirects to URLs configured in Google Cloud Console first
- Your application's `redirectTo` parameter only affects where Supabase redirects after processing Google's callback

## Testing

After making the changes:
1. Test in production: `https://agets.vercel.app`
2. Test locally: `http://localhost:3000` (should still work for development)
3. Verify both flows redirect to the correct domains
