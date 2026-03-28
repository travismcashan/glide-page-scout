

## Headline Redesign: Randomized Three-Word Phrases + Rotating Verb

### What changes

Replace the static "Hello, Travis. / Let's [verb]." headline with a two-line format:

**Line 1:** "Hello, Travis." (unchanged)
**Line 2:** "[random phrase], [rotating verb]." where the phrase is randomly selected on each page load from a pool of options.

### Phrase pool (randomly picked per page load)

- "Ready, set,"
- "What should we"
- "Pick a site,"
- "Go ahead and"

The rotating verb animation stays exactly as-is (cycling through the 50 ROTATING_WORDS).

### Technical approach

**Single file:** `src/pages/CrawlPage.tsx`

1. Add a `ROTATING_PHRASES` array with the four phrases above.
2. Use `useMemo` (or `useState` with empty-dep initializer) to pick a random phrase index on mount — so it stays stable during the session but changes on each page visit.
3. Replace the hardcoded `"Let's"` span with the randomly selected phrase.
4. Adjust the `w-[5.5em]` width on the verb container if needed since some phrases are longer (the phrase itself won't be in the animated container — only the verb rotates).

The layout becomes:
```text
Hello, Travis.
Ready, set, [Analyze].     ← phrase is static per visit, verb rotates
```

