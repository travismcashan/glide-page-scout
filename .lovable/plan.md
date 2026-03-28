

## Brand Identity Evolution: Monochromatic Purple → Purple + Rainbow Signature

### Current State
- **Primary**: Purple `hsl(250, 65%, 55%)` — buttons, links, focus rings, badges
- **Accent**: Teal `hsl(165, 60%, 42%)` — success states, highlights
- **Neutrals**: Cool grays on light/dark backgrounds
- **New element**: Animated rainbow gradient on the homepage rotating verb

### Updated Brand Guidelines

**Three-tier color system:**

1. **Purple (Primary)** — All functional UI: buttons, links, navigation, form focus states, badges. This is the brand's backbone and should never be replaced.

2. **Teal (Accent)** — Success indicators, progress, secondary highlights. Functional and informational.

3. **Rainbow Gradient (Signature Moment)** — Reserved for 1–2 high-visibility, non-interactive flourishes per screen. Signals energy and craft. Current usage: homepage hero verb.

### Usage Rules for Rainbow Gradient

| Allowed | Not Allowed |
|---|---|
| Hero text flourishes | Buttons or clickable elements |
| Loading/progress bar accents | Navigation items |
| Onboarding splash moments | Logos or brand marks |
| Empty-state illustrations | Body text or labels |

**Constraint**: Max 1–2 rainbow elements per viewport. More dilutes the effect.

### What This Means for the Brand Narrative

- **Before**: "Professional and precise" — a focused, monochromatic tool
- **After**: "Professional with a spark of craft" — confident purple foundation with a curated moment of delight

The rainbow doesn't replace purple; it elevates it. Think of it like a luxury brand's monogram lining — the exterior is clean and restrained, but there's a signature detail that rewards attention.

### Implementation Plan

1. **Update stored brand memory** to document the three-tier color system (Purple → Teal → Rainbow Signature) with usage rules
2. **Add a code comment block** at the top of the `.rainbow-text` CSS class documenting where it should and shouldn't be used
3. **No other code changes** — this is a guidelines update, not a UI change

