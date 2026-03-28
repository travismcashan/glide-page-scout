

## Exclude Posts from Tertiary Pages

**What**: Filter out pages with `baseType === 'Post'` from the tertiary URL list, since blog posts are bulk-imported (like CPTs) and should not be counted as individual pages for integration.

**File**: `src/components/RedesignEstimateCard.tsx`

**Change**: In the `useMemo` block (around line 243-249), add a condition to skip URLs where `pageTags[url].baseType === 'Post'`:

```typescript
if (pageTags) {
  for (const url of Object.keys(pageTags)) {
    const norm = url.replace(/\/$/, '');
    const tag = pageTags[url];
    if (!primarySet.has(norm) && !secondarySet.has(norm) && tag.baseType !== 'Post') {
      tUrls.push(norm);
    }
  }
}
```

Also update `totalPages` to reflect only integrable pages (exclude posts from the "Detected Pages" count in estimate mode), or keep it as-is for analysis mode. The selected count will naturally exclude posts since they won't appear in any list.

One line change, no new files.

