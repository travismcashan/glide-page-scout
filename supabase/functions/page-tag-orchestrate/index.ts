import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 150;

function normalizeTagKey(u: string): string {
  try {
    const parsed = new URL(u);
    return (parsed.origin + parsed.pathname).replace(/\/+$/, "").toLowerCase();
  } catch {
    return u.replace(/\/+$/, "").toLowerCase();
  }
}

// ── Pattern-based fallback tagging ──────────────────────────────

const CUSTOM_PATTERNS: [RegExp, string][] = [
  [/^\/$/, "Homepage"],
  [/^\/about/i, "About"],
  [/^\/contact/i, "Contact"],
  [/^\/pricing/i, "Pricing"],
  [/^\/demo/i, "Demo"],
  [/^\/services?\/?$/i, "Services"],
  [/^\/solutions?\/?$/i, "Solutions"],
  [/^\/platform/i, "Platform"],
  [/^\/products?\/?$/i, "Product"],
  [/^\/features/i, "Features"],
  [/^\/how-it-works/i, "How It Works"],
  [/^\/why/i, "Why Us"],
  [/^\/partners/i, "Partners"],
  [/^\/integrations/i, "Integrations"],
];

const TOOLKIT_PATTERNS: [RegExp, string][] = [
  [/^\/privacy/i, "Privacy Policy"],
  [/^\/terms/i, "Terms"],
  [/^\/cookie/i, "Cookie Policy"],
  [/^\/legal/i, "Legal"],
  [/^\/disclaimer/i, "Disclaimer"],
  [/^\/accessibility/i, "Accessibility"],
  [/^\/sitemap/i, "Sitemap"],
  [/^\/search/i, "Search"],
  [/^\/login/i, "Login"],
  [/^\/sign-?up/i, "Sign Up"],
  [/^\/register/i, "Register"],
  [/^\/404/i, "404"],
];

const LIST_PATTERNS: [RegExp, string][] = [
  [/^\/blog\/?$/i, "Blog List"],
  [/^\/news\/?$/i, "News List"],
  [/^\/events?\/?$/i, "Event List"],
  [/^\/careers?\/?$/i, "Career List"],
  [/^\/jobs?\/?$/i, "Job List"],
  [/^\/team\/?$/i, "Team List"],
  [/^\/resources?\/?$/i, "Resource List"],
  [/^\/case-?studies\/?$/i, "Case Study List"],
  [/^\/portfolio\/?$/i, "Portfolio List"],
  [/^\/projects?\/?$/i, "Project List"],
  [/^\/faq\/?$/i, "FAQ List"],
];

const LIST_PARENT_PATTERNS = [
  { base: "blog", template: "Blog Detail" },
  { base: "news", template: "News Detail" },
  { base: "events", template: "Event Detail" },
  { base: "careers", template: "Career Detail" },
  { base: "jobs", template: "Job Detail" },
  { base: "team", template: "Team Detail" },
  { base: "resources", template: "Resource Detail" },
  { base: "case-studies", template: "Case Study Detail" },
  { base: "portfolio", template: "Portfolio Detail" },
  { base: "projects", template: "Project Detail" },
];

type PageTag = {
  template: string;
  baseType?: string;
  contentType?: string;
  cptName?: string;
};

type PageTagsMap = Record<string, PageTag>;

/** Pattern-based fallback tagging — mirrors client-side autoSeedPageTags */
function patternTag(
  urls: string[],
  contentTypesData: any,
): PageTagsMap {
  const map: PageTagsMap = {};

  // Build content-type lookup
  const ctMap = new Map<string, { contentType: string; baseType?: string; cptName?: string }>();
  if (contentTypesData?.classified) {
    for (const c of contentTypesData.classified) {
      ctMap.set(normalizeTagKey(c.url), {
        contentType: c.contentType,
        baseType: c.baseType,
        cptName: c.cptName,
      });
    }
  }

  for (const url of urls) {
    const key = normalizeTagKey(url);
    if (map[key]) continue;

    let pathname: string;
    try { pathname = new URL(url).pathname; } catch { pathname = url; }

    const ct = ctMap.get(key);

    // Custom page patterns
    const customMatch = CUSTOM_PATTERNS.find(([p]) => p.test(pathname));
    if (customMatch) { map[key] = { template: customMatch[1], baseType: "Page" }; continue; }

    // Toolkit patterns
    const toolkitMatch = TOOLKIT_PATTERNS.find(([p]) => p.test(pathname));
    if (toolkitMatch) { map[key] = { template: toolkitMatch[1], baseType: "Page" }; continue; }

    // List patterns → Archive
    const listMatch = LIST_PATTERNS.find(([p]) => p.test(pathname));
    if (listMatch) { map[key] = { template: listMatch[1], baseType: "Archive" }; continue; }

    // Content type classification
    if (ct?.baseType) {
      map[key] = { template: ct.contentType, baseType: ct.baseType, contentType: ct.contentType, cptName: ct.cptName };
      continue;
    }

    // Parent path heuristic
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const parentMatch = LIST_PARENT_PATTERNS.find(p => segments[0].toLowerCase() === p.base);
      if (parentMatch) { map[key] = { template: parentMatch.template, baseType: "Post" }; continue; }
    }

    // Default
    map[key] = { template: "Page", baseType: "Page" };
  }

  return map;
}

/**
 * page-tag-orchestrate: Server-side page tagging orchestrator.
 * Reads session data, batches URLs through auto-tag-pages AI,
 * falls back to pattern matching, writes page_tags to session.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { session_id, _orchestrated, _integration_key, _db_column } = body;

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Load session
    const { data: session } = await sb
      .from("crawl_sessions")
      .select("id, domain, base_url, discovered_urls, nav_structure, content_types_data, page_tags")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Skip if page_tags already populated
    if (session.page_tags && Object.keys(session.page_tags).length > 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: "already_tagged" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Extract URLs
    const d = session.discovered_urls;
    const urls: string[] = Array.isArray(d) ? d
      : d?.links && Array.isArray(d.links) ? d.links
      : d?.urls && Array.isArray(d.urls) ? d.urls
      : [];

    if (urls.length === 0) {
      // No URLs — write empty page_tags to signal completion
      await sb.from("crawl_sessions").update({ page_tags: {} } as any).eq("id", session_id);
      return new Response(
        JSON.stringify({ success: true, tagged: 0, reason: "no_urls" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Get homepage content from crawl_pages
    let homepageContent = "";
    try {
      const { data: homePage } = await sb
        .from("crawl_pages")
        .select("markdown")
        .eq("session_id", session_id)
        .like("url", "%/")
        .limit(1)
        .single();
      if (homePage?.markdown) {
        homepageContent = homePage.markdown.slice(0, 4000);
      }
    } catch { /* no homepage content available */ }

    // 4. Batch URLs through auto-tag-pages AI
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE));
    }

    console.log(`page-tag-orchestrate: ${urls.length} URLs in ${batches.length} batches for ${session.domain}`);

    const allPages: Array<{ url: string; template: string; baseType?: string; cptName?: string }> = [];
    let detectedIndustry: string | undefined;

    // First batch: sequential to detect industry
    if (batches.length > 0) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/auto-tag-pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: JSON.stringify({
            urls: batches[0],
            domain: session.domain,
            homepageContent,
            navStructure: session.nav_structure,
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && data.pages) {
            allPages.push(...data.pages);
            detectedIndustry = data.industry;
          }
        }
      } catch (e) {
        console.error("page-tag-orchestrate: batch 1 failed:", e);
      }
    }

    // Remaining batches: parallel with detected industry
    if (batches.length > 1) {
      const results = await Promise.allSettled(
        batches.slice(1).map(batch =>
          fetch(`${supabaseUrl}/functions/v1/auto-tag-pages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
            body: JSON.stringify({
              urls: batch,
              domain: session.domain,
              homepageContent,
              navStructure: session.nav_structure,
              knownIndustry: detectedIndustry,
            }),
          }).then(r => r.ok ? r.json() : null),
        ),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value?.success && r.value.pages) {
          allPages.push(...r.value.pages);
        }
      }
    }

    // 5. Build tag map from AI results
    const tagMap: PageTagsMap = {};
    for (const page of allPages) {
      const key = normalizeTagKey(page.url);
      tagMap[key] = {
        template: page.template,
        baseType: page.baseType || undefined,
        cptName: page.cptName || undefined,
      };
    }

    // 6. Pattern-based fallback for URLs not tagged by AI
    const patternTags = patternTag(urls, session.content_types_data);

    // Merge: AI tags take priority, pattern fills gaps
    const merged: PageTagsMap = { ...patternTags, ...tagMap };

    console.log(`page-tag-orchestrate: ${Object.keys(tagMap).length} AI-tagged, ${Object.keys(patternTags).length} pattern-tagged, ${Object.keys(merged).length} total for ${session.domain}`);

    // 7. Write to session
    await sb.from("crawl_sessions").update({ page_tags: merged } as any).eq("id", session_id);

    return new Response(
      JSON.stringify({
        success: true,
        tagged: Object.keys(merged).length,
        aiTagged: Object.keys(tagMap).length,
        patternTagged: Object.keys(patternTags).length,
        industry: detectedIndustry,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("page-tag-orchestrate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Page tagging failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
