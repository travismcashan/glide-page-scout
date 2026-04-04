import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CompanyInput = { id: string; name: string; domain?: string | null };
type MatchOutput = {
  company_id: string;
  candidate_id: string;
  confidence: "high" | "medium" | "low";
  reason?: string;
};

const BATCH_SIZE = 80;

async function matchBatch(
  apiKey: string,
  companies: CompanyInput[],
  candidates: CompanyInput[],
  source: string
): Promise<MatchOutput[]> {
  const companyList = companies
    .map((c) => `- ID: ${c.id} | Name: "${c.name}"${c.domain ? ` | Domain: ${c.domain}` : ""}`)
    .join("\n");

  const candidateList = candidates
    .map((c) => `- ID: ${c.id} | Name: "${c.name}"${c.domain ? ` | Domain: ${c.domain}` : ""}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: `You are a company name matching engine. You will receive two lists:
1. COMPANIES — internal company records
2. CANDIDATES — records from ${source}

Your job: find which candidates are the same real-world company as each internal company, despite different spellings, abbreviations, legal suffixes (Inc, LLC, Corp), word variations (e.g. "Homecare" vs "HealthCare"), acquired/merged names, or missing words.

Rules:
- Match by domain first if both have domains — exact domain match is always "high" confidence
- For name matching: consider abbreviations, legal suffixes, word reordering, partial names, and industry-specific synonyms
- Only return matches you're confident about. If unsure, don't include it.
- One company can match at most one candidate
- "high" = clearly the same company. "medium" = very likely but some ambiguity. "low" = plausible but uncertain.
- If a company has no plausible candidate match, omit it entirely.`,
      messages: [
        {
          role: "user",
          content: `COMPANIES:\n${companyList}\n\nCANDIDATES (from ${source}):\n${candidateList}`,
        },
      ],
      tools: [
        {
          name: "match_companies",
          description: "Return the matched company-candidate pairs.",
          input_schema: {
            type: "object",
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    company_id: { type: "string", description: "ID from the COMPANIES list" },
                    candidate_id: { type: "string", description: "ID from the CANDIDATES list" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    reason: { type: "string", description: "Brief explanation of why these match" },
                  },
                  required: ["company_id", "candidate_id", "confidence"],
                },
              },
            },
            required: ["matches"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "match_companies" },
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const text = await response.text();
    console.error(`[company-match-ai] Anthropic error ${status}:`, text);
    if (status === 429) throw new Error("Rate limit exceeded");
    throw new Error(`AI matching failed (${status})`);
  }

  const data = await response.json();
  const toolUse = data.content?.find((b: any) => b.type === "tool_use");
  if (!toolUse?.input?.matches) {
    console.error("[company-match-ai] No tool_use block in response");
    return [];
  }

  return toolUse.input.matches as MatchOutput[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { companies, candidates, source } = await req.json();

    if (!Array.isArray(companies) || !Array.isArray(candidates)) {
      return new Response(JSON.stringify({ error: "companies and candidates arrays required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (companies.length === 0 || candidates.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const sourceName = source || "external system";

    // Batch companies if needed (candidates always sent in full per batch)
    const allMatches: MatchOutput[] = [];

    if (companies.length <= BATCH_SIZE) {
      const matches = await matchBatch(ANTHROPIC_API_KEY, companies, candidates, sourceName);
      allMatches.push(...matches);
    } else {
      // Chunk companies, run batches in parallel
      const batches: CompanyInput[][] = [];
      for (let i = 0; i < companies.length; i += BATCH_SIZE) {
        batches.push(companies.slice(i, i + BATCH_SIZE));
      }

      console.log(`[company-match-ai] Processing ${batches.length} batches of ${BATCH_SIZE} companies`);

      const results = await Promise.all(
        batches.map((batch) => matchBatch(ANTHROPIC_API_KEY, batch, candidates, sourceName))
      );

      // Deduplicate: keep highest confidence per company_id
      const bestByCompany = new Map<string, MatchOutput>();
      const confRank = { high: 3, medium: 2, low: 1 };
      for (const batchResult of results) {
        for (const m of batchResult) {
          const existing = bestByCompany.get(m.company_id);
          if (!existing || confRank[m.confidence] > confRank[existing.confidence]) {
            bestByCompany.set(m.company_id, m);
          }
        }
      }
      allMatches.push(...bestByCompany.values());
    }

    console.log(`[company-match-ai] ${source}: ${allMatches.length} matches from ${companies.length} companies × ${candidates.length} candidates`);

    return new Response(JSON.stringify({ matches: allMatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[company-match-ai] error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
