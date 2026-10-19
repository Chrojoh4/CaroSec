// Read-only setup check. Never prints API keys or reads user/trial records.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
try {
  const target = new URL(url);
  if (target.protocol !== 'https:' || !target.hostname.endsWith('.supabase.co') || !key?.startsWith('sb_publishable_')) {
    throw new Error('Set the Supabase project URL and publishable key in .env.local.');
  }
  const response = await fetch(new URL('/auth/v1/settings', target), {
    headers:{apikey:key}, signal:AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Supabase connection check returned HTTP ${response.status}.`);
  console.log('Supabase Auth accepted the project URL and publishable key.');
  console.log('No records were read or changed. Database policies and hosted application access still need separate verification.');
} catch (error) {
  console.error(error.message);
  process.exitCode=1;
}
