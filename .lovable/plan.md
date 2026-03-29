
Goal

Remove the visible mobile “box”/tone shift behind the rotating homepage verb with the safest fix path: a clean solid-color mobile treatment instead of the multicolor clipped gradient.

What I found

- In `src/pages/CrawlPage.tsx`, the rotating word sits inside a fixed-size `overflow-hidden` wrapper and is animated with `AnimatePresence` / `motion.span`.
- The word itself uses `.rainbow-text` from `src/index.css`, which relies on `background-clip: text`, transparent text fill, and an animated gradient.
- On mobile browsers, especially Safari/WebKit, that combo is a common source of rectangular compositing artifacts. The screenshot lines up with that exact word container.
- You selected the safest direction: clean solid color.

Implementation plan

1. Split the headline verb into desktop and mobile render paths in `src/pages/CrawlPage.tsx`.
   - Desktop keeps the current multicolor treatment.
   - Mobile gets a plain solid brand color.

2. Simplify the mobile rotating word rendering.
   - Remove the `rainbow-text` class from the mobile version.
   - Use a normal text color such as `text-primary`.
   - Keep the rotation effect, but use a simpler mobile-safe animation so it still feels polished.

3. Make the mobile word container more stable.
   - Replace the current absolute/overflow-heavy mobile setup with a simpler inline-block/min-width container.
   - Preserve the current two-line headline layout so the word still fits cleanly without wrapping weirdly.

4. Keep the gradient style isolated.
   - Leave `.rainbow-text` available for desktop and any other existing uses.
   - Avoid global CSS changes that could affect unrelated pages.

5. Verify against the exact failure case.
   - Check the homepage at the current mobile width (`375px`) and a nearby width (`390px`).
   - Confirm the box/tone shift is gone both when the word is still and while it transitions.
   - Confirm the headline still feels large, readable, and aligned with the rest of the site.

Technical detail

- Likely root cause: `background-clip: text` + transparent fill + animated gradient + motion/overflow clipping on mobile WebKit.
- Lowest-risk fix: stop using clipped gradient text for this one mobile element instead of trying to keep patching Safari rendering quirks.
- Files likely affected: `src/pages/CrawlPage.tsx` and possibly `src/index.css`.
