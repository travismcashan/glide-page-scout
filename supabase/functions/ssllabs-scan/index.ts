const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const API_BASE = 'https://api.ssllabs.com/api/v4';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { host, action = 'start' } = await req.json();
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

    // Register email (idempotent)
    if (action === 'start') {
      const registerRes = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: 'Site', lastName: 'Analyzer', email, organization: 'SiteAnalyzer' }),
      });
      if (registerRes.ok || registerRes.status === 400 || registerRes.status === 429) {
        await registerRes.text(); // consume body
      }
    }

    // Build URL — startNew only on 'start' action
    const params = action === 'start'
      ? `host=${encodeURIComponent(host)}&startNew=on&all=done&ignoreMismatch=on`
      : `host=${encodeURIComponent(host)}&all=done`;

    const analyzeUrl = `${API_BASE}/analyze?${params}`;
    const analyzeRes = await fetch(analyzeUrl, { headers: { email } });

    if (analyzeRes.status === 529) {
      return new Response(JSON.stringify({
        success: true,
        status: 'OVERLOADED',
        error: 'SSL Labs is at full capacity. Will retry.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!analyzeRes.ok) {
      const errBody = await analyzeRes.text();
      console.error('SSL Labs error:', analyzeRes.status, errBody);
      return new Response(JSON.stringify({
        success: false,
        error: `SSL Labs API error: ${analyzeRes.status}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await analyzeRes.json();

    // If not ready yet, return the status so the client can poll
    if (result.status !== 'READY') {
      return new Response(JSON.stringify({
        success: true,
        status: result.status, // DNS, IN_PROGRESS, etc.
        host: result.host,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // READY — extract structured data
    if (result.status === 'ERROR') {
      return new Response(JSON.stringify({
        success: false,
        error: result.statusMessage || 'SSL Labs assessment failed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const endpoints = (result.endpoints || []).map((ep: any) => {
      const d = ep.details || {};
      return {
        ipAddress: ep.ipAddress,
        serverName: ep.serverName,
        grade: ep.grade,
        gradeTrustIgnored: ep.gradeTrustIgnored,
        hasWarnings: ep.hasWarnings,
        isExceptional: ep.isExceptional,
        protocols: (d.protocols || []).map((p: any) => ({ name: p.name, version: p.version })),
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
        forwardSecrecy: d.forwardSecrecy,
        supportsAead: d.supportsAead || false,
        supportsAlpn: d.supportsAlpn || false,
        ocspStapling: d.ocspStapling || false,
        hstsPolicy: d.hstsPolicy ? {
          status: d.hstsPolicy.status,
          maxAge: d.hstsPolicy.maxAge,
          includeSubDomains: d.hstsPolicy.includeSubDomains,
          preload: d.hstsPolicy.preload,
        } : null,
        certChains: (d.certChains || []).map((chain: any) => ({
          issues: chain.issues,
          trustPaths: (chain.trustPaths || []).map((tp: any) => ({
            isTrusted: tp.trust?.[0]?.isTrusted,
            rootStore: tp.trust?.[0]?.rootStore,
          })),
        })),
        serverSignature: d.serverSignature || null,
        httpStatusCode: d.httpStatusCode,
      };
    });

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

    return new Response(JSON.stringify({
      success: true,
      status: 'READY',
      host: result.host,
      port: result.port,
      protocol: result.protocol,
      isPublic: result.isPublic,
      startTime: result.startTime,
      testTime: result.testTime,
      grade: endpoints[0]?.grade || null,
      endpoints,
      certs,
    }), {
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
