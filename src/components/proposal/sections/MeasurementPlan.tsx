interface MeasurementPlanProps {
  kpis: { metric: string; baseline: string; target: string; method: string }[];
}

/** Try to split a target like "50% increase over baseline" into a bold headline + detail */
function parseTarget(target: string): { headline: string; detail: string } {
  // Match patterns like "45+/mo", "2-3×", "90+", "<40%", "Hours", "$50K"
  const match = target.match(/^([<>~]?\$?[\d,.]+[%×xX+]?(?:\/\w+)?|[A-Z][a-z]+(?:\s[a-z]+)?)\s*[—–\-:,]?\s*(.*)/);
  if (match && match[1]) {
    return { headline: match[1].trim(), detail: match[2]?.trim() || '' };
  }
  // If target is short (< 20 chars), use it all as headline
  if (target.length < 20) {
    return { headline: target, detail: '' };
  }
  return { headline: '', detail: target };
}

export default function MeasurementPlan({ kpis }: MeasurementPlanProps) {
  if (!kpis?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
          <span className="font-bold">What Success</span>{" "}
          <span className="font-light">Looks Like</span>
        </h2>
        <p className="text-base text-muted-foreground max-w-3xl mb-8">
          The measurable outcomes that define whether this engagement is delivering real value.
        </p>

        {/* Table header */}
        <div className="rounded-t-lg bg-foreground text-background grid grid-cols-12 px-6 py-3.5">
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider">What We're Measuring</div>
          <div className="col-span-3 text-xs font-bold uppercase tracking-wider">Target</div>
          <div className="col-span-6 text-xs font-bold uppercase tracking-wider">How We'll Know</div>
        </div>

        {/* Table rows */}
        {kpis.map((kpi, idx) => {
          const { headline, detail } = parseTarget(kpi.target);
          return (
            <div
              key={idx}
              className={`grid grid-cols-12 px-6 py-6 items-start gap-4 ${
                idx < kpis.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {/* Metric + Baseline */}
              <div className="col-span-3">
                <p className="font-bold text-foreground text-base leading-tight">{kpi.metric}</p>
                {kpi.baseline && (
                  <p className="text-sm text-muted-foreground italic mt-1">{kpi.baseline}</p>
                )}
              </div>

              {/* Target - big bold number + supporting text */}
              <div className="col-span-3">
                {headline ? (
                  <>
                    <p className="text-2xl md:text-3xl font-bold text-foreground leading-none">{headline}</p>
                    {detail && <p className="text-sm text-muted-foreground mt-1.5 leading-snug">{detail}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground leading-snug">{kpi.target}</p>
                )}
              </div>

              {/* Method */}
              <div className="col-span-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{kpi.method}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
