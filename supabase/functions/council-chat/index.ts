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
  'openai/gpt-5-nano': 'GPT-5 Nano',
  'openai/gpt-5.2': 'GPT-5.2',
  'claude-haiku': 'Claude Haiku',
  'claude-sonnet': 'Claude Sonnet',
  'claude-opus': 'Claude Opus',
  'perplexity-sonar': 'Perplexity Sonar',
  'perplexity-sonar-pro': 'Perplexity Sonar Pro',
  'perplexity-sonar-reasoning-pro': 'Perplexity Reasoning Pro',
};

const CLAUDE_MODELS: Record<string, { model: string; maxOutput: number }> = {
  'claude-haiku': { model: 'claude-haiku-4-5-20251001', maxOutput: 8192 },
  'claude-sonnet': { model: 'claude-sonnet-4-6', maxOutput: 16000 },
  'claude-opus': { model: 'claude-opus-4-6', maxOutput: 16000 },
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

const SYNTHESIS_SYSTEM = `You are synthesizing responses from 3 different AI models who independently answered the same question. You will receive their model names. Use those exact names as column headers.

Produce a structured analysis using these exact markdown sections:

## 🤝 Where the Models Agreed

Present as a markdown table with these columns:
| Finding | [Model1] | [Model2] | [Model3] | Evidence |

For each agreed-upon point, put ✓ under each model that mentioned it. In the Evidence column, provide a brief supporting detail.

## ⚡ Where They Disagreed

Present as a markdown table:
| Topic | [Model1] | [Model2] | [Model3] |

For each disagreement, summarize each model's position in its column. Use "—" if a model didn't address the topic.

## 💡 Unique Contributions

Call out the most valuable insight from each model that the others missed. Use the model's name as attribution.

## 🎯 Synthesis

Provide your unified, best-possible answer combining the strongest elements. Be actionable and definitive.

Rules:
- Use the actual model names provided as table column headers
- Be specific and substantive — no generic filler
- If no real disagreements exist, say so briefly
- Keep table cells concise (1-2 sentences max)
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

    const { messages, crawlContext, customInstructions, councilModels: customModels, synthesisModel: customSynthesis } = await req.json();

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

          // Phase 2: Synthesize with configurable model
          send('synthesis_start', {});
          const synthesisInput = results.map(r =>
            `## ${r.name}\n\n${r.response}`
          ).join('\n\n---\n\n');
          const synthUserContent = `Original question: ${prompt}\n\nThe 3 model names are: ${results.map(r => r.name).join(', ')}\n\n--- Model Responses ---\n\n${synthesisInput}`;

          // Determine synthesis model config
          const synthModelId = customSynthesis?.modelId || 'claude-opus';
          const synthIsAnthropic = synthModelId.startsWith('claude-');
          const synthReasoning = customSynthesis?.reasoning || 'high';

          if (synthIsAnthropic) {
            // Anthropic synthesis with optional thinking
            const cm = CLAUDE_MODELS[synthModelId] || { model: synthModelId, maxOutput: 16000 };
            const synthBody: Record<string, unknown> = {
              model: cm.model,
              max_tokens: cm.maxOutput,
              stream: true,
              system: SYNTHESIS_SYSTEM,
              messages: [{ role: 'user', content: synthUserContent }],
            };
            if (synthReasoning !== 'none') {
              const budgetMap: Record<string, number> = { low: 3000, medium: 6000, high: 10000 };
              synthBody.thinking = { type: 'enabled', budget_tokens: budgetMap[synthReasoning] || 10000 };
            }

            const synthResp = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify(synthBody),
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
                    const event = JSON.parse(payload);
                    if (event.type === 'content_block_delta') {
                      if (event.delta?.type === 'thinking_delta' && event.delta?.thinking) {
                        send('synthesis_thinking', { text: event.delta.thinking });
                      } else if (event.delta?.text) {
                        send('synthesis_chunk', { text: event.delta.text });
                      }
                    }
                  } catch {}
                }
              }
            }
          } else {
            // Gateway synthesis (Gemini/GPT)
            const isOpenAI = synthModelId.startsWith('openai/');
            const synthGatewayBody: Record<string, unknown> = {
              model: synthModelId,
              messages: [
                { role: 'system', content: SYNTHESIS_SYSTEM },
                { role: 'user', content: synthUserContent },
              ],
              stream: true,
            };
            if (isOpenAI) {
              synthGatewayBody.max_completion_tokens = 8192;
            } else {
              synthGatewayBody.max_tokens = 8192;
            }
            if (synthReasoning !== 'none') {
              synthGatewayBody.reasoning = { effort: synthReasoning };
            }

            const synthResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(synthGatewayBody),
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
