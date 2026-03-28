import AppHeader from '@/components/AppHeader';

const COLOR_TIERS = [
  {
    tier: 'Primary',
    name: 'Purple',
    css: '--primary',
    hsl: '250 65% 55%',
    usage: 'Buttons, links, navigation, form focus states, badges, brand backbone.',
    rule: 'Always use for functional, interactive UI.',
  },
  {
    tier: 'Accent',
    name: 'Teal',
    css: '--accent',
    hsl: '165 60% 42%',
    usage: 'Success indicators, progress states, secondary highlights.',
    rule: 'Informational and functional accents.',
  },
  {
    tier: 'Signature Moment',
    name: 'Rainbow Gradient',
    css: 'rainbow',
    hsl: 'multi-color gradient',
    usage: 'Hero text flourishes, loading/progress bar accents, onboarding moments.',
    rule: 'Max 1–2 per viewport. Never on buttons, nav, or logos.',
  },
];

const NEUTRALS = [
  { name: 'Background', css: '--background' },
  { name: 'Foreground', css: '--foreground' },
  { name: 'Card', css: '--card' },
  { name: 'Muted', css: '--muted' },
  { name: 'Border', css: '--border' },
];

const TYPOGRAPHY = [
  { family: 'Space Grotesk', usage: 'Headings, body text, UI labels', weight: '300–700', sample: 'The quick brown fox jumps' },
  { family: 'JetBrains Mono', usage: 'Code, technical data, monospace contexts', weight: '400–500', sample: 'console.log("hello")' },
];

function ColorSwatch({ cssVar, label, isRainbow }: { cssVar: string; label: string; isRainbow?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-12 h-12 rounded-lg border border-border shrink-0"
        style={{
          background: isRainbow
            ? 'linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff, #ff0000)'
            : `hsl(var(${cssVar}))`,
        }}
      />
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground font-mono">{cssVar}</span>
      </div>
    </div>
  );
}

export default function BrandGuidePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-12">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Brand Style Guide</h1>
          <p className="mt-2 text-muted-foreground text-lg">
            GLIDE® design system — <span className="italic">"Professional with a spark of craft."</span>
          </p>
        </div>

        {/* ── Color System ── */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Three-Tier Color System</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {COLOR_TIERS.map((t) => (
              <div key={t.tier} className="rounded-lg border border-border bg-card p-5 space-y-3">
                <ColorSwatch
                  cssVar={t.css}
                  label={t.name}
                  isRainbow={t.css === 'rainbow'}
                />
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary/70 mb-1">
                    {t.tier}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{t.usage}</p>
                  <p className="text-xs text-muted-foreground mt-1 italic">{t.rule}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Neutrals ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Neutrals</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {NEUTRALS.map((n) => (
              <ColorSwatch key={n.css} cssVar={n.css} label={n.name} />
            ))}
          </div>
        </section>

        {/* ── Typography ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Typography</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {TYPOGRAPHY.map((t) => (
              <div key={t.family} className="rounded-lg border border-border bg-card p-5 space-y-2">
                <p
                  className="text-2xl font-semibold text-foreground"
                  style={{ fontFamily: `'${t.family}', sans-serif` }}
                >
                  {t.sample}
                </p>
                <p className="text-sm font-medium text-foreground">{t.family}</p>
                <p className="text-xs text-muted-foreground">{t.usage}</p>
                <p className="text-xs text-muted-foreground font-mono">Weights: {t.weight}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Rainbow Signature Rules ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Rainbow Gradient — Usage Rules</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-5">
              <h3 className="text-sm font-semibold text-accent mb-3">✓ Allowed</h3>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>• Hero text flourishes</li>
                <li>• Loading / progress bar accents</li>
                <li>• Onboarding splash moments</li>
                <li>• Empty-state illustrations</li>
              </ul>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
              <h3 className="text-sm font-semibold text-destructive mb-3">✗ Not Allowed</h3>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li>• Buttons or clickable elements</li>
                <li>• Navigation items</li>
                <li>• Logos or brand marks</li>
                <li>• Body text or labels</li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-muted-foreground italic">
            Constraint: Max 1–2 rainbow elements per viewport. More dilutes the effect.
          </p>
        </section>

        {/* ── Live Preview ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">Live Preview</h2>
          <div className="rounded-lg border border-border bg-card p-8 text-center space-y-4">
            <p className="text-4xl font-bold tracking-tight">
              We help you{' '}
              <span className="rainbow-text">discover</span>
            </p>
            <p className="text-muted-foreground text-sm">
              The rainbow gradient as a signature moment — reserved for high-visibility flourishes.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
