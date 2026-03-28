

## Animated Rainbow Gradient on Rotating Verb

### What changes
Apply an animated rainbow gradient text effect (using `background-clip: text` masking) to the rotating verb word.

### Technical approach

**File: `src/index.css`** — Add a `@keyframes rainbow-shift` animation that moves a wide linear gradient horizontally, and a `.rainbow-text` utility class combining `background-clip: text`, `text-fill-color: transparent`, and the animation.

**File: `src/pages/CrawlPage.tsx`** — Replace `text-primary font-medium` on the `motion.span` (line 167) with the `rainbow-text` class plus `font-medium`.

### CSS addition
```css
@keyframes rainbow-shift {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}

.rainbow-text {
  background: linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow-shift 3s linear infinite;
}
```

