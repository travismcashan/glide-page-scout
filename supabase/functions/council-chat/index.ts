import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_COUNCIL_MODELS = [
  { key: 'gemini', id: 'google/gemini-3-flash-preview', name: 'Gemini Flash 3.0', provider: 'gateway' as const },
  { key: 'claude', id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic' as const },
  { key: 'gpt', id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'gateway' as const },
];

// Model ID to display name map
const MODEL_NAMES: Record<string, string> = {
  'google/gemini-2.5-flash-lite': 'Gemini Flash Lite',
  'google/gemini-2.5-flash': 'Gemini Flash 2.5',
  'google/gemini-3-flash-preview': 'Gemini Flash 3.0',
  'google/gemini-2.5-pro': 'Gemini Pro 2.5',
  'google/gemini-3.1-pro-preview': 'Gemini Pro 3.1',
  'openai/gpt-5': 'GPT-5',
  'openai/gpt-5-mini': 'GPT-5 Mini',
  'openai/gpt-5.2': 'GPT-5.2',
  'claude-haiku': 'Claude Haiku',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
};

const CLAUDE_MODELS: Record<string, { model: string; maxOutput: number }> = {
  'claude-haiku': { model: 'claude-haiku-4-5-20251001', maxOutput: 8192 },
  'claude-sonnet': { model: 'claude-sonnet-4-6', maxOutput: 16000 },
};

// Stream a gateway model, emitting chunks via callback
async function streamGateway(
  apiKey: string, model: string, systemPrompt: string, userContent: string,
  onChunk: (text: string) => void
): Promise<string> {
  const isOpenAI = model.startsWith('openai/');
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    stream: true,
  };
  if (isOpenAI) {
    body.max_completion_tokens = 2048;
  } else {
    body.max_tokens = 2048;
  }

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gateway ${model} error ${resp.status}: ${t.slice(0, 200)}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

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
          fullText += delta;
          onChunk(delta);
        }
      } catch {}
    }
  }

  return fullText;
}

// Stream an Anthropic model, emitting chunks via callback
async function streamAnthropic(
  apiKey: string, modelId: string, systemPrompt: string, userContent: string,
  onChunk: (text: string) => void
): Promise<string> {
  const cm = CLAUDE_MODELS[modelId] || { model: modelId, maxOutput: 8192 };
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: cm.model,
      max_tokens: cm.maxOutput,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${cm.model} error ${resp.status}: ${t.slice(0, 200)}`);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

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
        const event = JSON.parse(payload);
        if (event.type === 'content_block_delta' && event.delta?.text) {
          fullText += event.delta.text;
          onChunk(event.delta.text);
        }
      } catch {}
    }
  }

  return fullText;
}

const COUNCIL_SYSTEM = `You are one of 3 AI models in a Model Council. Give your best, most thoughtful and specific response to the user's question. Be concise but substantive — aim for 300-500 words. Take clear positions and provide actionable recommendations.`;

const SYNTHESIS_SYSTEM = `You are synthesizing responses from 3 different AI models who independently answered the same question. Your job is to produce a structured analysis with these exact markdown sections:

## 🤝 Where the Models Agreed
Summarize the key points where all or most models converged. Be specific about what they agreed on.

## ⚡ Where They Disagreed
Highlight meaningful differences in perspective, recommendations, or conclusions. Explain the nature of each disagreement.

## 💡 Unique Contributions
Call out the most interesting or valuable insight from each model that the others missed. Attribute by model name.

## 🎯 Synthesis
Provide your unified, best-possible answer that combines the strongest elements from all models. This should be actionable and definitive.

Rules:
- Be specific and substantive in each section
- If there were no real disagreements, say so briefly and focus on the other sections
- Do NOT use generic filler — every point should be meaningful
- Write in a clear, professional tone`;

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

    const { messages, crawlContext, customInstructions, councilModels: customModels } = await req.json();

    // Build council models list from custom config or defaults
    const councilModelList = (Array.isArray(customModels) && customModels.length === 3)
      ? customModels.map((slot: { provider: string; modelId: string }, i: number) => {
          const isAnthropic = slot.modelId.startsWith('claude-');
          return {
            key: `model-${i}`,
            id: slot.modelId,
            name: MODEL_NAMES[slot.modelId] || slot.modelId,
            provider: isAnthropic ? 'anthropic' as const : 'gateway' as const,
          };
        })
      : DEFAULT_COUNCIL_MODELS;

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        };

        try {
          // Phase 1: Run all 3 models in parallel, streaming chunks to each
          const modelPromises = councilModelList.map(async (m) => {
            send('model_start', { key: m.key, name: m.name });
            try {
              const onChunk = (text: string) => {
                send('model_chunk', { key: m.key, text });
              };

              let result: string;
              if (m.provider === 'anthropic') {
                result = await streamAnthropic(ANTHROPIC_KEY, m.id, system, userContent, onChunk);
              } else {
                result = await streamGateway(LOVABLE_API_KEY!, m.id, system, userContent, onChunk);
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

          // Phase 2: Synthesize with structured prompt
          send('synthesis_start', {});
          const synthesisInput = results.map(r =>
            `## ${r.name}\n\n${r.response}`
          ).join('\n\n---\n\n');

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
