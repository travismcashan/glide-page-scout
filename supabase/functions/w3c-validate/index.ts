import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Run HTML and CSS validation in parallel
    const [htmlResult, cssResult] = await Promise.all([
      validateHtml(url),
      validateCss(url),
    ]);

    return new Response(JSON.stringify({
      success: true,
      html: htmlResult,
      css: cssResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('w3c-validate error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function validateHtml(url: string) {
  try {
    const res = await fetch(`https://validator.w3.org/nu/?doc=${encodeURIComponent(url)}&out=json`, {
      headers: { 'User-Agent': 'SiteAnalyzer/1.0' },
    });
    if (!res.ok) {
      const t = await res.text();
      return { valid: false, errorCount: 0, warningCount: 0, infoCount: 0, errors: [], warnings: [], info: [], apiError: `HTTP ${res.status}` };
    }
    const data = await res.json();
    const messages = data.messages || [];
    const errors = messages.filter((m: any) => m.type === 'error');
    const warnings = messages.filter((m: any) => m.type === 'info' && m.subType === 'warning');
    const info = messages.filter((m: any) => m.type === 'info' && m.subType !== 'warning');
    return {
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length,
      errors: errors.slice(0, 50),
      warnings: warnings.slice(0, 30),
      info: info.slice(0, 10),
      apiError: null,
    };
  } catch (e) {
    return { valid: false, errorCount: 0, warningCount: 0, infoCount: 0, errors: [], warnings: [], info: [], apiError: e.message };
  }
}

async function validateCss(url: string) {
  try {
    const res = await fetch(
      `https://jigsaw.w3.org/css-validator/validator?uri=${encodeURIComponent(url)}&output=soap12&warning=1`,
      { headers: { 'User-Agent': 'SiteAnalyzer/1.0' } },
    );
    if (!res.ok) {
      await res.text();
      return { valid: false, errorCount: 0, warningCount: 0, errors: [], warnings: [], apiError: `HTTP ${res.status}` };
    }
    const xml = await res.text();

    // Simple counts from XML — avoid heavy regex
    const validMatch = xml.match(/<m:validity>(true|false)<\/m:validity>/);
    const valid = validMatch?.[1] === 'true';

    // Count <m:error> and <m:warning> occurrences
    const errorCount = (xml.match(/<m:error>/g) || []).length;
    const warningCount = (xml.match(/<m:warning>/g) || []).length;

    // Extract errors with simple line-by-line parsing (limited to 30)
    const errors: any[] = [];
    const errorBlocks = xml.split('<m:error>').slice(1, 31);
    for (const block of errorBlocks) {
      const line = block.match(/<m:line>(\d+)<\/m:line>/)?.[1];
      const msg = block.match(/<m:message>([\s\S]*?)<\/m:message>/)?.[1];
      if (msg) {
        errors.push({
          line: line ? parseInt(line) : null,
          message: msg.replace(/<[^>]+>/g, '').trim(),
        });
      }
    }

    const warnings: any[] = [];
    const warnBlocks = xml.split('<m:warning>').slice(1, 21);
    for (const block of warnBlocks) {
      const line = block.match(/<m:line>(\d+)<\/m:line>/)?.[1];
      const msg = block.match(/<m:message>([\s\S]*?)<\/m:message>/)?.[1];
      if (msg) {
        warnings.push({
          line: line ? parseInt(line) : null,
          message: msg.replace(/<[^>]+>/g, '').trim(),
        });
      }
    }

    return { valid, errorCount, warningCount, errors, warnings, apiError: null };
  } catch (e) {
    return { valid: false, errorCount: 0, warningCount: 0, errors: [], warnings: [], apiError: e.message };
  }
}
