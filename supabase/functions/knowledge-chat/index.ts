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

function buildSystemPrompt(contextBlock: string): string {
  return `You are an expert website analyst and digital strategist with deep knowledge of SEO, performance optimization, security, accessibility, and marketing technology.

You have access to comprehensive audit data from multiple integration tools. When answering questions:

1. **Cite your sources**: Always reference the specific integration by name (e.g., "According to the SEMrush Domain Analysis…", "The WAVE Accessibility scan found…", "Based on the PageSpeed Insights data…").
2. **Stay grounded in the data**: Base your answers on the actual data provided. Don't fabricate metrics or findings.
3. **Be specific**: Quote actual numbers, scores, grades, and findings from the data.
4. **Be consultative**: Provide actionable recommendations when appropriate.
5. **Cross-reference**: When multiple integrations provide related data, connect the dots to give a holistic picture.
6. **File attachments**: When users attach files or images, analyze them in the context of the website audit. For images/screenshots, describe what you see and relate it to audit findings.

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
 * Perform RAG search: embed the user query, find relevant chunks via pgvector
 */
async function ragSearch(sessionId: string, query: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.warn('[knowledge-chat] GEMINI_API_KEY not set, skipping RAG search');
    return '';
  }

  try {
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
      console.error('[knowledge-chat] RAG embedding error:', await embResponse.text());
      return '';
    }

    const embData = await embResponse.json();
    const queryEmbedding = embData.embedding?.values;
    if (!queryEmbedding) return '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: matches, error } = await supabase.rpc('match_knowledge_chunks', {
      p_session_id: sessionId,
      p_embedding: `[${queryEmbedding.join(',')}]`,
      p_match_count: 25,
      p_match_threshold: 0.25,
    });

    if (error || !matches || matches.length === 0) {
      if (error) console.error('[knowledge-chat] RAG search error:', error);
      return '';
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

    console.log(`[knowledge-chat] RAG retrieved ${matches.length} chunks from ${docChunks.size} documents`);
    return ragContext;
  } catch (e) {
    console.error('[knowledge-chat] RAG search failed:', e);
    return '';
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

  // Build Anthropic request — respect per-model max output limits
  const responseTokens = 8192;
  const requestBody: any = {
    model: claudeConfig.model,
    max_tokens: Math.min(responseTokens, claudeConfig.maxOutput),
    system: systemPrompt,
    messages: anthropicMessages,
    stream: true,
  };

  // Add extended thinking if reasoning is requested
  if (reasoning === 'high') {
    const budget = Math.min(CLAUDE_THINKING_BUDGET, claudeConfig.maxOutput - responseTokens);
    if (budget > 0) {
      requestBody.thinking = {
        type: 'enabled',
        budget_tokens: budget,
      };
      requestBody.max_tokens = Math.min(budget + responseTokens, claudeConfig.maxOutput);
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

async function handleGatewayRequest(
  model: string,
  messages: any[],
  systemPrompt: string,
  reasoning: string | undefined,
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

  const requestBody: any = {
    model: selectedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream: true,
  };

  if (selectedReasoning) {
    requestBody.reasoning = { effort: selectedReasoning };
  }

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
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

  console.log(`[knowledge-chat] Perplexity request: model=${pplxModel}`);

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: pplxModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...merged,
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
    const { messages, crawlContext, documents, model, reasoning, session_id, sources } = await req.json();
    const useDocuments = sources?.documents !== false; // default true
    const useWeb = sources?.web === true; // default false

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
    let webContext = '';
    let webCitations: string[] = [];

    // Run document RAG and web search in parallel
    const contextPromises: Promise<void>[] = [];

    if (useDocuments && session_id && queryText) {
      contextPromises.push(ragSearch(session_id, queryText).then(r => { ragContext = r; }));
    }
    if (useWeb && queryText) {
      contextPromises.push(webSearchWithCitations(queryText).then(r => { webContext = r.context; webCitations = r.citations; }));
    }

    await Promise.all(contextPromises);

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

    const systemPrompt = buildSystemPrompt(combinedContext);
    const isClaudeModel = model && model.startsWith('claude-');
    const isPerplexityModel = model && model.startsWith('perplexity-');
    const provider = isClaudeModel ? 'Anthropic' : isPerplexityModel ? 'Perplexity' : 'Gateway';

    console.log(`[knowledge-chat] Provider: ${provider}, Model: ${model || 'default'}, Sources: docs=${useDocuments} web=${useWeb}, RAG: ${ragContext ? ragContext.length + ' chars' : 'none'}, Web: ${webContext ? webContext.length + ' chars' : 'none'}, Messages: ${messages.length}`);

    // Build citation metadata event to send before the AI stream
    let citationsEvent = '';
    if (webCitations.length > 0) {
      citationsEvent = `data: ${JSON.stringify({ web_citations: webCitations })}\n\n`;
    }

    // Helper to prepend citations event to a streaming response
    const prependCitations = (aiResponse: Response): Response => {
      if (!citationsEvent || !aiResponse.body) return aiResponse;
      const encoder = new TextEncoder();
      const citationsChunk = encoder.encode(citationsEvent);
      const transformed = new ReadableStream({
        async start(controller) {
          controller.enqueue(citationsChunk);
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
      return prependCitations(await handleClaudeRequest(model, messages, systemPrompt, reasoning));
    } else if (isPerplexityModel) {
      return prependCitations(await handlePerplexityRequest(model, messages, systemPrompt));
    } else {
      return prependCitations(await handleGatewayRequest(model || 'google/gemini-3-flash-preview', messages, systemPrompt, reasoning));
    }
  } catch (e) {
    console.error('knowledge-chat error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
