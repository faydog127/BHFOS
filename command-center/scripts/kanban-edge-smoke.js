const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const jwt = process.env.TEST_JWT || process.env.SUPABASE_JWT;
const origin = process.env.ORIGIN || 'http://localhost:3000';

if (!supabaseUrl) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL).');
  process.exit(1);
}

const baseUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/kanban-list`;

const logCorsHeaders = (response) => {
  const allowOrigin = response.headers.get('access-control-allow-origin');
  const allowMethods = response.headers.get('access-control-allow-methods');
  const allowHeaders = response.headers.get('access-control-allow-headers');

  console.log('CORS allow-origin:', allowOrigin || '(none)');
  console.log('CORS allow-methods:', allowMethods || '(none)');
  console.log('CORS allow-headers:', allowHeaders || '(none)');
};

try {
  const optionsResponse = await fetch(baseUrl, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization, content-type, apikey, x-client-info',
    },
  });

  console.log(`OPTIONS ${baseUrl} -> ${optionsResponse.status} ${optionsResponse.statusText}`);
  logCorsHeaders(optionsResponse);

  if (!jwt) {
    console.log('Skipping POST. Set TEST_JWT to validate the protected call.');
    process.exit(0);
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };

  if (supabaseAnonKey) {
    headers.apikey = supabaseAnonKey;
  }

  const postResponse = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const bodyText = await postResponse.text();
  console.log(`POST ${baseUrl} -> ${postResponse.status} ${postResponse.statusText}`);
  console.log(bodyText || '(empty response)');
} catch (error) {
  console.error('Smoke check failed:', error?.message || error);
  process.exit(1);
}
