import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Map frontend Claude IDs to actual Anthropic model identifiers and their max output tokens
const CLAUDE_MODELS: Record<string, { model: string; maxOutput: number }> = {
  'claude-haiku': { model: 'claude-haiku-4-5-20251001', maxOutput: 64000 },
  'claude-sonnet': { model: 'claude-sonnet-4-6', maxOutput: 64000 },
  'claude-opus': { model: 'claude-opus-4-6', maxOutput: 128000 },
};

// Map frontend Perplexity IDs to actual Perplexity model identifiers
const PERPLEXITY_MODELS: Record<string, string> = {
  'perplexity-sonar': 'sonar',
  'perplexity-sonar-pro': 'sonar-pro',
  'perplexity-sonar-reasoning-pro': 'sonar-reasoning-pro',
};

// Claude extended thinking budget (used when reasoning=high)
const CLAUDE_THINKING_BUDGET = 16384;

const ALLOWED_GATEWAY_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'google/gemini-3-flash-preview',
  'google/gemini-2.5-pro',
  'google/gemini-3.1-pro-preview',
  'openai/gpt-5-nano',
  'openai/gpt-5-mini',
  'openai/gpt-5',
  'openai/gpt-5.2',
];

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Communicate in a polished, precise, and business-appropriate tone. Use clear structure, avoid colloquialisms, and maintain a formal yet approachable style.',
  friendly: 'Be warm, chatty, and approachable. Use a conversational tone with encouragement and enthusiasm. Feel free to use casual language.',
  candid: 'Be direct, honest, and encouraging. Get straight to the point without sugarcoating, but remain supportive and constructive.',
  quirky: 'Be playful, imaginative, and creative with language. Use unexpected analogies, humor, and a distinctive voice that makes interactions memorable.',
  efficient: 'Be extremely concise and plain. Use short sentences, bullet points, and minimal prose. Skip pleasantries and get to the information quickly.',
  cynical: 'Be critical, sarcastic, and bluntly honest. Challenge assumptions and point out flaws directly. Use dry wit but remain ultimately helpful.',
};

const CHARACTERISTIC_INSTRUCTIONS: Record<string, string> = {
  warm: 'Use a caring, empathetic tone that makes the user feel supported.',
  enthusiastic: 'Be energetic and excited about the topic. Show genuine interest.',
  'headers-lists': 'Structure responses with clear headings (##, ###) and bullet/numbered lists for readability.',
  emoji: 'Sprinkle in relevant emoji throughout responses to add personality and visual interest.',
  tables: 'When presenting comparative data or structured information, prefer using markdown tables.',
  gifs: 'Occasionally include a fun, relevant GIF using markdown image syntax linking to Giphy (e.g. ![description](https://media.giphy.com/...)). Use sparingly for humor or emphasis — maybe once per longer response when it fits naturally.',
};

function buildSystemPrompt(contextBlock: string, tonePreset?: string, characteristics?: string[], customInstructions?: string, aboutMe?: Record<string, any>, personalBio?: string, myRole?: string, locationData?: Record<string, any>): string {
  const toneBlock = tonePreset && tonePreset !== 'default' && TONE_INSTRUCTIONS[tonePreset]
    ? `\n\n---\n\n**Communication Style**: ${TONE_INSTRUCTIONS[tonePreset]}\n`
    : '';

  const charParts = (characteristics || []).map(c => CHARACTERISTIC_INSTRUCTIONS[c]).filter(Boolean);
  const charBlock = charParts.length > 0
    ? `\n\n---\n\n**Response Characteristics** (always apply these):\n${charParts.map(c => `- ${c}`).join('\n')}\n`
    : '';

  const customBlock = customInstructions?.trim()
    ? `\n\n---\n\n**User's Custom Instructions** (always follow these preferences):\n${customInstructions.trim()}\n`
    : '';

  let aboutBlock = '';
  if (aboutMe && typeof aboutMe === 'object') {
    const parts: string[] = [];
    if (aboutMe.name) parts.push(`Name: ${aboutMe.name}`);
    if (aboutMe.title) parts.push(`Title: ${aboutMe.title}`);
    if (aboutMe.organization) parts.push(`Company: ${aboutMe.organization}${aboutMe.orgIndustry ? ` (${aboutMe.orgIndustry})` : ''}`);
    if (aboutMe.orgSize) parts.push(`Company Size: ${aboutMe.orgSize}`);
    if (aboutMe.city || aboutMe.state || aboutMe.country) parts.push(`Location: ${[aboutMe.city, aboutMe.state, aboutMe.country].filter(Boolean).join(', ')}`);
    if (aboutMe.seniority) parts.push(`Seniority: ${aboutMe.seniority}`);
    if (aboutMe.departments?.length) parts.push(`Departments: ${aboutMe.departments.join(', ')}`);
    if (myRole?.trim()) parts.push(`\nWhat they do (in their own words):\n${myRole.trim()}`);
    if (personalBio?.trim()) parts.push(`\nUser's own bio:\n${personalBio.trim()}`);
    if (locationData?.city) parts.push(`\nCurrent location: ${[locationData.city, locationData.region, locationData.country].filter(Boolean).join(', ')}`);
    if (locationData?.timezone) parts.push(`Timezone: ${locationData.timezone} (current local time: ${new Date().toLocaleString('en-US', { timeZone: locationData.timezone, hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'long' })})`);
    if (parts.length > 0) {
      aboutBlock = `\n\n---\n\n**About the User** (use this to personalize your responses — address them by name, understand their role, company context, and current time/location):\n${parts.join('\n')}\n`;
    }
  } else if (myRole?.trim() || personalBio?.trim()) {
    const userParts: string[] = [];
    if (myRole?.trim()) userParts.push(`Role description: ${myRole.trim()}`);
    if (personalBio?.trim()) userParts.push(`Bio: ${personalBio.trim()}`);
    aboutBlock = `\n\n---\n\n**About the User** (use this to personalize your responses):\n${userParts.join('\n\n')}\n`;
  }

  return `You are an expert website analyst and digital strategist with deep knowledge of SEO, performance optimization, security, accessibility, and marketing technology.${aboutBlock}${toneBlock}${charBlock}${customBlock}

You have access to comprehensive audit data from multiple integration tools. When answering questions:

1. **Cite your sources**: Always reference the specific integration by name (e.g., "According to the SEMrush Domain Analysis…", "The WAVE Accessibility scan found…", "Based on the PageSpeed Insights data…").
2. **Stay grounded in the data**: Base your answers on the actual data provided. Don't fabricate metrics or findings.
3. **Be specific**: Quote actual numbers, scores, grades, and findings from the data.
4. **Be consultative**: Provide actionable recommendations when appropriate.
5. **Cross-reference**: When multiple integrations provide related data, connect the dots to give a holistic picture.
6. **File attachments**: When users attach files or images, analyze them in the context of the website audit. For images/screenshots, describe what you see and relate it to audit findings.

**Live Analytics Tools**: You have access to tools that query Google Analytics 4, Google Search Console, and HubSpot CRM in real-time. Use these tools when:
- The user asks for custom date ranges not in the static audit snapshot
- The user wants year-over-year or period-over-period comparisons
- The user asks for dimensions or metrics not included in the audit (e.g., country breakdown, device category, specific page performance)
- The user wants the very latest data (the audit snapshot may be hours or days old)
- The user asks about MQLs, SQLs, lifecycle stages, deal pipeline, pipeline value, or CRM metrics (use query_hubspot)
- When combining web analytics (GA4/GSC) with CRM data (HubSpot), call multiple tools and synthesize the results

Today's date is ${new Date().toISOString().split('T')[0]}. Use this when computing date ranges (e.g., "last year" = one year ago to today, "Q1 2025" = 2025-01-01 to 2025-03-31).

If asked about something not covered by the available data, say so clearly rather than guessing.

${contextBlock ? `\n---\n\nHere is all the audit data gathered about this website:\n\n${contextBlock}` : '\nNo audit data is currently available for this session.'}`;
}

function buildContextBlock(crawlContext: string | undefined, documents: any[] | undefined): string {
  const MAX_CHARS = 400_000;
  let contextBlock = '';

  if (crawlContext) {
    const available = MAX_CHARS - 2000;
    contextBlock = crawlContext.length > available
      ? crawlContext.slice(0, available) + '\n\n[… context truncated to fit token limit]'
      : crawlContext;
  }

  if (documents && Array.isArray(documents)) {
    for (const doc of documents) {
      if (doc.content && contextBlock.length < MAX_CHARS) {
        const space = MAX_CHARS - contextBlock.length - 100;
        if (space > 0) {
          const trimmedDoc = doc.content.length > space
            ? doc.content.slice(0, space) + '\n\n[… document truncated]'
            : doc.content;
          contextBlock += `\n\n---\nAttached Document: ${doc.name || 'Untitled'}\n\n${trimmedDoc}`;
        }
      }
    }
  }

  return contextBlock;
}

/**
 * Route query to the most relevant source types using a fast LLM classification
 */
async function routeQuery(query: string): Promise<{ priority_sources: string[]; chronological: boolean; needs_screenshots: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return { priority_sources: [], chronological: false, needs_screenshots: false };

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `You are a query router. Given a user question about a website audit, classify which document source types are most relevant, whether the question requires chronological ordering, and whether screenshots of the website pages would help answer the question.

Available source_types: "upload", "gmail", "chat", "crawl", "gdrive"
- "gmail" = email threads/messages
- "upload" = user-uploaded documents (proposals, reports, PDFs)
- "chat" = previous AI chat conversations
- "crawl" = website page content scraped during audit
- "gdrive" = Google Drive documents

Respond with a JSON object:
{
  "priority_sources": ["gmail"],  // 0-2 source types most relevant. Empty array if the question is general/unclear.
  "chronological": false,         // true ONLY if the question asks about timeline, first/last, sequence, or date-based ordering
  "needs_screenshots": false      // true if the question is about visual design, layout, appearance, branding, colors, UI, UX, how pages look, comparing designs, or anything that would benefit from seeing the actual website screenshots
}

Examples:
- "What was the first email from John?" → {"priority_sources":["gmail"],"chronological":true,"needs_screenshots":false}
- "Summarize the proposal document" → {"priority_sources":["upload"],"chronological":false,"needs_screenshots":false}
- "How does the homepage look?" → {"priority_sources":["crawl"],"chronological":false,"needs_screenshots":true}
- "What's the design style of the website?" → {"priority_sources":[],"chronological":false,"needs_screenshots":true}
- "Compare the header across pages" → {"priority_sources":["crawl"],"chronological":false,"needs_screenshots":true}
- "How is the website performing?" → {"priority_sources":[],"chronological":false,"needs_screenshots":false}
- "Show me the email history" → {"priority_sources":["gmail"],"chronological":true,"needs_screenshots":false}
- "What pages were crawled?" → {"priority_sources":["crawl"],"chronological":false,"needs_screenshots":false}
- "What colors does the site use?" → {"priority_sources":[],"chronological":false,"needs_screenshots":true}
- "Is the navigation user-friendly?" → {"priority_sources":[],"chronological":false,"needs_screenshots":true}`
          },
          { role: 'user', content: query },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'route_query',
            description: 'Classify the query for document routing',
            parameters: {
              type: 'object',
              properties: {
                priority_sources: {
                  type: 'array',
                  items: { type: 'string', enum: ['upload', 'gmail', 'chat', 'crawl', 'gdrive'] },
                  description: 'Source types most relevant to this query (0-2 items)',
                },
                chronological: {
                  type: 'boolean',
                  description: 'Whether this question needs chronological ordering',
                },
                needs_screenshots: {
                  type: 'boolean',
                  description: 'Whether website screenshots would help answer this question',
                },
              },
              required: ['priority_sources', 'chronological', 'needs_screenshots'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'route_query' } },
      }),
    });

    if (!response.ok) {
      console.warn('[knowledge-chat] Router classification failed:', response.status);
      return { priority_sources: [], chronological: false, needs_screenshots: false };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      console.log(`[knowledge-chat] Router: sources=${JSON.stringify(parsed.priority_sources)}, chrono=${parsed.chronological}, screenshots=${parsed.needs_screenshots}`);
      return {
        priority_sources: Array.isArray(parsed.priority_sources) ? parsed.priority_sources : [],
        chronological: !!parsed.chronological,
        needs_screenshots: !!parsed.needs_screenshots,
      };
    }
    return { priority_sources: [], chronological: false, needs_screenshots: false };
  } catch (e) {
    console.warn('[knowledge-chat] Router error, falling back:', e);
    return { priority_sources: [], chronological: false, needs_screenshots: false };
  }
}

/**
 * Get query embedding vector
 */
async function getEmbedding(query: string): Promise<number[] | null> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.warn('[knowledge-chat] GEMINI_API_KEY not set, skipping embedding');
    return null;
  }

  const embResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: query.slice(0, 4000) }] },
        outputDimensionality: 768,
      }),
    }
  );

  if (!embResponse.ok) {
    console.error('[knowledge-chat] Embedding error:', await embResponse.text());
    return null;
  }

  const embData = await embResponse.json();
  return embData.embedding?.values || null;
}

/**
 * Perform RAG search using a pre-computed embedding
 */
async function ragSearchWithEmbedding(
  sessionId: string | string[],
  embedding: number[],
  matchCount: number,
  matchThreshold: number,
  sourceTypes?: string[],
): Promise<Array<{ id: string; document_id: string; chunk_index: number; chunk_text: string; document_name: string; source_type: string; similarity: number }>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const embeddingStr = `[${embedding.join(',')}]`;
  const isMulti = Array.isArray(sessionId);

  if (isMulti) {
    // Multi-session search using the new function
    const { data, error } = await supabase.rpc('match_knowledge_chunks_multi', {
      p_session_ids: sessionId,
      p_embedding: embeddingStr,
      p_match_count: matchCount,
      p_match_threshold: matchThreshold,
    });
    if (error) {
      console.error('[knowledge-chat] Multi-session RAG error:', error);
      return [];
    }
    return data || [];
  } else if (sourceTypes && sourceTypes.length > 0) {
    const { data, error } = await supabase.rpc('match_knowledge_chunks_by_source', {
      p_session_id: sessionId,
      p_embedding: embeddingStr,
      p_source_types: sourceTypes,
      p_match_count: matchCount,
      p_match_threshold: matchThreshold,
    });
    if (error) {
      console.error('[knowledge-chat] Source-filtered RAG error:', error);
      return [];
    }
    return data || [];
  } else {
    const { data, error } = await supabase.rpc('match_knowledge_chunks', {
      p_session_id: sessionId,
      p_embedding: embeddingStr,
      p_match_count: matchCount,
      p_match_threshold: matchThreshold,
    });
    if (error) {
      console.error('[knowledge-chat] RAG search error:', error);
      return [];
    }
    return data || [];
  }
}

/**
 * Format RAG matches into context string, optionally sorting chronologically
 */
function formatRagResults(matches: Array<{ id: string; document_id: string; chunk_index: number; chunk_text: string; document_name: string; source_type: string; similarity: number }>, chronological: boolean, prioritySources: string[]): string {
  if (matches.length === 0) return '';

  // If chronological, sort priority source chunks by chunk_index (proxy for document order/time)
  if (chronological && prioritySources.length > 0) {
    const priorityMatches = matches.filter(m => prioritySources.includes(m.source_type));
    const otherMatches = matches.filter(m => !prioritySources.includes(m.source_type));

    // Sort priority matches by document_name then chunk_index for chronological ordering
    priorityMatches.sort((a, b) => {
      const nameCompare = a.document_name.localeCompare(b.document_name);
      if (nameCompare !== 0) return nameCompare;
      return a.chunk_index - b.chunk_index;
    });

    matches = [...priorityMatches, ...otherMatches];
  }

  const docChunks = new Map<string, { name: string; sourceType: string; chunks: string[] }>();
  for (const match of matches) {
    const key = match.document_id;
    if (!docChunks.has(key)) {
      docChunks.set(key, { name: match.document_name, sourceType: match.source_type, chunks: [] });
    }
    docChunks.get(key)!.chunks.push(match.chunk_text);
  }

  let ragContext = '--- RETRIEVED KNOWLEDGE (most relevant chunks from indexed documents) ---\n\n';
  for (const [, doc] of docChunks) {
    ragContext += `=== ${doc.name} (${doc.sourceType}) ===\n`;
    ragContext += doc.chunks.join('\n\n');
    ragContext += '\n\n';
  }

  return ragContext;
}

/**
 * Fetch screenshot URLs for a session, optionally filtering by query-mentioned URLs
 */
async function fetchScreenshots(
  sessionId: string,
  query: string,
  maxImages = 5,
): Promise<{ url: string; screenshot_url: string }[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: screenshots, error } = await supabase
    .from('crawl_screenshots')
    .select('url, screenshot_url')
    .eq('session_id', sessionId)
    .eq('status', 'done')
    .not('screenshot_url', 'is', null);

  if (error || !screenshots || screenshots.length === 0) {
    console.log(`[knowledge-chat] No screenshots found for session ${sessionId}`);
    return [];
  }

  // Try to match specific pages mentioned in the query
  const queryLower = query.toLowerCase();
  const mentionedPages = screenshots.filter(s => {
    try {
      const urlPath = new URL(s.url).pathname.toLowerCase();
      const urlParts = urlPath.split('/').filter(Boolean);
      return urlParts.some(part => queryLower.includes(part));
    } catch {
      return false;
    }
  });

  // If specific pages matched, prioritize those + add homepage
  if (mentionedPages.length > 0) {
    const homepage = screenshots.find(s => {
      try { return new URL(s.url).pathname === '/'; } catch { return false; }
    });
    const selected = [...mentionedPages];
    if (homepage && !selected.some(s => s.url === homepage.url)) {
      selected.unshift(homepage);
    }
    return selected.slice(0, maxImages);
  }

  // For general visual questions: homepage + sample of inner pages
  const homepage = screenshots.find(s => {
    try { return new URL(s.url).pathname === '/'; } catch { return false; }
  });
  const innerPages = screenshots.filter(s => {
    try { return new URL(s.url).pathname !== '/'; } catch { return true; }
  });

  const selected: typeof screenshots = [];
  if (homepage) selected.push(homepage);

  // Add diverse inner pages (spread across the list)
  const step = Math.max(1, Math.floor(innerPages.length / (maxImages - selected.length)));
  for (let i = 0; i < innerPages.length && selected.length < maxImages; i += step) {
    selected.push(innerPages[i]);
  }

  return selected;
}

/**
 * Perform RAG search: embed the user query, find relevant chunks via pgvector
 * Now with smart routing: runs parallel general + source-filtered searches
 */
async function ragSearch(sessionId: string, query: string, matchCount = 25, matchThreshold = 0.25): Promise<string> {
  try {
    // Step 1: Run router classification and embedding in parallel
    const [routing, embedding] = await Promise.all([
      routeQuery(query),
      getEmbedding(query),
    ]);

    if (!embedding) return '';

    const { priority_sources, chronological } = routing;

    // Step 2: Run general search + source-filtered search in parallel
    const searchPromises: Promise<Array<any>>[] = [];

    // Always run the general search (existing behavior)
    searchPromises.push(ragSearchWithEmbedding(sessionId, embedding, matchCount, matchThreshold));

    // If router identified priority sources, also search filtered
    if (priority_sources.length > 0) {
      const sourceMatchCount = chronological ? 50 : 25; // fetch more for chronological
      searchPromises.push(ragSearchWithEmbedding(sessionId, embedding, sourceMatchCount, Math.max(matchThreshold - 0.05, 0.05), priority_sources));
    }

    const results = await Promise.all(searchPromises);
    const generalMatches = results[0] || [];
    const sourceMatches = results[1] || [];

    // Step 3: Merge & dedupe
    const seenIds = new Set<string>();
    const merged: typeof generalMatches = [];

    // Priority source matches first (they're the specifically relevant ones)
    for (const match of sourceMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        merged.push(match);
      }
    }
    // Then general matches
    for (const match of generalMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        merged.push(match);
      }
    }

    if (merged.length === 0) return '';

    const ragContext = formatRagResults(merged, chronological, priority_sources);
    console.log(`[knowledge-chat] Smart RAG: ${generalMatches.length} general + ${sourceMatches.length} source-filtered → ${merged.length} merged chunks (route: ${JSON.stringify(priority_sources)}, chrono: ${chronological})`);
    return ragContext;
  } catch (e) {
    console.error('[knowledge-chat] RAG search failed:', e);
    return '';
  }
}

/**
 * Perform RAG search and also return the routing result for screenshot decisions
 * and the list of documents referenced
 */
async function ragSearchWithRouting(sessionId: string, query: string, matchCount = 25, matchThreshold = 0.25): Promise<{ ragContext: string; needs_screenshots: boolean; ragDocuments: { name: string; source_type: string }[] }> {
  try {
    const [routing, embedding] = await Promise.all([
      routeQuery(query),
      getEmbedding(query),
    ]);

    if (!embedding) return { ragContext: '', needs_screenshots: routing.needs_screenshots, ragDocuments: [] };

    const { priority_sources, chronological, needs_screenshots } = routing;

    const searchPromises: Promise<Array<any>>[] = [];
    searchPromises.push(ragSearchWithEmbedding(sessionId, embedding, matchCount, matchThreshold));

    if (priority_sources.length > 0) {
      const sourceMatchCount = chronological ? 50 : 25;
      searchPromises.push(ragSearchWithEmbedding(sessionId, embedding, sourceMatchCount, Math.max(matchThreshold - 0.05, 0.05), priority_sources));
    }

    const results = await Promise.all(searchPromises);
    const generalMatches = results[0] || [];
    const sourceMatches = results[1] || [];

    const seenIds = new Set<string>();
    const merged: typeof generalMatches = [];

    for (const match of sourceMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        merged.push(match);
      }
    }
    for (const match of generalMatches) {
      if (!seenIds.has(match.id)) {
        seenIds.add(match.id);
        merged.push(match);
      }
    }

    if (merged.length === 0) return { ragContext: '', needs_screenshots, ragDocuments: [] };

    // Extract unique documents referenced
    const docMap = new Map<string, { name: string; source_type: string }>();
    for (const match of merged) {
      if (!docMap.has(match.document_id)) {
        docMap.set(match.document_id, { name: match.document_name, source_type: match.source_type });
      }
    }
    const ragDocuments = Array.from(docMap.values());

    const ragContext = formatRagResults(merged, chronological, priority_sources);
    console.log(`[knowledge-chat] Smart RAG: ${generalMatches.length} general + ${sourceMatches.length} source-filtered → ${merged.length} merged chunks from ${ragDocuments.length} documents (route: ${JSON.stringify(priority_sources)}, chrono: ${chronological}, screenshots: ${needs_screenshots})`);
    return { ragContext, needs_screenshots, ragDocuments };
  } catch (e) {
    console.error('[knowledge-chat] RAG search failed:', e);
    return { ragContext: '', needs_screenshots: false, ragDocuments: [] };
  }
}

/**
 * Perform web search via Perplexity Sonar to get grounded web results
 */
async function webSearch(query: string): Promise<string> {
  // Note: citations are extracted separately and returned via webSearchWithCitations
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    console.warn('[knowledge-chat] PERPLEXITY_API_KEY not set, skipping web search');
    return '';
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Provide detailed, factual information with specific data points. Include source URLs when possible.' },
          { role: 'user', content: query },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[knowledge-chat] Web search error:', response.status, await response.text());
      return '';
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    let webContext = '--- WEB SEARCH RESULTS ---\n\n';
    webContext += content;
    if (citations.length > 0) {
      webContext += '\n\nSources:\n';
      citations.forEach((url: string, i: number) => {
        webContext += `[${i + 1}] ${url}\n`;
      });
    }

    console.log(`[knowledge-chat] Web search returned ${content.length} chars, ${citations.length} citations`);
    return webContext;
  } catch (e) {
    console.error('[knowledge-chat] Web search failed:', e);
    return '';
  }
}

/**
 * Perform web search and return both context string and raw citations
 */
async function webSearchWithCitations(query: string): Promise<{ context: string; citations: string[] }> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    console.warn('[knowledge-chat] PERPLEXITY_API_KEY not set, skipping web search');
    return { context: '', citations: [] };
  }

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Provide detailed, factual information with specific data points. Include source URLs when possible.' },
          { role: 'user', content: query },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[knowledge-chat] Web search error:', response.status, await response.text());
      return { context: '', citations: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations: string[] = data.citations || [];

    let webContext = '--- WEB SEARCH RESULTS ---\n\n';
    webContext += content;
    if (citations.length > 0) {
      webContext += '\n\nSources:\n';
      citations.forEach((url: string, i: number) => {
        webContext += `[${i + 1}] ${url}\n`;
      });
    }

    console.log(`[knowledge-chat] Web search returned ${content.length} chars, ${citations.length} citations`);
    return { context: webContext, citations };
  } catch (e) {
    console.error('[knowledge-chat] Web search failed:', e);
    return { context: '', citations: [] };
  }
}

async function handleClaudeRequest(
  claudeModelId: string,
  messages: any[],
  systemPrompt: string,
  reasoning: string | undefined,
): Promise<Response> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY in settings.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const claudeConfig = CLAUDE_MODELS[claudeModelId];
  if (!claudeConfig) {
    return new Response(
      JSON.stringify({ error: `Unknown Claude model: ${claudeModelId}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Convert OpenAI-style messages to Anthropic format
  const anthropicMessages = messages.map((msg: any) => {
    if (Array.isArray(msg.content)) {
      const content = msg.content.map((part: any) => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return {
                type: 'image',
                source: { type: 'base64', media_type: match[1], data: match[2] },
              };
            }
          }
          return { type: 'text', text: `[Image: ${url}]` };
        }
        return part;
      });
      return { role: msg.role, content };
    }
    return { role: msg.role, content: msg.content };
  });

  // Build Anthropic request — use each model's full output capacity
  const requestBody: any = {
    model: claudeConfig.model,
    max_tokens: claudeConfig.maxOutput,
    system: systemPrompt,
    messages: anthropicMessages,
    stream: true,
  };

  // Add extended thinking if reasoning is requested
  if (reasoning === 'high') {
    const budget = Math.min(CLAUDE_THINKING_BUDGET, claudeConfig.maxOutput - 16384);
    if (budget > 0) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: budget,
      };
      requestBody.max_tokens = claudeConfig.maxOutput;
    }
  }

  console.log(`[knowledge-chat] Claude request: model=${claudeConfig.model}, thinking=${reasoning || 'none'}, max_tokens=${requestBody.max_tokens}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Anthropic API error:', response.status, errText);
    let errorMsg = `Anthropic API error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error?.message || errorMsg;
    } catch { /* use default */ }
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Transform Anthropic SSE stream to OpenAI-compatible format
  const transformedStream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const event = JSON.parse(jsonStr);
              // Convert Anthropic events to OpenAI delta format
              if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'text_delta') {
                  const openAiChunk = {
                    choices: [{ delta: { content: event.delta.text }, index: 0 }],
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
                } else if (event.delta?.type === 'thinking_delta') {
                  const openAiChunk = {
                    choices: [{ delta: { reasoning_content: event.delta.thinking }, index: 0 }],
                  };
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(openAiChunk)}\n\n`));
                }
              }
            } catch { /* skip unparseable */ }
          }
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      } catch (e) {
        console.error('Stream transform error:', e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(transformedStream, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
}

/**
 * Tool definitions for live analytics queries
 */
const ANALYTICS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'query_ga4',
      description: 'Query Google Analytics 4 (GA4) for live data. Use this when the user asks for analytics metrics like sessions, users, pageviews, bounce rate, engagement, conversions, traffic sources, or page performance — especially for custom date ranges, year-over-year comparisons, or data not in the static audit snapshot.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
          endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
          metrics: {
            type: 'array',
            items: { type: 'string' },
            description: 'GA4 metric names: sessions, totalUsers, newUsers, screenPageViews, bounceRate, averageSessionDuration, engagementRate, conversions, eventCount, userEngagementDuration',
          },
          dimensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional GA4 dimension names: date, pagePath, pageTitle, sessionDefaultChannelGroup, country, city, deviceCategory, browser, operatingSystem, landingPage',
          },
          limit: { type: 'number', description: 'Max rows to return (default 25, max 100)' },
          orderBy: { type: 'string', description: 'Metric or dimension name to sort by' },
          orderDesc: { type: 'boolean', description: 'Sort descending (default true for metrics)' },
          compareStartDate: { type: 'string', description: 'Comparison period start date (YYYY-MM-DD) for year-over-year or period-over-period' },
          compareEndDate: { type: 'string', description: 'Comparison period end date (YYYY-MM-DD)' },
        },
        required: ['startDate', 'endDate', 'metrics'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_search_console',
      description: 'Query Google Search Console for live search performance data. Use this when the user asks for keyword rankings, search queries, CTR, impressions, clicks, or position data — especially for custom date ranges or filtered queries.',
      parameters: {
        type: 'object',
        properties: {
          startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
          endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
          dimensions: {
            type: 'array',
            items: { type: 'string', enum: ['query', 'page', 'country', 'device', 'date', 'searchAppearance'] },
            description: 'Dimensions to break down by (default: query)',
          },
          limit: { type: 'number', description: 'Max rows (default 25, max 100)' },
        },
        required: ['startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_hubspot',
      description: 'Query HubSpot CRM for live data about contacts, deals, and companies. Use when the user asks about MQLs, SQLs, lifecycle stages, deal pipeline, pipeline value, contact counts, lead status, or CRM metrics — especially for custom date ranges or data not in the static audit snapshot.',
      parameters: {
        type: 'object',
        properties: {
          entity: {
            type: 'string',
            enum: ['contacts', 'deals', 'companies'],
            description: 'CRM entity type to query',
          },
          startDate: { type: 'string', description: 'Filter by creation date start (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'Filter by creation date end (YYYY-MM-DD)' },
          properties: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific HubSpot properties to return. Contacts: email, firstname, lastname, jobtitle, lifecyclestage, hs_lead_status. Deals: dealname, amount, dealstage, pipeline, closedate. Companies: name, domain, industry, lifecyclestage, annualrevenue.',
          },
          filters: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                propertyName: { type: 'string' },
                operator: { type: 'string', enum: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN'] },
                value: { type: 'string' },
              },
              required: ['propertyName', 'operator', 'value'],
            },
            description: 'Additional HubSpot property filters (e.g., lifecyclestage=marketingqualifiedlead for MQLs)',
          },
          limit: { type: 'number', description: 'Max rows (default 25, max 100)' },
          query: { type: 'string', description: 'Free-text search query to filter results' },
        },
        required: ['entity'],
        additionalProperties: false,
      },
    },
  },
];

/**
 * Execute an analytics tool call by invoking the analytics-query edge function
 */
async function executeAnalyticsTool(toolName: string, params: any): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/analytics-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ tool: toolName, params }),
    });

    const result = await response.json();
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return JSON.stringify({ error: `Tool execution failed: ${e instanceof Error ? e.message : String(e)}` });
  }
}

async function handleGatewayRequest(
  model: string,
  messages: any[],
  systemPrompt: string,
  reasoning: string | undefined,
  enableTools = false,
): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const selectedModel = ALLOWED_GATEWAY_MODELS.includes(model) ? model : 'google/gemini-3-flash-preview';
  const ALLOWED_REASONING = ['low', 'medium', 'high', 'xhigh'];
  const selectedReasoning = reasoning && ALLOWED_REASONING.includes(reasoning) ? reasoning : undefined;

  const buildRequestBody = (msgs: any[], includeTools: boolean): any => {
    const body: any = {
      model: selectedModel,
      max_tokens: 65536,
      messages: [
        { role: 'system', content: systemPrompt },
        ...msgs,
      ],
      stream: true,
    };
    if (selectedReasoning) {
      body.reasoning = { effort: selectedReasoning };
    }
    if (includeTools) {
      body.tools = ANALYTICS_TOOLS;
    }
    return body;
  };

  // First request — with tools if enabled
  let response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRequestBody(messages, enableTools)),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment and try again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (response.status === 402) {
      return new Response(
        JSON.stringify({ error: 'AI credits exhausted. Please add funds in Settings → Workspace → Usage.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const errText = await response.text();
    console.error('AI gateway error:', response.status, errText);
    return new Response(
      JSON.stringify({ error: `AI gateway error (${response.status})` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // If tools are enabled, we need to check for tool calls (non-streaming first pass)
  if (enableTools) {
    // Do a non-streaming request to check for tool calls
    const nonStreamBody = buildRequestBody(messages, true);
    nonStreamBody.stream = false;

    const checkResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nonStreamBody),
    });

    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      const choice = checkData.choices?.[0];

      if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls?.length > 0) {
        console.log(`[knowledge-chat] Tool calls detected: ${choice.message.tool_calls.map((tc: any) => tc.function.name).join(', ')}`);

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          choice.message.tool_calls.map(async (tc: any) => {
            const args = JSON.parse(tc.function.arguments);
            console.log(`[knowledge-chat] Executing tool: ${tc.function.name}`, JSON.stringify(args));
            const result = await executeAnalyticsTool(tc.function.name, args);
            return {
              role: 'tool' as const,
              tool_call_id: tc.id,
              content: result,
            };
          })
        );

        // Build final messages with tool results, stream the final response
        const finalMessages = [
          ...messages,
          choice.message, // assistant message with tool_calls
          ...toolResults,
        ];

        const finalResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildRequestBody(finalMessages, false)),
        });

        if (!finalResponse.ok) {
          const errText = await finalResponse.text();
          console.error('AI gateway final response error:', finalResponse.status, errText);
          return new Response(
            JSON.stringify({ error: `AI gateway error (${finalResponse.status})` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(finalResponse.body, {
          headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
        });
      }

      // No tool calls — re-do as streaming
      // (We already have the non-streaming response, convert it to SSE format)
      const content = choice?.message?.content || '';
      const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content }, index: 0 }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseChunk, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    }
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
}

async function handlePerplexityRequest(
  perplexityModelId: string,
  messages: any[],
  systemPrompt: string,
): Promise<Response> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Perplexity API key is not configured. Please add PERPLEXITY_API_KEY in settings.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const pplxModel = PERPLEXITY_MODELS[perplexityModelId] || 'sonar';

  // Perplexity uses OpenAI-compatible format but text-only
  const textMessages = messages.map((msg: any) => ({
    role: msg.role,
    content: typeof msg.content === 'string' ? msg.content : 
      (Array.isArray(msg.content) ? msg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n') : ''),
  }));

  // Perplexity requires strict alternating user/assistant messages after system.
  // Merge consecutive same-role messages to satisfy this constraint.
  const merged: { role: string; content: string }[] = [];
  for (const msg of textMessages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += '\n\n' + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }

  // Ensure first message is user (Perplexity requires user after system)
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: 'Hello' });
  }

  // Ensure strict alternation by inserting placeholder messages where needed
  const strictMerged: { role: string; content: string }[] = [];
  for (const msg of merged) {
    if (strictMerged.length > 0 && strictMerged[strictMerged.length - 1].role === msg.role) {
      // Insert a placeholder of the opposite role
      const filler = msg.role === 'user' ? 'assistant' : 'user';
      strictMerged.push({ role: filler, content: '(continued)' });
    }
    strictMerged.push(msg);
  }

  console.log(`[knowledge-chat] Perplexity request: model=${pplxModel}`);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: pplxModel,
      max_tokens: 16384,
      messages: [
        { role: 'system', content: systemPrompt },
        ...strictMerged,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Perplexity API error:', response.status, errText);
    let errorMsg = `Perplexity API error (${response.status})`;
    try {
      const errJson = JSON.parse(errText);
      errorMsg = errJson.error?.message || errorMsg;
    } catch { /* use default */ }
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Perplexity uses OpenAI-compatible SSE format, pass through directly
  return new Response(response.body, {
    headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, crawlContext, documents, model, reasoning, session_id, sources, rag_depth, tonePreset, characteristics, customInstructions, aboutMe, personalBio, myRole, locationData } = await req.json();
    const useDocuments = sources?.documents !== false; // default true
    const useWeb = sources?.web === true; // default false
    const useAnalytics = sources?.analytics !== false; // default true
    const ragMatchCount = Math.min(Math.max(rag_depth?.match_count ?? 25, 5), 100);
    const ragMatchThreshold = Math.min(Math.max(rag_depth?.match_threshold ?? 0.25, 0.05), 0.8);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the latest user message text for RAG query
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const queryText = lastUserMsg
      ? (typeof lastUserMsg.content === 'string'
          ? lastUserMsg.content
          : Array.isArray(lastUserMsg.content)
            ? lastUserMsg.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ')
            : '')
      : '';

    // Build context based on selected sources
    let ragContext = '';
    let needsScreenshots = false;
    let ragDocuments: { name: string; source_type: string }[] = [];
    let webContext = '';
    let webCitations: string[] = [];

    // Run document RAG (with routing) and web search in parallel
    const contextPromises: Promise<void>[] = [];

    if (useDocuments && session_id && queryText) {
      contextPromises.push(ragSearchWithRouting(session_id, queryText, ragMatchCount, ragMatchThreshold).then(r => {
        ragContext = r.ragContext;
        needsScreenshots = r.needs_screenshots;
        ragDocuments = r.ragDocuments;
      }));
    }
    if (useWeb && queryText) {
      contextPromises.push(webSearchWithCitations(queryText).then(r => { webContext = r.context; webCitations = r.citations; }));
    }

    await Promise.all(contextPromises);

    // Fetch screenshots if the router says visual context would help
    // Skip for Perplexity (text-only)
    const isClaudeModel = model && model.startsWith('claude-');
    const isPerplexityModel = model && model.startsWith('perplexity-');
    let screenshotImages: { url: string; screenshot_url: string }[] = [];
    if (needsScreenshots && session_id && !isPerplexityModel) {
      screenshotImages = await fetchScreenshots(session_id, queryText);
      console.log(`[knowledge-chat] Injecting ${screenshotImages.length} screenshots as multimodal content`);
    }

    const legacyContext = useDocuments ? buildContextBlock(crawlContext, documents) : '';

    // Combine all context sources
    let combinedContext = '';
    if (ragContext) {
      combinedContext = ragContext;
    }
    if (webContext) {
      combinedContext += (combinedContext ? '\n\n' : '') + webContext;
    }
    // Add truncated legacy context as supplementary background
    if (legacyContext) {
      const remainingBudget = 300_000 - combinedContext.length;
      if (remainingBudget > 10000) {
        combinedContext += '\n\n--- FULL AUDIT DATA (supplementary) ---\n\n' +
          (legacyContext.length > remainingBudget
            ? legacyContext.slice(0, remainingBudget) + '\n\n[… truncated]'
            : legacyContext);
      }
    }

    const systemPrompt = buildSystemPrompt(combinedContext, tonePreset, characteristics, customInstructions, aboutMe, personalBio, myRole, locationData);
    const provider = isClaudeModel ? 'Anthropic' : isPerplexityModel ? 'Perplexity' : 'Gateway';

    // Inject screenshot images into the messages if available
    let augmentedMessages = messages;
    if (screenshotImages.length > 0) {
      // Build a multimodal "screenshots context" message injected before the last user message
      const imageContentParts: any[] = [
        { type: 'text', text: `Here are ${screenshotImages.length} screenshot(s) of the website pages for visual reference:` },
      ];
      for (const ss of screenshotImages) {
        imageContentParts.push({
          type: 'text',
          text: `Page: ${ss.url}`,
        });
        imageContentParts.push({
          type: 'image_url',
          image_url: { url: ss.screenshot_url },
        });
      }

      // Insert as a user message right before the last user message
      augmentedMessages = [...messages];
      const lastUserIdx = augmentedMessages.map((m: any) => m.role).lastIndexOf('user');
      if (lastUserIdx >= 0) {
        augmentedMessages.splice(lastUserIdx, 0, {
          role: 'user',
          content: imageContentParts,
        });
      }
    }

    console.log(`[knowledge-chat] Provider: ${provider}, Model: ${model || 'default'}, Sources: docs=${useDocuments} web=${useWeb} analytics=${useAnalytics}, RAG: ${ragContext ? ragContext.length + ' chars' : 'none'}, Web: ${webContext ? webContext.length + ' chars' : 'none'}, Screenshots: ${screenshotImages.length}, Messages: ${augmentedMessages.length}`);

    // Build metadata events to send before the AI stream
    const metadataEvents: string[] = [];
    if (webCitations.length > 0) {
      metadataEvents.push(`data: ${JSON.stringify({ web_citations: webCitations })}\n\n`);
    }
    // Add screenshots to ragDocuments so they appear in references
    if (screenshotImages.length > 0) {
      for (const ss of screenshotImages) {
        ragDocuments.push({ name: `Screenshot: ${ss.url}`, source_type: 'screenshot' });
      }
    }
    if (ragDocuments.length > 0) {
      metadataEvents.push(`data: ${JSON.stringify({ rag_documents: ragDocuments })}\n\n`);
    }

    // Helper to prepend metadata events to a streaming response
    const prependMetadata = (aiResponse: Response): Response => {
      if (metadataEvents.length === 0 || !aiResponse.body) return aiResponse;
      const encoder = new TextEncoder();
      const metadataChunks = metadataEvents.map(e => encoder.encode(e));
      const transformed = new ReadableStream({
        async start(controller) {
          for (const chunk of metadataChunks) {
            controller.enqueue(chunk);
          }
          const reader = aiResponse.body!.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            controller.close();
          }
        },
      });
      return new Response(transformed, {
        headers: aiResponse.headers,
      });
    };

    if (isClaudeModel) {
      return prependMetadata(await handleClaudeRequest(model, augmentedMessages, systemPrompt, reasoning));
    } else if (isPerplexityModel) {
      return prependMetadata(await handlePerplexityRequest(model, augmentedMessages, systemPrompt));
    } else {
      return prependMetadata(await handleGatewayRequest(model || 'google/gemini-3-flash-preview', augmentedMessages, systemPrompt, reasoning, useAnalytics));
    }
  } catch (e) {
    console.error('knowledge-chat error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
