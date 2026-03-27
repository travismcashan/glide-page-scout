const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action = 'start' } = body;

    // ── START: kick off a new background research task, return interaction ID ──
    if (action === 'start') {
      const { prompt, crawlContext, documents } = body;

      if (!prompt) {
        return new Response(
          JSON.stringify({ success: false, error: 'prompt is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { previousInteractionId, screenshots } = body;

      // ── System-level formatting prompt (McKinsey-grade output) ──
      const SYSTEM_PROMPT = `You are a senior strategy consultant at a top-tier firm (McKinsey, Bain, BCG). You produce comprehensive, publication-quality consultative reports.

## OUTPUT FORMAT REQUIREMENTS

Produce a **detailed, 25-30 page equivalent** strategic analysis document with the following structure:

### Document Structure
1. **Executive Summary** (1-2 pages) — Key findings, critical recommendations, and strategic imperatives. Write this as if briefing a C-suite executive.
2. **Methodology & Data Sources** — Briefly describe what data was analyzed and how conclusions were drawn.
3. **Strategic Context Analysis** (using the CIRT Framework & 5C Diagnostic)
   - **Climate** (Macro-Environmental Forces): PESTEL analysis, market dynamics, Porter's Five Forces
   - **Competition** (Full Spectrum of Rivalry): Direct, indirect, and substitute competitors; competitive positioning matrix
   - **Customer** (Intent Constellation): Stakeholder mapping, buyer journey, intent types (Informational → Commercial → Transactional)
   - **Company** (Internal Capabilities): Strengths, weaknesses, digital maturity assessment
   - **Culture** (Organizational DNA): Brand voice, values alignment, cultural signals
4. **Intent Analysis** — Map the buyer constellation using the Stakeholder Intent Matrix
5. **Relevance Assessment** — Evaluate role-based, procurement-stage, organizational, and peer relevance
6. **Trust Audit** — Assess current trust signals across the Trust Spiral: Competence → Consistency → Character → Connection
7. **Detailed Findings & Analysis** (section per major area: Performance, SEO, Security, Accessibility, Technology, Content, UX)
8. **Competitive Benchmarking** — Compare against industry standards and identified competitors
9. **Strategic Recommendations** — Prioritized by impact and effort, with specific action items
10. **Implementation Roadmap** — Phased approach with quick wins, medium-term, and long-term initiatives
11. **Risk Assessment** — What happens if recommendations are NOT implemented
12. **Appendix** — Supporting data tables, detailed metrics

### Formatting Rules
- Use **markdown tables** for all comparative data, metrics, and matrices
- Include **data-driven insights** — cite specific numbers, scores, and metrics from the provided data
- Use **bold** for key findings and **> blockquotes** for critical callouts
- Write in a **professional, authoritative tone** — not promotional, not casual
- When specific data is unavailable, explicitly state "Data not available" rather than estimating
- Structure recommendations as: **Finding → Impact → Recommendation → Expected Outcome**
- Include a **scoring rubric** (1-10) for each major assessment area
- Every claim must be grounded in the provided data or clearly labeled as an inference

### Quality Standards
- No filler content or generic advice — every paragraph must add specific value
- Cross-reference findings across sections (e.g., "The performance issues identified in Section 7.1 directly impact the trust signals analyzed in Section 6")
- Include **"So What?"** implications after every major finding
- End each section with **Key Takeaways** (3-5 bullet points)
`;

      // Build input — cap total size to stay under Gemini's context limit
      const MAX_CHARS = 400_000;
      let fullPrompt = `${SYSTEM_PROMPT}\n\n---\n\n## USER REQUEST\n\n${prompt}`;

      if (crawlContext) {
        const available = MAX_CHARS - fullPrompt.length - 200;
        if (available > 0) {
          const trimmed = crawlContext.length > available ? crawlContext.slice(0, available) + '\n\n[… context truncated to fit token limit]' : crawlContext;
          fullPrompt += `\n\n---\n\n## WEBSITE DATA & METRICS\n\nHere is data already gathered about the website. Use this as primary evidence for your analysis:\n\n${trimmed}`;
        }
      }

      if (documents && Array.isArray(documents)) {
        for (const doc of documents) {
          if (doc.content && fullPrompt.length < MAX_CHARS) {
            const space = MAX_CHARS - fullPrompt.length - 100;
            if (space > 0) {
              const trimmedDoc = doc.content.length > space ? doc.content.slice(0, space) + '\n\n[… document truncated]' : doc.content;
              fullPrompt += `\n\n---\n## REFERENCE DOCUMENT: ${doc.name || 'Untitled'}\n\n${trimmedDoc}`;
            }
          }
        }
      }

      console.log(`[deep-research] Final prompt length: ${fullPrompt.length} chars (~${Math.round(fullPrompt.length/4)} tokens)`);
      console.log('Starting Gemini Deep Research (background):', prompt.substring(0, 100));

      // Build the request payload
      const interactionPayload: Record<string, any> = {
        input: fullPrompt,
        agent: 'deep-research-pro-preview-12-2025',
        background: true,
        stream: false,
        agent_config: {
          type: 'deep-research',
          thinking_summaries: 'auto',
        },
      };

      // Chain follow-up interactions
      if (previousInteractionId) {
        interactionPayload.previous_interaction_id = previousInteractionId;
        console.log('Chaining to previous interaction:', previousInteractionId);
      }

      // Multimodal: attach screenshots as inline_data parts
      if (screenshots && Array.isArray(screenshots) && screenshots.length > 0) {
        const parts: any[] = [{ text: fullPrompt }];
        for (const ss of screenshots.slice(0, 5)) { // max 5 screenshots
          if (ss.base64 && ss.mimeType) {
            parts.push({
              inline_data: {
                mime_type: ss.mimeType,
                data: ss.base64,
              },
            });
          }
        }
        // When using multimodal, override input with parts array
        interactionPayload.input = parts;
        console.log(`[deep-research] Including ${Math.min(screenshots.length, 5)} screenshots as multimodal input`);
      }

      const startRes = await fetch(`${GEMINI_API_BASE}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(interactionPayload),
      });

      if (!startRes.ok) {
        const errText = await startRes.text();
        console.error('Gemini start error:', startRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Failed to start research (${startRes.status}): ${errText}` }),
          { status: startRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const startData = await startRes.json();
      const interactionName = startData.name || startData.id || null;
      const state = startData.state || 'in_progress';

      console.log('Interaction started:', interactionName, 'state:', state);

      return new Response(
        JSON.stringify({ success: true, interactionId: interactionName, state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── STREAM: connect to an existing interaction's SSE stream ──
    if (action === 'stream') {
      const { interactionId, lastEventId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Ensure the interaction ID is prefixed with "interactions/"
      const resourceName = interactionId.startsWith('interactions/') ? interactionId : `interactions/${interactionId}`;
      let streamUrl = `${GEMINI_API_BASE}/${resourceName}?stream=true&alt=sse`;
      if (lastEventId) {
        streamUrl += `&last_event_id=${encodeURIComponent(lastEventId)}`;
      }

      console.log('Connecting to stream for:', interactionId);

      const streamRes = await fetch(streamUrl, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!streamRes.ok) {
        const errText = await streamRes.text();
        console.error('Stream error:', streamRes.status, errText);
        return new Response(
          JSON.stringify({ success: false, error: `Stream failed (${streamRes.status}): ${errText}` }),
          { status: streamRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Proxy the SSE stream to the client
      return new Response(streamRes.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // ── POLL: get current state of an interaction (non-streaming) ──
    if (action === 'poll') {
      const { interactionId } = body;
      if (!interactionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'interactionId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const resourceName = interactionId.startsWith('interactions/') ? interactionId : `interactions/${interactionId}`;
      const pollUrl = `${GEMINI_API_BASE}/${resourceName}`;
      console.log('Polling interaction:', interactionId);

      const pollRes = await fetch(pollUrl, {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        console.error('Gemini poll error:', pollRes.status, errText);
        // 409 = conflict / task failed on Gemini's side — treat as terminal
        const isTerminal = pollRes.status === 409 || pollRes.status === 404;
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: isTerminal 
              ? 'Research task failed on the server side. Please try again with a new request.' 
              : `Poll failed (${pollRes.status})`,
            terminal: isTerminal,
          }),
          { status: isTerminal ? 200 : pollRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pollData = await pollRes.json();
      return new Response(
        JSON.stringify({ success: true, ...pollData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Deep Research error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
