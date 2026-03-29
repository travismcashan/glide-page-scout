

# Make Harvest Chat "Just Work"

## Goal
Let the user ask natural questions about their Harvest data ("How much did we spend on the AllerVie project?", "Show me all archived projects") and get accurate answers — no API talk, no hallucinations, no empty responses.

## Changes

### 1. Strengthen the system prompt guardrails
**File:** `supabase/functions/knowledge-chat/index.ts`

Update the `CRITICAL RULE FOR LIVE DATA` section to be more aggressive:
- Explicitly tell the model: "The Harvest API documentation in this prompt describes how to CONSTRUCT requests — it does NOT contain actual project data. You MUST call the call_api tool for ANY question about real Harvest data."
- Add examples of common queries mapped to tool calls (e.g., "archived projects" → `call_api service=harvest path=/projects params={is_active: false}`)

### 2. Add multi-step tool calling (tool call loop)
**File:** `supabase/functions/knowledge-chat/index.ts`

The current architecture does exactly one round of tool calls. Change `handleGatewayRequest` to support up to 3 rounds:
- After executing tool calls and getting results, send the results back to the model WITH tools still enabled
- If the model makes another tool call (e.g., it got a project ID from step 1 and now wants details), execute that too
- Cap at 3 iterations to prevent runaway loops
- This enables queries like "What's the budget status of AllerVie?" which requires: (1) search projects for "AllerVie" → get ID, (2) GET /projects/{id} → get budget details, (3) GET /time_entries?project_id={id} → get actuals

### 3. Increase api-proxy truncation limits for chat consumption
**File:** `supabase/functions/api-proxy/index.ts`

- Increase `MAX_ARRAY_ITEMS` from 25 to 50 (the AI needs enough data to answer aggregate questions)
- Increase `MAX_RESPONSE_CHARS` from 100k to 200k (Harvest project lists are legitimately large)
- Keep `MAX_DEPTH` at 6 (sufficient for Harvest responses)

### 4. Add smart pagination hint in truncated responses  
**File:** `supabase/functions/api-proxy/index.ts`

When a response is truncated, include a `_next_page` hint with the parameters needed to fetch the next page, so the AI can make a follow-up call in the multi-step loop if needed.

## Technical Details

### Multi-step tool loop (the key change)
```text
User: "How much did we spend on AllerVie?"
  ↓
Pass 1 (planning): Model calls call_api(service=harvest, path=/projects, params={is_active:false, per_page:50})
  → Execute → Get list of projects → Find AllerVie ID = 12345
  ↓
Pass 2 (follow-up): Model sees results, calls call_api(service=harvest, path=/projects/12345)
  → Execute → Get budget = $36,600, fees = $39,847
  ↓
Pass 3 (synthesis): Model has all data, generates final answer with real numbers
  → Stream to user
```

The loop replaces the current single-pass architecture (lines 1176-1341) with a `while` loop that checks `finish_reason === 'tool_calls'` up to `MAX_TOOL_ROUNDS = 3` times.

### Files modified
- `supabase/functions/knowledge-chat/index.ts` — prompt hardening + multi-step tool loop
- `supabase/functions/api-proxy/index.ts` — relaxed truncation limits + pagination hints

### No UI changes needed
The chat interface already supports Harvest toggle and displays streamed responses. This is purely a backend intelligence upgrade.

