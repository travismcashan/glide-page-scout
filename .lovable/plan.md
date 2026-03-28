

## Redesign: HTTP Status Card

### What it does today
The edge function checks a single URL via httpstatus.io, returning redirect chain hops with timing data, headers, parsed hostnames, etc. The card dumps all of this in a verbose, hard-to-scan layout with expandable header tables, hostname badges (TLD, ICANN, subdomain), and a "Final URL Breakdown" section that's mostly noise.

### What's valuable (keep)
- **Redirect chain visualization** — knowing if there are redirects and what kind (301 vs 302)
- **Load timing waterfall** — DNS, TCP, TLS, TTFB, download breakdown
- **Clean status summary** — green checkmark for no redirects + 200

### What's missing (add)
- **Domain canonical check** — test all 4 versions (http://domain, https://domain, http://www.domain, https://www.domain) and show whether they all resolve to the same canonical URL. This is the key insight for SEO.

### What to remove
- Parsed hostname badges (domain, subdomain, TLD, ICANN) — noise
- Request headers table — nobody needs this
- Response headers table — move to a single collapsible if desired
- "Final URL Breakdown" section (protocol, hostname, port badges) — redundant
- Per-hop IP address display

### Plan

**1. Update edge function (`httpstatus-check/index.ts`)**
- Accept `{ url }` but also derive the 4 canonical variants from the domain (http://, https://, http://www., https://www.)
- Call httpstatus.io for all 4 variants in parallel
- Return a new shape: `{ canonical: { variants: [...], allResolveToSame: boolean, canonicalUrl: string }, primary: { ...existing hop/timing data for the main URL } }`
- Keep backward compatibility: still include `hops`, `finalUrl`, etc. for the primary URL

**2. Redesign the card component (`HttpStatusCard.tsx`)**

New layout with 3 clean sections:

```text
┌──────────────────────────────────────────────┐
│  ✓ 200 OK · No redirects · 342ms total      │  ← Status summary row
├──────────────────────────────────────────────┤
│  Domain Canonicalization                      │
│  ┌────────────────────────┬────────┬────────┐│
│  │ http://domain.com      │ 301 →  │ ✓      ││
│  │ https://domain.com     │ 200    │ ✓ canonical ││
│  │ http://www.domain.com  │ 301 →  │ ✓      ││
│  │ https://www.domain.com │ 301 →  │ ✓      ││
│  └────────────────────────┴────────┴────────┘│
│  ✓ All variants resolve to https://domain.com│
├──────────────────────────────────────────────┤
│  Response Time Breakdown                      │
│  [DNS][TCP][TLS][TTFB][Download] = 342ms     │  ← Clean timing bar
│  DNS 12ms · TCP 8ms · TLS 24ms · TTFB 280ms │
├──────────────────────────────────────────────┤
│  ▸ Response Headers (22)                     │  ← Single collapsible
└──────────────────────────────────────────────┘
```

**3. Files changed**
- `supabase/functions/httpstatus-check/index.ts` — check all 4 domain variants
- `src/components/HttpStatusCard.tsx` — complete redesign
- `src/lib/api/firecrawl.ts` — minor type update if needed
- `src/pages/ResultsPage.tsx` — no changes expected (card receives `session.httpstatus_data`)

**4. Cost consideration**
This will use 4 httpstatus.io API calls per site instead of 1. The calls run in parallel so latency stays similar.

