const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('GOOGLE_PSI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Google PSI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Running PageSpeed Insights for:', url);

    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo`),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo`),
    ]);

    if (!mobileRes.ok) {
      const errText = await mobileRes.text();
      console.error('PSI mobile error:', errText);
      return new Response(JSON.stringify({ success: false, error: `PSI API error: ${mobileRes.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [mobileData, desktopData] = await Promise.all([mobileRes.json(), desktopRes.json()]);

    function extractFull(data: any) {
      const lhr = data?.lighthouseResult || {};
      const cats = lhr.categories || {};
      const audits = lhr.audits || {};

      // Category scores
      const categories = {
        performance: Math.round((cats.performance?.score || 0) * 100),
        accessibility: Math.round((cats.accessibility?.score || 0) * 100),
        bestPractices: Math.round((cats['best-practices']?.score || 0) * 100),
        seo: Math.round((cats.seo?.score || 0) * 100),
      };

      // Core Web Vitals
      const vitals = {
        fcp: audits['first-contentful-paint']?.numericValue ?? null,
        lcp: audits['largest-contentful-paint']?.numericValue ?? null,
        tbt: audits['total-blocking-time']?.numericValue ?? null,
        cls: audits['cumulative-layout-shift']?.numericValue ?? null,
        si: audits['speed-index']?.numericValue ?? null,
        tti: audits['interactive']?.numericValue ?? null,
      };

      // Extract all audits with relevant info
      const allAudits: any[] = [];
      for (const [id, audit] of Object.entries(audits) as [string, any][]) {
        const entry: any = {
          id,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          scoreDisplayMode: audit.scoreDisplayMode,
          displayValue: audit.displayValue || null,
          numericValue: audit.numericValue ?? null,
          numericUnit: audit.numericUnit || null,
        };

        // Include details for audits that have actionable info
        if (audit.details) {
          entry.detailsType = audit.details.type;

          // Opportunities: include overallSavingsMs and items
          if (audit.details.type === 'opportunity' && audit.details.items?.length > 0) {
            entry.overallSavingsMs = audit.details.overallSavingsMs ?? null;
            entry.overallSavingsBytes = audit.details.overallSavingsBytes ?? null;
            entry.items = audit.details.items.slice(0, 10).map((item: any) => ({
              url: item.url || null,
              totalBytes: item.totalBytes ?? null,
              wastedBytes: item.wastedBytes ?? null,
              wastedMs: item.wastedMs ?? null,
            }));
          }

          // Tables: include headings and items (diagnostics, resource summary, etc.)
          if (audit.details.type === 'table' && audit.details.items?.length > 0) {
            entry.headings = audit.details.headings?.map((h: any) => ({
              key: h.key,
              label: h.label || h.text || h.key,
              valueType: h.valueType,
            }));
            entry.items = audit.details.items.slice(0, 15).map((item: any) => {
              const cleaned: any = {};
              for (const [k, v] of Object.entries(item)) {
                if (typeof v === 'object' && v !== null && (v as any).type === 'link') {
                  cleaned[k] = (v as any).text || (v as any).url;
                } else {
                  cleaned[k] = v;
                }
              }
              return cleaned;
            });
          }

          // Treemap / critical-request-chains: just note existence
          if (audit.details.type === 'criticalrequestchain') {
            entry.chainCount = Object.keys(audit.details.chains || {}).length;
          }
        }

        allAudits.push(entry);
      }

      // Categorize audits
      const opportunities = allAudits.filter(a => a.detailsType === 'opportunity' && a.score !== null && a.score < 1);
      const diagnostics = allAudits.filter(a =>
        a.detailsType === 'table' &&
        a.scoreDisplayMode !== 'informative' &&
        a.score !== null && a.score < 1
      );
      const passed = allAudits.filter(a => a.score === 1 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable');
      const failed = allAudits.filter(a => a.score !== null && a.score < 0.5 && a.scoreDisplayMode !== 'informative');

      // Category audit refs (which audits belong to which category)
      const categoryRefs: Record<string, string[]> = {};
      for (const [catId, cat] of Object.entries(cats) as [string, any][]) {
        categoryRefs[catId] = (cat.auditRefs || []).map((r: any) => r.id);
      }

      // Resource summary
      const resourceSummary = audits['resource-summary']?.details?.items || [];

      // Main thread work breakdown
      const mainThreadWork = audits['mainthread-work-breakdown']?.details?.items?.slice(0, 10) || [];

      return {
        categories,
        vitals,
        opportunities: opportunities.sort((a, b) => (b.overallSavingsMs || 0) - (a.overallSavingsMs || 0)),
        diagnostics,
        passed,
        failed,
        resourceSummary,
        mainThreadWork,
        allAudits,
        categoryRefs,
        totalAudits: allAudits.length,
      };
    }

    const mobile = extractFull(mobileData);
    const desktop = extractFull(desktopData);

    console.log(`PSI complete — mobile perf: ${mobile.categories.performance} (${mobile.totalAudits} audits, ${mobile.opportunities.length} opportunities) desktop perf: ${desktop.categories.performance}`);

    return new Response(JSON.stringify({
      success: true,
      mobile,
      desktop,
      finalUrl: mobileData?.lighthouseResult?.finalUrl || url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('PSI error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'PSI analysis failed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
