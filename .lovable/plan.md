

## AI-Powered Wishlist Brain Dump

### What it does
Replace the current "Add Item" button/form with a prominent textarea at the top of the wishlist page. Users type a stream-of-consciousness idea (any length), hit a "Break it down" button, and AI parses it into multiple structured wishlist items with titles, descriptions, categories, and priorities — presented for review before saving.

### Flow

```text
┌─────────────────────────────────────────────────┐
│  "What's on your mind?"                         │
│  ┌─────────────────────────────────────────────┐ │
│  │ I think we need better onboarding. Like a   │ │
│  │ wizard that walks people through setup...    │ │
│  └─────────────────────────────────────────────┘ │
│                          [Break it down ✨]      │
└─────────────────────────────────────────────────┘

        ↓ AI processes ↓

┌─────────────────────────────────────────────────┐
│  AI found 3 items:                              │
│  ☑ Setup Wizard — feature, high                 │
│  ☑ Progress Indicators — feature, medium        │
│  ☑ Skip Option for Power Users — idea, low      │
│                    [Add Selected] [Discard]      │
└─────────────────────────────────────────────────┘
```

### Implementation

1. **New edge function `supabase/functions/wishlist-parse/index.ts`**
   - Accepts `{ rawInput: string }` 
   - Uses Lovable AI (gemini-3-flash-preview) with tool calling to extract structured output: array of `{ title, description, category (feature|bug|idea), priority (low|medium|high) }`
   - Returns the parsed items for user review

2. **Add `effort_estimate` column to `wishlist_items` table**
   - New field: `effort_estimate text` (nullable) — values like "small", "medium", "large"
   - AI will suggest effort estimates alongside priority

3. **Update `WishlistPage.tsx`**
   - Replace the header "Add Item" button with a persistent input area at the top (textarea + "Break it down" button)
   - Keep the manual "Add Item" form as a secondary option (small link: "or add manually")
   - New "review" state: after AI returns parsed items, show them as a checklist with editable fields (title, description, category, priority, effort) — user can toggle items on/off, edit, then bulk-save
   - Each item card in the list also shows the new `effort_estimate` badge

### Technical details
- Edge function uses tool calling (not JSON mode) for structured extraction — returns `{ items: [{ title, description, category, priority, effort_estimate }] }`
- Non-streaming call via `supabase.functions.invoke('wishlist-parse', { body: { rawInput } })`
- Review UI uses local state; only saves to DB on explicit confirmation
- Handles 429/402 errors with toast messages

