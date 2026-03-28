import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const COUNCIL_MODELS = [
  { key: 'gemini', id: 'google/gemini-2.5-flash', name: 'Gemini Flash', provider: 'gateway' as const },
  { key: 'gpt', id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'gateway' as const },
  { key: 'claude', id: 'claude-haiku', name: 'Claude Haiku', provider: 'anthropic' as const },
];

const CLAUDE_MODELS: Record<string, { model: string; maxOutput: number }> = {
  'claude-haiku': { model: 'claude-haiku-4-5-20251001', maxOutput: 8192 },
  'claude-sonnet': { model: 'claude-sonnet-4-6', maxOutput: 16000 },
};

// ─── Model calls (non-streaming) ───

async function callGateway(apiKey: string, model: string, systemPrompt: string, userContent: string, signal?: AbortSignal): Promise<string> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: false,
      max_tokens: 2048,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gateway ${model} error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey: string, modelId: string, systemPrompt: string, userContent: string, signal?: AbortSignal): Promise<string> {
  const cm = CLAUDE_MODELS[modelId] || { model: modelId, maxOutput: 8192 };
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    signal,
    body: JSON.stringify({
      model: cm.model,
      max_tokens: cm.maxOutput,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${cm.model} error ${resp.status}: ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

// ─── Prompts ───

const COUNCIL_SYSTEM = `You are one of 3 AI models in a Model Council. Give your best, most thoughtful and specific response to the user's question. Be concise but substantive — aim for 300-500 words. Take clear positions and provide actionable recommendations.`;

const SYNTHESIS_SYSTEM = `You are synthesizing responses from 3 different AI models who independently answered the same question. Create a unified, comprehensive answer that:

1. Leads with the strongest consensus answer
2. Incorporates unique insights from each model
3. Notes any meaningful disagreements
4. Is well-structured with markdown formatting

Do NOT mention "Model 1/2/3" or reference the council process. Just deliver the best possible answer as if you're a single expert. Be thorough but concise.`;

// ─── SSE helpers ───

function sseEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Main handler with SSE streaming ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

    const { messages, crawlContext, customInstructions } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const prompt = typeof lastUserMsg?.content === 'string'
      ? lastUserMsg.content
      : lastUserMsg?.content?.map((p: any) => p.text || '').join(' ') || '';

    const contextBlock = crawlContext || '';
    let system = COUNCIL_SYSTEM;
    if (customInstructions?.trim()) system += `\n\n--- User Instructions ---\n${customInstructions}`;
    const userContent = contextBlock ? `${prompt}\n\n--- Context ---\n${contextBlock}` : prompt;

    // Stream SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        };

        try {
          // Phase 1: Run all 3 models in parallel
          const modelPromises = COUNCIL_MODELS.map(async (m) => {
            send('model_start', { key: m.key, name: m.name });
            try {
              let result: string;
              if (m.provider === 'anthropic') {
                result = await callAnthropic(ANTHROPIC_KEY, m.id, system, userContent);
              } else {
                result = await callGateway(LOVABLE_API_KEY!, m.id, system, userContent);
              }
              send('model_done', { key: m.key, name: m.name, response: result });
              return { key: m.key, name: m.name, response: result };
            } catch (e) {
              const err = e instanceof Error ? e.message : 'failed';
              send('model_error', { key: m.key, name: m.name, error: err });
              return { key: m.key, name: m.name, response: `[Error: ${err}]` };
            }
          });

          const results = await Promise.all(modelPromises);

          // Phase 2: Synthesize
          send('synthesis_start', {});
          const synthesisInput = results.map(r =>
            `## ${r.name}\n\n${r.response}`
          ).join('\n\n---\n\n');

          // Stream synthesis via gateway
          const synthResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: SYNTHESIS_SYSTEM },
                { role: 'user', content: `Original question: ${prompt}\n\n--- Model Responses ---\n\n${synthesisInput}` },
              ],
              stream: true,
            }),
          });

          if (!synthResp.ok) {
            const errText = await synthResp.text();
            send('error', { message: `Synthesis error: ${errText.slice(0, 200)}` });
          } else {
            const reader = synthResp.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') continue;
                try {
                  const chunk = JSON.parse(payload);
                  const delta = chunk.choices?.[0]?.delta?.content;
                  if (delta) {
                    send('synthesis_chunk', { text: delta });
                  }
                } catch {}
              }
            }
          }

          send('done', { models: results.map(r => r.name) });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown error';
          send('error', { message: msg });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e) {
    console.error('council-chat error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
