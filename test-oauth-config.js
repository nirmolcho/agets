// OAuth Configuration Test Script
// Run this in your browser console to verify OAuth setup

console.log('🔍 OAuth Configuration Test');
console.log('========================');

// Check environment variables
const envVars = {
  'VITE_SUPABASE_URL': import.meta.env.VITE_SUPABASE_URL,
  'VITE_SUPABASE_ANON_KEY': import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
  'VITE_GOOGLE_REDIRECT_TO': import.meta.env.VITE_GOOGLE_REDIRECT_TO,
  'VITE_REQUIRE_AUTH': import.meta.env.VITE_REQUIRE_AUTH,
};

console.log('Environment Variables:');
Object.entries(envVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

// Check current URL
console.log('\nCurrent URL:', window.location.href);

// Check if we're in production or development
const isProduction = window.location.hostname === 'agets.vercel.app';
const isLocalhost = window.location.hostname === 'localhost';

console.log('\nEnvironment Detection:');
console.log(`  Production: ${isProduction ? '✅' : '❌'}`);
console.log(`  Localhost: ${isLocalhost ? '✅' : '❌'}`);

// Expected redirect URLs
const expectedRedirects = {
  production: 'https://agets.vercel.app/login.html',
  development: 'http://localhost:3000/login.html'
};

console.log('\nExpected Redirect URLs:');
console.log(`  Production: ${expectedRedirects.production}`);
console.log(`  Development: ${expectedRedirects.development}`);

// Test Supabase client
import('./src/auth.js').then(({ getSupabase }) => {
  const supabase = getSupabase();
  if (supabase) {
    console.log('\n✅ Supabase client initialized successfully');
  } else {
    console.log('\n❌ Supabase client failed to initialize');
  }
}).catch(err => {
  console.log('\n❌ Error importing auth module:', err);
});

console.log('\n📋 Next Steps:');
console.log('1. Verify Google Cloud Console configuration');
console.log('2. Check Supabase Dashboard Google provider settings');
console.log('3. Test OAuth flow by clicking "Sign in with Google"');
console.log('4. Check browser network tab for any OAuth errors');
