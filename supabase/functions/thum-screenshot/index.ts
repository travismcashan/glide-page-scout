import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate signed Thum.io URL (short expiry is fine — we'll fetch immediately)
    const keyId = '76733';
    const expires = Date.now() + (1000 * 300); // 5 min is plenty for a fetch
    const hash = await md5(secret + expires + url);
    const auth = `${keyId}-${expires}-${hash}`;
    const thumUrl = `https://image.thum.io/get/auth/${auth}/fullpage/width/1280/noanimate/${url}`;

    console.log('Fetching screenshot for:', url);

    // Download the actual image from Thum.io with retries (it returns 502 while rendering)
    let imageResponse: Response | null = null;
    const maxAttempts = 4;
    const delays = [0, 8000, 15000, 25000]; // progressive backoff
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        console.log(`Retry ${attempt}/${maxAttempts - 1} for ${url} after ${delays[attempt] / 1000}s`);
        await new Promise(r => setTimeout(r, delays[attempt]));
      }
      try {
        const resp = await fetch(thumUrl);
        if (resp.ok) {
          imageResponse = resp;
          break;
        }
        console.warn(`Thum.io attempt ${attempt + 1}: ${resp.status} ${resp.statusText}`);
        await resp.text(); // consume body
      } catch (e) {
        console.warn(`Thum.io attempt ${attempt + 1} network error:`, e);
      }
    }
    if (!imageResponse) {
      return new Response(
        JSON.stringify({ success: false, error: 'Thum.io failed after retries' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';

    // Create a unique filename from the URL
    const urlHash = await md5(url + Date.now());
    const filePath = `${urlHash}.${ext}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('screenshots')
      .upload(filePath, imageBlob, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to store screenshot: ' + uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('screenshots')
      .getPublicUrl(filePath);

    const screenshotUrl = publicUrlData.publicUrl;
    console.log('Screenshot stored permanently:', screenshotUrl);

    return new Response(
      JSON.stringify({ success: true, screenshotUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating screenshot:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate screenshot' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
