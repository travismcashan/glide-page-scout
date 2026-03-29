

# Add API/Platform Sources to Chat References

## What's Happening Now
When the AI uses `call_api` to fetch data from Harvest or Asana, the tool calls are tracked internally (`allToolResults`) but never surfaced to the user as sources. The references block only shows RAG documents, integration sources, and web citations.

Additionally, when the tool-call path is taken (multi-step agentic loop), the backend returns the synthesis stream **without prepending metadata events** — so even existing RAG docs and web citations are lost on tool-call responses.

## Changes

### 1. Backend: Emit API sources as ragDocuments (`knowledge-chat/index.ts`)
After the tool-call loop completes (around line 1287), before the synthesis pass:
- Iterate `allToolResults` and create deduplicated API source entries
- For each `call_api` call, extract the `service` (harvest/asana) and `path` from args
- Push entries like `{ name: "Harvest: /projects", source_type: "api" }` into `ragDocuments`
- Prepend metadata events (rag_documents, web_citations) to the synthesis stream response — currently only the non-tool path does this

### 2. Frontend: New "api" source type + display order (`KnowledgeChatCard.tsx`)
- Add `api: '🔌'` to `SOURCE_TYPE_ICONS`
- In `ReferencesBlock`, split ragDocuments into two groups: API sources (`source_type === 'api'`) and regular documents
- Render API sources first under a "Live Data" heading, then documents under "Documents"
- Show the service name prominently (e.g., "Harvest: /projects/12345") with the path as secondary text

## Technical Details

**Backend** — after the `for` loop that gathers `allToolResults` (~line 1284):
```typescript
// Derive API sources from tool calls
const apiSourcesSeen = new Set<string>();
for (const tr of allToolResults) {
  if (tr.toolName === 'call_api') {
    try {
      const a = JSON.parse(tr.args);
      const key = `${a.service}:${a.path}`;
      if (!apiSourcesSeen.has(key)) {
        apiSourcesSeen.add(key);
        const label = (a.service || 'API').charAt(0).toUpperCase() + (a.service || 'api').slice(1);
        ragDocuments.push({ name: `${label}: ${a.path}`, source_type: 'api' });
      }
    } catch {}
  }
}
```

Then wrap the synthesis response with `prependMetadata()` (line 1332):
```typescript
return prependMetadata(new Response(finalResponse.body, {
  headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
}));
```

**Frontend** — `ReferencesBlock` updated render order:
```
Live Data (API sources)  ← new section, shown first
  🔌 Harvest: /projects
  🔌 Harvest: /time_entries?project_id=123
Documents               ← existing section
  📄 Harvest API Docs
Web                     ← existing section
```

### Files Modified
- `supabase/functions/knowledge-chat/index.ts` — emit API tool calls as sources + prepend metadata on tool-call path
- `src/components/KnowledgeChatCard.tsx` — add "api" icon, reorder ReferencesBlock sections

