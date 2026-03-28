import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Models used for council
const COUNCIL_MODELS = {
  gemini: { id: 'google/gemini-3.1-pro-preview', name: 'Gemini', provider: 'gateway' as const },
  gpt: { id: 'openai/gpt-5', name: 'GPT', provider: 'gateway' as const },
  claude: { id: 'claude-sonnet', name: 'Claude', provider: 'anthropic' as const },
};

type CouncilModelKey = keyof typeof COUNCIL_MODELS;

const CLAUDE_MODELS: Record<string, { model: string; maxOutput: number }> = {
  'claude-haiku': { model: 'claude-haiku-4-5-20251001', maxOutput: 64000 },
  'claude-sonnet': { model: 'claude-sonnet-4-6', maxOutput: 64000 },
  'claude-opus': { model: 'claude-opus-4-6', maxOutput: 128000 },
};

// ─── Non-streaming model calls ───

async function callGateway(apiKey: string, model: string, systemPrompt: string, userContent: string): Promise<string> {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      stream: false,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Gateway ${model} error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey: string, modelId: string, systemPrompt: string, userContent: string): Promise<string> {
  const cm = CLAUDE_MODELS[modelId] || { model: modelId, maxOutput: 64000 };
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
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Anthropic ${cm.model} error ${resp.status}: ${t}`);
  }
  const data = await resp.json();
  return data.content?.[0]?.text || '';
}

async function callModel(modelKey: CouncilModelKey, systemPrompt: string, userContent: string): Promise<string> {
  const m = COUNCIL_MODELS[modelKey];
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  
  if (m.provider === 'anthropic') {
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
    return callAnthropic(ANTHROPIC_KEY, m.id, systemPrompt, userContent);
  }
  return callGateway(LOVABLE_API_KEY, m.id, systemPrompt, userContent);
}

// ─── Prompts ───

const CONVERGENCE_SYSTEM = `You are participating in a Model Council — a collaborative exercise where multiple AI models independently answer a question, then refine toward the best possible answer. Give your best, most thoughtful response. Be specific and take clear positions.`;

const CONVERGENCE_ROUND2_ADDITION = `\n\nYou can now see how other models responded. Defend your unique contributions, challenge where you disagree, and acknowledge where others improved on your thinking. Be specific.`;

const SYNTHESIS_SYSTEM = `You are synthesizing the results of a Model Council session where multiple AI models discussed a topic. Create a comprehensive final answer that:
1. States the best answer/recommendation clearly
2. Notes the strongest unique contributions from each model
3. Highlights any meaningful disagreements that remained
4. Provides a confidence assessment

Format with clear markdown headers. Be thorough but concise.`;

const DEBATE_PRO_SYSTEM = `You are participating in a Model Council Debate. You have been assigned the PRO side. Argue IN FAVOR of the proposition. Present your strongest arguments with evidence and reasoning.`;

const DEBATE_CON_SYSTEM = `You are participating in a Model Council Debate. You have been assigned the CON side. Argue AGAINST the proposition. Present your strongest counterarguments with evidence and reasoning.`;

const DEBATE_REBUTTAL = `\n\nNow review your opponent's argument. Directly address their points. Defend your position where you're right. Concede where they made strong points, but explain why your overall position is stronger.`;

const JUDGE_SYSTEM = `You are the impartial judge of a Model Council Debate. Review the full debate transcript. Provide a fair judgment that:
1. Declares which side presented the stronger overall argument and why
2. Highlights the most compelling points from each side
3. Notes weak arguments or logical fallacies
4. Provides your own balanced assessment
5. Gives a final verdict with confidence level

Format with clear headers.`;

// ─── Convergence mode ───

async function runConvergence(prompt: string, contextBlock: string, customInstructions?: string): Promise<{ synthesis: string; rounds: any[]; models: string[] }> {
  const keys: CouncilModelKey[] = ['gemini', 'gpt', 'claude'];
  const rounds: any[] = [];

  // Round 1: Independent responses
  let system = CONVERGENCE_SYSTEM;
  if (customInstructions?.trim()) system += `\n\n--- User's Custom Instructions ---\n${customInstructions}`;
  
  let userContent = contextBlock ? `${prompt}\n\n--- Context ---\n${contextBlock}` : prompt;
  
  const r1Responses = await Promise.allSettled(
    keys.map(k => callModel(k, system, userContent))
  );
  
  const round1: Record<string, string> = {};
  keys.forEach((k, i) => {
    const r = r1Responses[i];
    round1[k] = r.status === 'fulfilled' ? r.value : `[Error: ${(r as PromiseRejectedResult).reason?.message || 'failed'}]`;
  });
  rounds.push({ round: 1, label: 'Initial Response', responses: round1 });

  // Round 2: Cross-pollination
  const r2System = CONVERGENCE_SYSTEM + CONVERGENCE_ROUND2_ADDITION;
  if (customInstructions?.trim()) system += `\n\n--- User's Custom Instructions ---\n${customInstructions}`;
  
  const r2Responses = await Promise.allSettled(
    keys.map(k => {
      const otherResponses = keys.filter(ok => ok !== k).map(ok => 
        `**${COUNCIL_MODELS[ok].name}:**\n${round1[ok]}`
      ).join('\n\n');
      const r2Content = `${userContent}\n\n--- Your previous response ---\n${round1[k]}\n\n--- Other models' responses ---\n${otherResponses}`;
      return callModel(k, r2System, r2Content);
    })
  );
  
  const round2: Record<string, string> = {};
  keys.forEach((k, i) => {
    const r = r2Responses[i];
    round2[k] = r.status === 'fulfilled' ? r.value : round1[k]; // fallback to round 1
  });
  rounds.push({ round: 2, label: 'Cross-Pollination', responses: round2 });

  // Synthesis
  const synthesisContent = keys.map(k => 
    `## ${COUNCIL_MODELS[k].name}\n\n### Round 1\n${round1[k]}\n\n### Round 2\n${round2[k]}`
  ).join('\n\n---\n\n');
  
  const synthesis = await callModel('gemini', SYNTHESIS_SYSTEM, `Original prompt: ${prompt}\n\n${synthesisContent}`);

  return { synthesis, rounds, models: keys.map(k => COUNCIL_MODELS[k].name) };
}

// ─── Debate mode ───

async function runDebate(prompt: string, contextBlock: string, customInstructions?: string): Promise<{ synthesis: string; rounds: any[]; models: string[] }> {
  const proModel: CouncilModelKey = 'claude';
  const conModel: CouncilModelKey = 'gpt';
  const judgeModel: CouncilModelKey = 'gemini';
  const rounds: any[] = [];

  let proSystem = DEBATE_PRO_SYSTEM;
  let conSystem = DEBATE_CON_SYSTEM;
  if (customInstructions?.trim()) {
    proSystem += `\n\n--- User's Custom Instructions ---\n${customInstructions}`;
    conSystem += `\n\n--- User's Custom Instructions ---\n${customInstructions}`;
  }

  const userContent = contextBlock ? `${prompt}\n\n--- Context ---\n${contextBlock}` : prompt;

  // Round 1: Opening arguments
  const [proR1, conR1] = await Promise.allSettled([
    callModel(proModel, proSystem, userContent),
    callModel(conModel, conSystem, userContent),
  ]);
  const pro1 = proR1.status === 'fulfilled' ? proR1.value : '[Error]';
  const con1 = conR1.status === 'fulfilled' ? conR1.value : '[Error]';
  rounds.push({ round: 1, label: 'Opening Arguments', responses: { [proModel]: pro1, [conModel]: con1 }, sides: { pro: proModel, con: conModel } });

  // Round 2: Rebuttals
  const proRebuttalSystem = DEBATE_PRO_SYSTEM + DEBATE_REBUTTAL;
  const conRebuttalSystem = DEBATE_CON_SYSTEM + DEBATE_REBUTTAL;
  
  const [proR2, conR2] = await Promise.allSettled([
    callModel(proModel, proRebuttalSystem, `${userContent}\n\n--- Your opening argument ---\n${pro1}\n\n--- Opponent's argument ---\n${con1}`),
    callModel(conModel, conRebuttalSystem, `${userContent}\n\n--- Your opening argument ---\n${con1}\n\n--- Opponent's argument ---\n${pro1}`),
  ]);
  const pro2 = proR2.status === 'fulfilled' ? proR2.value : pro1;
  const con2 = conR2.status === 'fulfilled' ? conR2.value : con1;
  rounds.push({ round: 2, label: 'Rebuttals', responses: { [proModel]: pro2, [conModel]: con2 }, sides: { pro: proModel, con: conModel } });

  // Judge verdict
  const transcript = `## PRO (${COUNCIL_MODELS[proModel].name})\n\n### Opening\n${pro1}\n\n### Rebuttal\n${pro2}\n\n---\n\n## CON (${COUNCIL_MODELS[conModel].name})\n\n### Opening\n${con1}\n\n### Rebuttal\n${con2}`;
  const synthesis = await callModel(judgeModel, JUDGE_SYSTEM, `Debate topic: ${prompt}\n\n${transcript}`);

  return { 
    synthesis, 
    rounds, 
    models: [
      `${COUNCIL_MODELS[proModel].name} (PRO)`, 
      `${COUNCIL_MODELS[conModel].name} (CON)`, 
      `${COUNCIL_MODELS[judgeModel].name} (Judge)`
    ] 
  };
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const { mode, messages, crawlContext, customInstructions } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user prompt from last user message
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const prompt = typeof lastUserMsg?.content === 'string' 
      ? lastUserMsg.content 
      : lastUserMsg?.content?.map((p: any) => p.text || '').join(' ') || '';

    const contextBlock = crawlContext || '';
    const councilMode = mode === 'council-debate' ? 'debate' : 'convergence';

    let result;
    if (councilMode === 'debate') {
      result = await runDebate(prompt, contextBlock, customInstructions);
    } else {
      result = await runConvergence(prompt, contextBlock, customInstructions);
    }

    return new Response(JSON.stringify({
      success: true,
      mode: councilMode,
      synthesis: result.synthesis,
      rounds: result.rounds,
      models: result.models,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('council-chat error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';

    // Surface rate limit / payment errors
    if (msg.includes('429')) {
      return new Response(JSON.stringify({ error: 'Rate limited — please try again shortly.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (msg.includes('402')) {
      return new Response(JSON.stringify({ error: 'Credits exhausted — please add funds.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
