const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AI_GATEWAY_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

type ScreenshotRef = { url: string; title: string };
type Base64Screenshot = { data: string; mimeType: string; title: string };

const MAX_SCREENSHOTS = 5;
const MAX_IMAGE_BYTES = 500_000; // 500KB per image

async function downloadScreenshot(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const arrayBuffer = await resp.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
      console.warn(`Screenshot too large (${arrayBuffer.byteLength} bytes), skipping: ${url}`);
      return null;
    }

    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const contentType = resp.headers.get('content-type') || 'image/png';
    return { data: base64, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

function buildUserContent(domain: string, contextBlock: string, screenshots?: Base64Screenshot[]) {
  const textPrompt = `Review the company at ${domain} using all the documents, transcripts, URLs, site scrape data, screenshots, and research provided below. Produce the following strategic pyramid:

## 30 Observations
*A comprehensive inventory of what we found — specific, data-backed facts drawn directly from the research, crawl data, and documents provided.*

Organize the observations as **bullet points** under the following subheadings. Every single observation must be its own bullet point — do NOT combine them into paragraphs:

### Technology & Infrastructure
- (bullet observations here)

### User Experience & Design
- (bullet observations here)

### Content & SEO
- (bullet observations here)

### Performance & Analytics
- (bullet observations here)

### Organizational Context
- (bullet observations here)

### Competitive Landscape & Market Position
- (bullet observations here)

## 20 Insights
*Patterns, implications, and connections that emerge when we look across the observations — the "so what" behind the data.*

Organize the insights as **bullet points** under the following thematic subheadings:

### Strategic Opportunities
- (bullet insights here)

### Risk Areas
- (bullet insights here)

### Patterns & Correlations
- (bullet insights here)

## 10 Recommendations
*At GLIDE®, we subscribe to the concept of "diagnose before prescribe." These are observations turned into action so you can see where our thinking is headed. They will only get more clear as conversations continue, and of course, if we engage in a full project with the full team.*

Provide 10 concrete, prioritized recommendations. For each recommendation, provide:
- **Action:** What specifically to do
- **Why:** The reasoning and evidence behind it
- **Impact:** The expected outcome or benefit

## 5 Strategies
*High-level initiatives that tie the recommendations together into coherent themes.*

Define 5 high-level strategies that tie the recommendations together into coherent themes or initiatives.

## 3 Keys to Success
*The most critical factors that will determine whether this company succeeds in its digital presence.*

Identify the 3 most critical factors that will determine whether this company succeeds in its digital presence.

## 1 North Star
*The single guiding principle or metric that should orient all digital efforts.*

Define the single most important guiding principle or metric this company should orient all digital efforts around.

${contextBlock}`;

  if (screenshots && screenshots.length > 0) {
    const parts: any[] = [{ type: 'text', text: textPrompt }];
    parts.push({ type: 'text', text: '\n\n---\n\n## Page Screenshots\nBelow are screenshots of key pages from the website. Use these to inform your observations about User Experience & Design, Content & SEO, and other visual aspects:\n' });
    for (const ss of screenshots) {
      parts.push({ type: 'text', text: `\nScreenshot: ${ss.title}` });
      parts.push({ type: 'image_url', image_url: { url: `data:${ss.mimeType};base64,${ss.data}` } });
    }
    return parts;
  }

  return textPrompt;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, crawlContext, documents, screenshotUrls } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
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

    let contextBlock = '';
    if (crawlContext) {
      contextBlock += `\n\n---\n\nHere is all the data gathered about the website:\n\n${crawlContext}`;
    }
    if (documents && Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.content) {
          contextBlock += `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${doc.content}`;
        }
      }
    }

    const screenshotCount = screenshotUrls?.length || 0;
    console.log(`Generating Observations & Insights for: ${domain} (${screenshotCount} screenshots, downloading up to ${MAX_SCREENSHOTS})`);

    // Download screenshots sequentially to control memory — cap count and size
    let base64Screenshots: Base64Screenshot[] = [];
    if (screenshotUrls && screenshotUrls.length > 0) {
      const toDownload = screenshotUrls.slice(0, MAX_SCREENSHOTS);
      for (const ss of toDownload) {
        const result = await downloadScreenshot(ss.url);
        if (result) {
          base64Screenshots.push({ data: result.data, mimeType: result.mimeType, title: ss.title });
        }
      }
      console.log(`Downloaded ${base64Screenshots.length}/${toDownload.length} screenshots`);
    }

    const systemPrompt = `You are a senior digital strategist and website analyst. You produce structured strategic analysis using a pyramid framework. Your analysis must be specific, actionable, and grounded in the data provided. Use markdown formatting with clear headers and subheaders for each section.

When writing Observations, organize them as bullet points under these category subheadings. CRITICAL: Every observation must be its own bullet point. Never combine observations into paragraphs. Use markdown bullet syntax (- ) for every single observation:
- Technology & Infrastructure
- User Experience & Design
- Content & SEO
- Performance & Analytics
- Organizational Context
- Competitive Landscape & Market Position

When writing Insights, organize them under these thematic subheadings:
- Strategic Opportunities
- Risk Areas
- Patterns & Correlations

When writing Recommendations, format each one with three clearly labeled parts:
- **Action:** What specifically to do
- **Why:** The reasoning and evidence behind it
- **Impact:** The expected outcome or benefit

If page screenshots are provided, use them to make specific visual observations about layout, design quality, content hierarchy, calls-to-action, branding consistency, and mobile responsiveness.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserContent(domain, contextBlock, base64Screenshots.length > 0 ? base64Screenshots : undefined) },
        ],
        max_tokens: 16000,
      }),
    });

    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse AI response:', responseText.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned invalid response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      console.error('AI Gateway error:', data);
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait a moment and try again.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI credits exhausted. Please add funds in Settings.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: data.error?.message || 'AI request failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result = data.choices?.[0]?.message?.content || '';

    // If multimodal request returned empty, retry with text-only
    if (!result && base64Screenshots.length > 0) {
      console.warn('Multimodal request returned empty result, retrying text-only...');
      const retryResponse = await fetch(AI_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: buildUserContent(domain, contextBlock) },
          ],
          max_tokens: 16000,
        }),
      });
      const retryText = await retryResponse.text();
      let retryData: any;
      try {
        retryData = JSON.parse(retryText);
      } catch {
        console.error('Failed to parse AI retry response:', retryText.substring(0, 500));
        return new Response(
          JSON.stringify({ success: false, error: 'AI returned invalid response on retry. Please try again.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!retryResponse.ok) {
        console.error('AI Gateway retry error:', retryData);
        return new Response(
          JSON.stringify({ success: false, error: retryData.error?.message || 'AI request failed on retry' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = retryData.choices?.[0]?.message?.content || '';
    }

    if (!result) {
      console.error('AI returned empty result. Full response:', JSON.stringify(data).substring(0, 2000));
      return new Response(
        JSON.stringify({ success: false, error: 'AI returned an empty response. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Observations & Insights error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to generate analysis' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
