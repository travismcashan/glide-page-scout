import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function md5(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("MD5", data);
  return encodeHex(new Uint8Array(hash));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secret = Deno.env.get('THUMIO_SECRET_KEY');
    if (!secret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thum.io secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keyId = '76733';
    // 30 day expiry so stored URLs remain valid
    const expires = Date.now() + (1000 * 60 * 60 * 24 * 30);
    const hash = await md5(secret + expires + url);
    const auth = `${keyId}-${expires}-${hash}`;

    const screenshotUrl = `https://image.thum.io/get/auth/${auth}/fullpage/width/1280/noanimate/${url}`;

    console.log('Generated screenshot URL for:', url);

    return new Response(
      JSON.stringify({ success: true, screenshotUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating screenshot URL:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate screenshot' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
