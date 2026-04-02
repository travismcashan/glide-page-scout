import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DOCRAPTOR_API_KEY = Deno.env.get("DOCRAPTOR_API_KEY");
    if (!DOCRAPTOR_API_KEY) throw new Error("DOCRAPTOR_API_KEY is not configured");

    const { html, filename = "document.pdf", test = false } = await req.json();
    if (!html) {
      return new Response(JSON.stringify({ error: "html is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call DocRaptor API
    const response = await fetch("https://api.docraptor.com/docs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(DOCRAPTOR_API_KEY + ":")}`,
      },
      body: JSON.stringify({
        type: "pdf",
        document_content: html,
        test: test, // true = free watermarked test, false = production
        prince_options: {
          media: "print",
          baseurl: "https://glide-page-scout.vercel.app",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DocRaptor error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `DocRaptor error: ${response.status}`, detail: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return the PDF binary
    const pdfBytes = await response.arrayBuffer();
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-DocRaptor-Pages": response.headers.get("X-DocRaptor-Num-Pages") || "0",
      },
    });
  } catch (e) {
    console.error("generate-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
