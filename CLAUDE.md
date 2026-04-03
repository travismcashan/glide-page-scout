# Glide Page Scout — Claude Context

## Brand Architecture

### Ascend
The external product name. An AI-powered growth marketing platform — bigger than GLIDE® long-term. GLIDE® is Ascend's first and best power user. Tagline: **"Glide helps you Ascend."**

### GLIDE® Pillars (internal-facing)

| Pillar | Audience | Purpose |
|---|---|---|
| **GLIDE® Growth** | Prospects | Research, pitch, close |
| **GLIDE® Delivery** | Active clients | Ongoing partnership, optimization, strategy |
| **GLIDE® Admin** | Internal ops | Agreements, invoicing |

**Growth features:** Analysis, Enrichment, Knowledge, Chat, Estimates, Roadmaps, Proposals

**Delivery features:** Ongoing analysis, Strategy/Pattern Library, AI Chat (full client context), Slack/Asana/Harvest (read + limited write), GA/GSC/Google Ads, Goals/Personas/Verticals

**Delivery philosophy:** Not project management — trusted growth partnership. "Helping good people and great ideas receive the exposure they deserve."

**Admin features:** Agreements, Invoicing

---

## Product Vision — Ascend

**Core:** A self-optimizing website powered by compounding AI context. Every Zoom call, Slack message, analytics trend, and email adds to the context layer. The longer a client is on the platform, the smarter it gets.

**Integration strategy:** Read-only by default, limited write where useful. Goal is AI context, not UI replication.

**Pattern Library:** Industry-based patterns for goals/KPIs, ICPs/personas, user flows, site architecture, pages, sections, blocks.

**Long-term trajectory:**
1. Internal tool (Glide's competitive advantage)
2. Client-facing portal
3. Other agencies adopt it
4. Direct to business (Ascend recommends Glide-certified partners)

---

## Current App (GLIDE® Growth / Scout)

Vite + React + TypeScript, Tailwind + shadcn/ui, Supabase (auth/DB/edge functions), TanStack Query, deployed on Vercel. 27+ integrations for pre-call prospect research and website auditing.

---

## Session Startup

At the start of every session, before starting the dev server:

1. `git fetch origin main && git rebase origin/main` (in the worktree)
2. `cd /Users/travismcashan/glide-page-scout && export PATH="/opt/homebrew/bin:$PATH" && npm install --silent` (main repo root — worktrees share its node_modules)

This ensures dependencies are always up to date. Do not skip this.
