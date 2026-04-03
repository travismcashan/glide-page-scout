import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { item_id, title, description } = await req.json();
    if (!item_id || !title) {
      return new Response(JSON.stringify({ error: "item_id and title are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Generate image with DALL-E
    const prompt = `Abstract, minimal, geometric illustration representing the concept: "${title}". ${description ? `Context: ${description.slice(0, 100)}` : ''} Style: clean lines, soft gradients, muted pastel colors on white background, modern tech aesthetic. No text, no words, no letters.`;

    const dalleRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      }),
    });

    if (!dalleRes.ok) {
      const text = await dalleRes.text();
      console.error("DALL-E error:", dalleRes.status, text);
      return new Response(JSON.stringify({ error: "Image generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dalleData = await dalleRes.json();
    const imageUrl = dalleData.data?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned");

    // Download the image
    const imageRes = await fetch(imageUrl);
    const imageBlob = await imageRes.blob();

    // Upload to Supabase storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const storagePath = `covers/${item_id}-${Date.now()}.png`;
    const { error: uploadError } = await sb.storage
      .from("wishlist-attachments")
      .upload(storagePath, imageBlob, { contentType: "image/png" });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = sb.storage
      .from("wishlist-attachments")
      .getPublicUrl(storagePath);

    // Update the wishlist item with the cover image
    await sb.from("wishlist_items").update({ cover_image_url: publicUrl }).eq("id", item_id);

    return new Response(JSON.stringify({ cover_image_url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wishlist-cover-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
