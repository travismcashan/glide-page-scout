

## AI Settings Prompt Injection — Full Data Flow

Here's how every personal and AI setting flows from the Settings page into AI prompts. I also found a **bug**: GlobalChatPage reads from wrong localStorage keys for bio and role.

### Architecture Overview

```text
┌─────────────────────────────────────────────────────┐
│                  SETTINGS PAGE                       │
│              (src/pages/SettingsPage.tsx)             │
│                                                      │
│  Saves to localStorage on every keystroke:           │
│                                                      │
│  PERSONAL IDENTITY                                   │
│  ├─ ai-about-me        → JSON (Apollo-enriched)     │
│  ├─ ai-personal-bio    → string                     │
│  ├─ ai-my-role         → string                     │
│  └─ ai-location        → JSON {city,region,country} │
│                                                      │
│  AI BEHAVIOR                                         │
│  ├─ ai-tone-preset     → string (professional,      │
│  │                       friendly, candid, etc.)     │
│  ├─ ai-characteristics → JSON array [warm,          │
│  │                       emoji, tables, etc.]        │
│  └─ ai-custom-instructions → string (2000 chars)    │
│                                                      │
│  RAG DEPTH                                           │
│  ├─ rag-match-count    → number (default 50)        │
│  └─ rag-match-threshold→ number (default 0.15)      │
└──────────────┬──────────────────────┬────────────────┘
               │                      │
    ┌──────────▼──────────┐  ┌────────▼──────────────┐
    │  KnowledgeChatCard  │  │   GlobalChatPage      │
    │  (per-site chat)    │  │   (global chat)       │
    │                     │  │                        │
    │  Reads:             │  │  Reads:                │
    │  ✅ ai-tone-preset  │  │  ✅ ai-tone-preset     │
    │  ✅ ai-characteristics│ │  ✅ ai-characteristics │
    │  ✅ ai-custom-instr │  │  ✅ ai-custom-instr    │
    │  ✅ ai-about-me     │  │  ✅ ai-about-me        │
    │  ✅ ai-personal-bio │  │  ⚠️ ai-bio (WRONG!)   │
    │  ✅ ai-my-role      │  │  ⚠️ ai-role (WRONG!)  │
    │  ✅ ai-location     │  │  ✅ ai-location        │
    │  ✅ rag-match-count │  │  ✅ ai-rag-match-count │
    │  ✅ rag-match-thresh│  │  ✅ ai-rag-match-thresh│
    └──────────┬──────────┘  └────────┬──────────────┘
               │                      │
               │   POST body includes:│
               │   messages, model,   │
               │   tonePreset,        │
               │   characteristics,   │
               │   customInstructions, │
               │   aboutMe, personalBio│
               │   myRole, locationData│
               │   rag_depth, sources  │
               │                      │
               └──────────┬───────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────┐
    │        knowledge-chat Edge Function              │
    │    (supabase/functions/knowledge-chat/index.ts)   │
    │                                                  │
    │  buildSystemPrompt() assembles final prompt:     │
    │                                                  │
    │  BASE PROMPT                                     │
    │  "You are an expert website analyst..."          │
    │                                                  │
    │  + ABOUT THE USER block (if aboutMe exists):     │
    │    Name, Title, Company (Industry), Size,        │
    │    Location, Seniority, Departments,             │
    │    "What they do" (myRole),                      │
    │    "User's own bio" (personalBio),               │
    │    Current location + timezone + local time      │
    │                                                  │
    │  + COMMUNICATION STYLE block (if tone != default)│
    │    Maps preset name → prose instruction          │
    │    e.g. "professional" → "Communicate in a      │
    │    polished, precise..."                         │
    │                                                  │
    │  + RESPONSE CHARACTERISTICS block:               │
    │    Each characteristic → instruction line        │
    │    e.g. "emoji" → "Sprinkle in relevant emoji"  │
    │    e.g. "tables" → "Prefer markdown tables"     │
    │                                                  │
    │  + CUSTOM INSTRUCTIONS block:                    │
    │    Raw user text, injected verbatim              │
    │                                                  │
    │  + CONTEXT DATA (RAG results, crawl data, etc.) │
    └─────────────────────────────────────────────────┘
```

### Which AI endpoints receive personalization?

| Endpoint | Receives settings? | Notes |
|---|---|---|
| `knowledge-chat` | Yes, all settings | Full buildSystemPrompt() |
| `council-chat` | Only customInstructions | No tone/about/bio |
| `deep-research` | No | No personalization |
| `observations-insights` | No | No personalization |
| `wishlist-parse` | No | Utility function |
| `tech-analysis` | No | Utility function |

### Bug Found

**GlobalChatPage reads wrong localStorage keys:**
- Reads `ai-bio` but SettingsPage saves to `ai-personal-bio`
- Reads `ai-role` but SettingsPage saves to `ai-my-role`

This means bio and role are **silently never sent** from the global chat page.

### Proposed Fix

Update `GlobalChatPage.tsx` lines 206-207 to use the correct keys:
- `ai-bio` → `ai-personal-bio`
- `ai-role` → `ai-my-role`

