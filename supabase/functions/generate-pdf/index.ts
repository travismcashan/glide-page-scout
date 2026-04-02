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

    const body = await req.json();
    console.log("[generate-pdf] Request received, html length:", body.html?.length || 0);
    const { html, filename = "document.pdf", test = false } = body;
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

    console.log("[generate-pdf] DocRaptor response status:", response.status);
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
    // Sanitize filename to ASCII for Content-Disposition header (non-ASCII chars crash Deno)
    const safeFilename = filename.replace(/[^\x20-\x7E]/g, '-');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "X-DocRaptor-Pages": response.headers.get("X-DocRaptor-Num-Pages") || "0",
      },
    });
  } catch (e) {
    console.error("generate-pdf CATCH error:", e, e instanceof Error ? e.stack : '');
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
