const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = 'https://api.ssllabs.com/api/v4';

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host } = await req.json();
    if (!host) {
      return new Response(JSON.stringify({ success: false, error: 'host is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const email = Deno.env.get('SSLLABS_EMAIL');
    if (!email) {
      return new Response(JSON.stringify({ success: false, error: 'SSLLABS_EMAIL not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register email first (idempotent — safe to call every time)
    console.log('Registering email with SSL Labs:', email);
    const registerRes = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Site', lastName: 'Analyzer', email, organization: 'SiteAnalyzer' }),
    });
    if (!registerRes.ok) {
      const regBody = await registerRes.text();
      // 429 = already registered, which is fine
      if (registerRes.status !== 429) {
        console.warn('SSL Labs register response:', registerRes.status, regBody);
      }
    } else {
      await registerRes.text();
    }

    // Start a new assessment
    console.log('Starting SSL Labs assessment for:', host);
    const startUrl = `${API_BASE}/analyze?host=${encodeURIComponent(host)}&startNew=on&all=done&ignoreMismatch=on`;
    const startRes = await fetch(startUrl, { headers: { email } });
    
    if (!startRes.ok) {
      const errBody = await startRes.text();
      console.error('SSL Labs start error:', startRes.status, errBody);
      return new Response(JSON.stringify({ success: false, error: `SSL Labs API error: ${startRes.status}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result = await startRes.json();

    // Poll until READY or ERROR (max ~5 minutes)
    let attempts = 0;
    const maxAttempts = 30;
    while (result.status !== 'READY' && result.status !== 'ERROR' && attempts < maxAttempts) {
      attempts++;
      const waitTime = result.status === 'DNS' ? 5000 : 10000;
      console.log(`Poll #${attempts}: status=${result.status}, waiting ${waitTime}ms`);
      await sleep(waitTime);

      const pollUrl = `${API_BASE}/analyze?host=${encodeURIComponent(host)}&all=done`;
      const pollRes = await fetch(pollUrl, { headers: { email } });
      if (!pollRes.ok) {
        console.error('Poll error:', pollRes.status);
        continue;
      }
      result = await pollRes.json();
    }

    if (result.status === 'ERROR') {
      return new Response(JSON.stringify({
        success: false,
        error: result.statusMessage || 'SSL Labs assessment failed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (result.status !== 'READY') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Assessment timed out — try again later',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract structured data
    const endpoints = (result.endpoints || []).map((ep: any) => {
      const d = ep.details || {};
      return {
        ipAddress: ep.ipAddress,
        serverName: ep.serverName,
        grade: ep.grade,
        gradeTrustIgnored: ep.gradeTrustIgnored,
        hasWarnings: ep.hasWarnings,
        isExceptional: ep.isExceptional,
        // Protocols
        protocols: (d.protocols || []).map((p: any) => ({ name: p.name, version: p.version })),
        // Vulnerabilities
        vulnerabilities: {
          heartbleed: d.heartbleed || false,
          poodle: d.poodle || false,
          freak: d.freak || false,
          logjam: d.logjam || false,
          drownVulnerable: d.drownVulnerable || false,
          beast: d.vulnBeast || false,
          openSslCcs: d.openSslCcs,
          ticketbleed: d.ticketbleed,
          bleichenbacher: d.bleichenbacher,
          zombiePoodle: d.zombiePoodle,
          goldenDoodle: d.goldenDoodle,
        },
        // Key features
        forwardSecrecy: d.forwardSecrecy,
        supportsAead: d.supportsAead || false,
        supportsAlpn: d.supportsAlpn || false,
        ocspStapling: d.ocspStapling || false,
        // HSTS
        hstsPolicy: d.hstsPolicy ? {
          status: d.hstsPolicy.status,
          maxAge: d.hstsPolicy.maxAge,
          includeSubDomains: d.hstsPolicy.includeSubDomains,
          preload: d.hstsPolicy.preload,
        } : null,
        // Certificate info
        certChains: (d.certChains || []).map((chain: any) => ({
          issues: chain.issues,
          trustPaths: (chain.trustPaths || []).map((tp: any) => ({
            isTrusted: tp.trust?.[0]?.isTrusted,
            rootStore: tp.trust?.[0]?.rootStore,
          })),
        })),
        // Server signature
        serverSignature: d.serverSignature || null,
        httpStatusCode: d.httpStatusCode,
      };
    });

    // Extract cert info from Host-level certs array
    const certs = (result.certs || []).map((cert: any) => ({
      subject: cert.subject,
      issuerSubject: cert.issuerSubject,
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      sigAlg: cert.sigAlg,
      keyAlg: cert.keyAlg,
      keySize: cert.keySize,
      sha256Hash: cert.sha256Hash,
    }));

    const response = {
      success: true,
      host: result.host,
      port: result.port,
      protocol: result.protocol,
      isPublic: result.isPublic,
      startTime: result.startTime,
      testTime: result.testTime,
      grade: endpoints[0]?.grade || null,
      endpoints,
      certs,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('SSL Labs scan error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
