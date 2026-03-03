const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/* ── Security header analysis helpers ── */

type TestResult = {
  pass: boolean;
  score_modifier: number;
  score_description: string;
  result: string;
  recommendation?: string;
};

function analyzeHSTS(headers: Record<string, string>): TestResult {
  const val = headers['strict-transport-security'];
  if (!val) return { pass: false, score_modifier: -25, result: 'hsts-not-implemented', score_description: 'HTTP Strict Transport Security (HSTS) header not implemented', recommendation: 'Add a Strict-Transport-Security header with a max-age of at least 15768000 (6 months).' };
  const maxAge = parseInt((val.match(/max-age=(\d+)/i) || [])[1] || '0');
  const includesSub = /includeSubDomains/i.test(val);
  const preload = /preload/i.test(val);
  if (maxAge >= 15768000 && includesSub && preload) return { pass: true, score_modifier: 5, result: 'hsts-implemented-max-age-at-least-six-months', score_description: `HSTS header set with max-age=${maxAge}, includeSubDomains, and preload` };
  if (maxAge >= 15768000) return { pass: true, score_modifier: 0, result: 'hsts-implemented-max-age-at-least-six-months', score_description: `HSTS header set with max-age=${maxAge}` };
  return { pass: false, score_modifier: -10, result: 'hsts-implemented-max-age-less-than-six-months', score_description: `HSTS max-age is only ${maxAge} seconds (< 6 months)`, recommendation: 'Increase max-age to at least 15768000 (6 months).' };
}

function analyzeCSP(headers: Record<string, string>): TestResult {
  const val = headers['content-security-policy'];
  if (!val) return { pass: false, score_modifier: -25, result: 'csp-not-implemented', score_description: 'Content Security Policy (CSP) header not implemented', recommendation: "Implement a Content-Security-Policy header. Start with a report-only policy to understand your site's needs." };
  const hasDefaultSrc = /default-src/i.test(val);
  const hasUnsafeInline = /unsafe-inline/i.test(val);
  const hasUnsafeEval = /unsafe-eval/i.test(val);
  if (hasDefaultSrc && !hasUnsafeInline && !hasUnsafeEval) return { pass: true, score_modifier: 5, result: 'csp-implemented-with-no-unsafe', score_description: 'CSP implemented without unsafe-inline or unsafe-eval' };
  if (hasDefaultSrc && hasUnsafeInline) return { pass: true, score_modifier: -5, result: 'csp-implemented-with-unsafe-inline', score_description: "CSP implemented but uses 'unsafe-inline'", recommendation: "Remove 'unsafe-inline' and use nonces or hashes instead." };
  return { pass: true, score_modifier: 0, result: 'csp-implemented', score_description: 'CSP header is set' };
}

function analyzeXContentType(headers: Record<string, string>): TestResult {
  const val = headers['x-content-type-options'];
  if (!val) return { pass: false, score_modifier: -5, result: 'x-content-type-options-not-implemented', score_description: 'X-Content-Type-Options header not implemented', recommendation: 'Set X-Content-Type-Options: nosniff' };
  if (val.toLowerCase() === 'nosniff') return { pass: true, score_modifier: 0, result: 'x-content-type-options-nosniff', score_description: 'X-Content-Type-Options is set to "nosniff"' };
  return { pass: false, score_modifier: -5, result: 'x-content-type-options-invalid', score_description: `X-Content-Type-Options has invalid value: ${val}` };
}

function analyzeXFrameOptions(headers: Record<string, string>): TestResult {
  const val = headers['x-frame-options'];
  const csp = headers['content-security-policy'];
  const cspFrameAncestors = csp && /frame-ancestors/i.test(csp);
  if (cspFrameAncestors) return { pass: true, score_modifier: 0, result: 'x-frame-options-implemented-via-csp', score_description: 'Clickjacking protection via CSP frame-ancestors directive' };
  if (!val) return { pass: false, score_modifier: -20, result: 'x-frame-options-not-implemented', score_description: 'X-Frame-Options header not implemented', recommendation: 'Set X-Frame-Options to DENY or SAMEORIGIN, or use CSP frame-ancestors.' };
  const v = val.toUpperCase();
  if (v === 'DENY' || v === 'SAMEORIGIN') return { pass: true, score_modifier: 0, result: `x-frame-options-${v.toLowerCase()}`, score_description: `X-Frame-Options is set to ${v}` };
  return { pass: false, score_modifier: -10, result: 'x-frame-options-invalid', score_description: `X-Frame-Options has invalid value: ${val}` };
}

function analyzeReferrerPolicy(headers: Record<string, string>): TestResult {
  const val = headers['referrer-policy'];
  if (!val) return { pass: true, score_modifier: 0, result: 'referrer-policy-not-implemented', score_description: 'Referrer-Policy header not implemented (browsers default to strict-origin-when-cross-origin)' };
  const safe = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'];
  if (safe.includes(val.toLowerCase().trim())) return { pass: true, score_modifier: 5, result: 'referrer-policy-private', score_description: `Referrer-Policy set to "${val}"` };
  if (val.toLowerCase().trim() === 'unsafe-url') return { pass: false, score_modifier: -5, result: 'referrer-policy-unsafe', score_description: 'Referrer-Policy set to "unsafe-url" — full URL sent as referrer', recommendation: 'Use a more restrictive policy like strict-origin-when-cross-origin.' };
  return { pass: true, score_modifier: 0, result: 'referrer-policy-implemented', score_description: `Referrer-Policy set to "${val}"` };
}

function analyzeCORP(headers: Record<string, string>): TestResult {
  const val = headers['cross-origin-resource-policy'];
  if (!val) return { pass: true, score_modifier: 0, result: 'cross-origin-resource-policy-not-implemented', score_description: 'Cross-Origin-Resource-Policy not implemented' };
  return { pass: true, score_modifier: 0, result: 'cross-origin-resource-policy-implemented', score_description: `Cross-Origin-Resource-Policy set to "${val}"` };
}

function analyzeRedirection(url: string, finalUrl: string, headers: Record<string, string>): TestResult {
  const isHttps = finalUrl.startsWith('https://');
  if (!isHttps) return { pass: false, score_modifier: -20, result: 'redirection-not-to-https', score_description: 'Site does not redirect to HTTPS', recommendation: 'Configure your server to redirect all HTTP traffic to HTTPS.' };
  return { pass: true, score_modifier: 0, result: 'redirection-to-https', score_description: 'Site redirects to HTTPS' };
}

type CookieInfo = {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  path: string | null;
  domain: string | null;
  maxAge: number | null;
  expires: string | null;
};

function parseCookies(setCookieHeaders: string[]): CookieInfo[] {
  return setCookieHeaders.map(raw => {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    const name = eqIdx > -1 ? nameVal.substring(0, eqIdx) : nameVal;
    const value = eqIdx > -1 ? nameVal.substring(eqIdx + 1) : '';
    const cookie: CookieInfo = { name, value: value.substring(0, 50) + (value.length > 50 ? '…' : ''), secure: false, httpOnly: false, sameSite: null, path: null, domain: null, maxAge: null, expires: null };
    for (const attr of attrs) {
      const lower = attr.toLowerCase();
      if (lower === 'secure') cookie.secure = true;
      else if (lower === 'httponly') cookie.httpOnly = true;
      else if (lower.startsWith('samesite=')) cookie.sameSite = attr.split('=')[1];
      else if (lower.startsWith('path=')) cookie.path = attr.split('=')[1];
      else if (lower.startsWith('domain=')) cookie.domain = attr.split('=')[1];
      else if (lower.startsWith('max-age=')) cookie.maxAge = parseInt(attr.split('=')[1]);
      else if (lower.startsWith('expires=')) cookie.expires = attr.split('=')[1];
    }
    return cookie;
  });
}

function analyzeCookies(cookies: CookieInfo[]): TestResult {
  if (cookies.length === 0) return { pass: true, score_modifier: 0, result: 'cookies-not-found', score_description: 'No cookies detected' };
  const insecure = cookies.filter(c => !c.secure);
  const noHttpOnly = cookies.filter(c => !c.httpOnly);
  const noSameSite = cookies.filter(c => !c.sameSite);
  if (insecure.length > 0) return { pass: false, score_modifier: -5, result: 'cookies-without-secure-flag', score_description: `${insecure.length} cookie(s) missing the Secure flag`, recommendation: 'Set the Secure flag on all cookies.' };
  if (noSameSite.length > 0) return { pass: true, score_modifier: 0, result: 'cookies-without-samesite', score_description: `${noSameSite.length} cookie(s) missing SameSite attribute` };
  return { pass: true, score_modifier: 0, result: 'cookies-secure', score_description: 'All cookies use Secure, HttpOnly, and SameSite attributes' };
}

function parseCspDirectives(csp: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  csp.split(';').forEach(d => {
    const trimmed = d.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    const name = parts[0].toLowerCase();
    directives[name] = parts.slice(1);
  });
  return directives;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host } = await req.json();
    if (!host) {
      return new Response(JSON.stringify({ success: false, error: 'Host is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let hostname = host.trim();
    try {
      const url = new URL(hostname.startsWith('http') ? hostname : `https://${hostname}`);
      hostname = url.hostname;
    } catch { /* use as-is */ }

    console.log('Mozilla Observatory scan for:', hostname);

    // Run API scan and header fetch in parallel
    const targetUrl = `https://${hostname}`;

    const [apiRes, headerRes] = await Promise.all([
      fetch(`https://observatory-api.mdn.mozilla.net/api/v2/scan?host=${encodeURIComponent(hostname)}`, { method: 'POST' }),
      fetch(targetUrl, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 Observatory-Scanner' } }).catch(() => null),
    ]);

    // Parse API response
    let grade: string | null = null;
    let score: number | null = null;
    let scannedAt: string | null = null;
    let detailsUrl: string | null = null;

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      grade = apiData.grade || null;
      score = apiData.score ?? null;
      scannedAt = apiData.scanned_at || null;
      detailsUrl = apiData.details_url || null;
    }

    // Analyze response headers
    const rawHeaders: Record<string, string> = {};
    const setCookieHeaders: string[] = [];
    let finalUrl = targetUrl;

    if (headerRes) {
      finalUrl = headerRes.url || targetUrl;
      headerRes.headers.forEach((value, key) => {
        rawHeaders[key.toLowerCase()] = value;
        if (key.toLowerCase() === 'set-cookie') {
          setCookieHeaders.push(value);
        }
      });
      // Deno's Headers.forEach doesn't repeat set-cookie, try getSetCookie
      try {
        const sc = (headerRes.headers as any).getSetCookie?.();
        if (sc && sc.length) setCookieHeaders.push(...sc.filter((c: string) => !setCookieHeaders.includes(c)));
      } catch { /* fallback */ }
    }

    // Run all security tests
    const tests: Record<string, TestResult> = {};
    if (headerRes) {
      tests['strict-transport-security'] = analyzeHSTS(rawHeaders);
      tests['content-security-policy'] = analyzeCSP(rawHeaders);
      tests['x-content-type-options'] = analyzeXContentType(rawHeaders);
      tests['x-frame-options'] = analyzeXFrameOptions(rawHeaders);
      tests['referrer-policy'] = analyzeReferrerPolicy(rawHeaders);
      tests['cross-origin-resource-policy'] = analyzeCORP(rawHeaders);
      tests['redirection'] = analyzeRedirection(targetUrl, finalUrl, rawHeaders);
      tests['cookies'] = analyzeCookies(parseCookies(setCookieHeaders));
    }

    // Parse CSP directives
    const cspRaw = rawHeaders['content-security-policy'] || null;
    const cspDirectives = cspRaw ? parseCspDirectives(cspRaw) : null;

    // Parse cookies
    const cookies = parseCookies(setCookieHeaders);

    console.log(`Observatory scan complete: grade=${grade}, score=${score}, tests=${Object.keys(tests).length}, headers=${Object.keys(rawHeaders).length}`);

    return new Response(JSON.stringify({
      success: true,
      grade,
      score,
      scannedAt,
      detailsUrl,
      tests: Object.keys(tests).length > 0 ? tests : null,
      rawHeaders: Object.keys(rawHeaders).length > 0 ? rawHeaders : null,
      cspRaw,
      cspDirectives,
      cookies: cookies.length > 0 ? cookies : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Observatory error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Observatory scan failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
