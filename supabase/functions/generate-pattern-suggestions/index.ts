/**
 * generate-pattern-suggestions
 *
 * Analyzes a company's enrichment data + latest crawl against the pattern library
 * to suggest the most relevant patterns with confidence scores and reasoning.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logUsage, extractOpenAIUsage, getUserIdFromRequest } from "../_shared/usage-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, domain, industry, enrichment_data')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ success: false, error: `Company not found: ${companyError?.message ?? 'unknown'}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch latest crawl session for the company
    const { data: crawlSession } = await supabase
      .from('crawl_sessions')
      .select('id, domain, status, psi_data, seo_data, wave_data, w3c_data, observatory_data, content_types_data, forms_data, schema_data, sitemap_data, readable_data')
      .eq('company_id', company.id)
      .in('status', ['completed', 'completed_with_errors'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch all patterns
    const { data: patterns, error: patternsError } = await supabase
      .from('patterns')
      .select('id, industry, vertical, pattern_type, block_type, title, description, evidence, anti_pattern, implementation_notes, confidence_score, application_count, tags, status, conversion_data, persona_mapping')
      .in('status', ['draft', 'validated'])
      .order('confidence_score', { ascending: false });

    if (patternsError || !patterns?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'No patterns found in library' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context about the company
    const enrichment = company.enrichment_data ?? {};
    const apolloOrg = enrichment.apollo_org ?? {};
    const ocean = enrichment.ocean ?? {};
    const hubspot = enrichment.hubspot ?? {};

    const companyContext = [
      `Company: ${company.name}`,
      `Domain: ${company.domain ?? 'unknown'}`,
      `Industry: ${company.industry ?? apolloOrg.industry ?? ocean.industry ?? 'unknown'}`,
      apolloOrg.short_description ? `Description: ${apolloOrg.short_description}` : '',
      apolloOrg.estimated_num_employees ? `Employees: ${apolloOrg.estimated_num_employees}` : '',
      apolloOrg.annual_revenue_printed ? `Revenue: ${apolloOrg.annual_revenue_printed}` : '',
      apolloOrg.keywords?.length ? `Keywords: ${apolloOrg.keywords.slice(0, 15).join(', ')}` : '',
      apolloOrg.technologies?.length ? `Tech Stack: ${apolloOrg.technologies.slice(0, 15).join(', ')}` : '',
      ocean.departments?.length ? `Departments: ${JSON.stringify(ocean.departments).substring(0, 200)}` : '',
    ].filter(Boolean).join('\n');

    // Build crawl context if available
    let crawlContext = 'No crawl data available.';
    if (crawlSession) {
      const psi = crawlSession.psi_data as any;
      const seo = crawlSession.seo_data as any;
      const wave = crawlSession.wave_data as any;
      const content = crawlSession.content_types_data as any;
      const forms = crawlSession.forms_data as any;
      const schema = crawlSession.schema_data as any;

      const parts = [
        'CRAWL DATA:',
        psi?.lighthouseResult?.categories ? `Performance: ${Math.round((psi.lighthouseResult.categories.performance?.score ?? 0) * 100)}/100, Accessibility: ${Math.round((psi.lighthouseResult.categories.accessibility?.score ?? 0) * 100)}/100, SEO: ${Math.round((psi.lighthouseResult.categories.seo?.score ?? 0) * 100)}/100` : '',
        seo?.meta_title ? `Page title: "${seo.meta_title}"` : '',
        seo?.meta_description ? `Meta description: "${seo.meta_description.substring(0, 150)}"` : '',
        seo?.headings?.h1?.length ? `H1 tags: ${seo.headings.h1.slice(0, 3).join(', ')}` : '',
        wave?.categories ? `WAVE errors: ${wave.categories.error?.count ?? 0}, alerts: ${wave.categories.alert?.count ?? 0}` : '',
        content ? `Content types found: ${Object.keys(content).slice(0, 10).join(', ')}` : '',
        forms ? `Forms on page: ${Array.isArray(forms) ? forms.length : 'unknown'}` : '',
        schema?.schemas?.length ? `Schema markup: ${(schema.schemas as any[]).map((s: any) => s['@type']).filter(Boolean).join(', ')}` : '',
      ].filter(Boolean);

      crawlContext = parts.join('\n');
    }

    // Build pattern library summary
    const patternSummary = patterns.map((p: any, i: number) => {
      return `[${i}] ID: ${p.id} | Industry: ${p.industry} | Type: ${p.pattern_type} | Block: ${p.block_type ?? 'n/a'} | Title: ${p.title} | Confidence: ${p.confidence_score} | Description: ${p.description.substring(0, 200)}`;
    }).join('\n');

    const prompt = `You are an expert growth marketing strategist analyzing a company to suggest the most relevant patterns from a pattern library.

COMPANY PROFILE:
${companyContext}

${crawlContext}

PATTERN LIBRARY (${patterns.length} patterns):
${patternSummary}

Analyze the company's industry, size, tech stack, website quality, and business context. For each relevant pattern, provide a confidence score and specific reasoning about WHY this pattern applies to this company.

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "suggestions": [
    {
      "pattern_index": 0,
      "confidence_score": 85,
      "reasoning": "Specific 1-2 sentence explanation of why this pattern is relevant to this company based on their data",
      "suggested_customizations": "How this pattern should be adapted for this specific company"
    }
  ]
}

Rules:
- Return 3-8 suggestions, ranked by confidence_score (highest first)
- confidence_score is 0-100 (how relevant this pattern is to THIS company)
- Only suggest patterns that genuinely apply — don't force-fit
- Cross-industry patterns can apply to any company if relevant
- Reasoning must reference specific company data (industry, size, tech, crawl scores)
- suggested_customizations should be actionable and specific to the company
- pattern_index refers to the [N] number in the pattern library list above`;

    console.log(`[generate-pattern-suggestions] Generating for company ${company.name} (${company_id})`);

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'You are a growth marketing strategist. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-pattern-suggestions] API error:', response.status, errorText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in AI response');
    }

    // Parse JSON — handle markdown code blocks if returned
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      console.error('[generate-pattern-suggestions] Failed to parse AI response:', content);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Map pattern_index back to pattern_id and validate
    const suggestions = (parsed.suggestions ?? [])
      .filter((s: any) => {
        const idx = s.pattern_index;
        return typeof idx === 'number' && idx >= 0 && idx < patterns.length;
      })
      .map((s: any) => ({
        pattern_id: (patterns[s.pattern_index] as any).id,
        confidence_score: Math.max(0, Math.min(100, Math.round(s.confidence_score))),
        reasoning: s.reasoning ?? '',
        suggested_customizations: s.suggested_customizations ?? '',
      }));

    // Cache results in companies.enrichment_data.pattern_suggestions
    const updatedEnrichment = {
      ...enrichment,
      pattern_suggestions: {
        suggestions,
        generated_at: new Date().toISOString(),
        patterns_analyzed: patterns.length,
        had_crawl_data: !!crawlSession,
      },
    };

    const { error: updateError } = await supabase
      .from('companies')
      .update({ enrichment_data: updatedEnrichment })
      .eq('id', company_id);

    if (updateError) {
      console.warn('[generate-pattern-suggestions] Failed to cache results:', updateError.message);
    }

    // Log usage
    try {
      const userId = await getUserIdFromRequest(req);
      const usage = extractOpenAIUsage(result);
      await logUsage(userId, 'generate-pattern-suggestions', 'gemini-2.0-flash', usage.promptTokens, usage.completionTokens, { company_id });
    } catch (e) {
      console.warn('[generate-pattern-suggestions] Usage logging failed:', e);
    }

    console.log(`[generate-pattern-suggestions] Generated ${suggestions.length} suggestions for ${company.name}`);

    return new Response(
      JSON.stringify({ success: true, suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[generate-pattern-suggestions] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
