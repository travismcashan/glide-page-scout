

# Knowledge Chat — Two-Phase Approach

## The Problem You've Identified

You're right. NotebookLM doesn't just dump everything into context every time — it pre-indexes sources, builds understanding, then retrieves only what's relevant per question. Stuffing 100-400K chars of raw JSON on every message means:

- Higher cost and latency per message
- Model attention diluted across irrelevant data
- No "memory" between sessions — every chat starts cold
- Can't scale if you add more integrations or longer transcripts

## The Two Approaches

### Phase 1: Direct Context (ship now, works today)
Same approach Deep Research and Observations already use. `buildCrawlContext` assembles all data, sends it as system context. Good enough for a v1 and lets you start chatting immediately.

**When it works well:** Single-session Q&A, short integration data, quick questions like "what's the SSL grade?" or "summarize the SEO findings."

**When it falls short:** Long Avoma transcripts, cross-referencing multiple data sources, follow-up conversations that need nuance, or when you want the AI to truly "understand" the data rather than just search through it.

### Phase 2: RAG with Embeddings (upgrade later)
Pre-process each integration's data into chunked embeddings stored in pgvector. On each chat message, do similarity search to pull only the 5-10 most relevant chunks. This is what NotebookLM does.

**Architecture:**
```text
Integration completes → Edge function chunks data → Embed via Lovable AI
→ Store in knowledge_chunks (pgvector) → On chat, embed question
→ Similarity search top-k chunks → Send only those as context
```

**New DB table:** `knowledge_chunks` with columns: `id`, `session_id`, `source` (integration name), `content`, `embedding` (vector), `metadata`

**Benefits:** Smarter retrieval, lower per-message cost, scales to any data size, AI focuses on what matters.

## Recommendation

Ship Phase 1 now — it's a 3-file change and gives you a working Knowledge tab today using the exact same pattern Deep Research already uses. Then we iterate to Phase 2 (RAG) once you've used it enough to feel the limitations.

## Phase 1 Implementation Plan

### Files to create/edit:

1. **`supabase/functions/knowledge-chat/index.ts`** (new)
   - Streaming edge function using Lovable AI Gateway (`google/gemini-3-flash-preview`)
   - Receives `{ messages, crawlContext, documents }` — same shape as deep-research
   - System prompt: "You are an expert website analyst. Cite integration sources by name. Stay grounded in the data provided."
   - Handles 429/402 errors, returns SSE stream
   - 400K char cap on context (same as deep-research)

2. **`src/components/KnowledgeChatCard.tsx`** (new)
   - Streaming chat UI with markdown rendering (`react-markdown`)
   - Uses `buildCrawlContext` to assemble context from session data + pages
   - Token-by-token SSE parsing (same pattern from the AI gateway docs)
   - Auto-scroll, loading states, suggested starter questions
   - Messages in React state only (ephemeral — no DB persistence)
   - Shows context stats (how many integrations contributing data)

3. **`src/pages/ResultsPage.tsx`** (edit)
   - Add "Knowledge" tab with `BookOpen` icon
   - Pass session data and pages to `KnowledgeChatCard`
   - Always visible regardless of integration data

### No new DB tables, no new secrets needed.

