

## Auto-Rename Chat Threads with AI-Generated Titles

### Problem
Currently, threads are titled by truncating the first 30 characters of the user's message (`titleText.slice(0, 30)`), which produces ugly, cut-off titles like "Can you analyze the navigatio..." or just stays as "New Chat" in some flows.

### Solution
After the first assistant response completes, call the AI (via the existing Lovable AI gateway) with the user's message + assistant reply to generate a concise 3-6 word title. This replaces the dumb truncation with an intelligent summary.

### How It Works

1. **New helper function** in `KnowledgeChatCard.tsx` — `generateThreadTitle(userMessage, assistantReply)`:
   - Calls the Lovable AI gateway with a small/fast model (`google/gemini-2.5-flash-lite`) 
   - System prompt: "Generate a concise 3-6 word title for this conversation. No quotes, no punctuation at end. Max 35 characters."
   - Returns the generated title string

2. **Replace the truncation logic** at line ~1653-1658:
   - Instead of `titleText.slice(0, 30)`, call `generateThreadTitle()` with the user message and assistant response
   - Fire-and-forget pattern (don't block the UI) — update the sidebar title once the AI responds
   - Fallback to the current truncation if the AI call fails

3. **Also fix the global chat flow** — the same pattern applies to `global_chat_threads` table updates

### Technical Details

- Uses the existing edge function infrastructure (Lovable AI gateway at `SUPABASE_URL/functions/v1/knowledge-chat` or a lightweight dedicated function)
- Actually simpler: just call the gateway directly from the client using `supabase.functions.invoke` or use the existing `knowledge-chat` endpoint with a tiny prompt
- Model choice: `google/gemini-2.5-flash-lite` — fastest, cheapest, perfect for a 1-sentence task
- Title capped at 35 chars to fit the sidebar without truncation at the current `EXPANDED_WIDTH` of 280px

### Files Changed
- `src/components/KnowledgeChatCard.tsx` — add `generateThreadTitle` helper, replace truncation logic in both the regular send handler and the deep research send handler

