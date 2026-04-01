interface MeasurementPlanProps {
  kpis: { metric: string; baseline: string; target: string; method: string }[];
}

export default function MeasurementPlan({ kpis }: MeasurementPlanProps) {
  if (!kpis?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">What Success</span>{" "}
              <span className="font-light">Looks Like</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              The measurable outcomes that define whether this engagement is delivering real value.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-foreground">
                    <th className="text-left py-3 pr-4 font-semibold text-foreground">#</th>
                    <th className="text-left py-3 pr-4 font-semibold text-foreground">Metric</th>
                    <th className="text-left py-3 pr-4 font-semibold text-foreground">Baseline</th>
                    <th className="text-left py-3 pr-4 font-semibold text-foreground">Target</th>
                    <th className="text-left py-3 font-semibold text-foreground">How We'll Get There</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((kpi, idx) => (
                    <tr key={idx} className="border-b border-border">
                      <td className="py-4 pr-4 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="py-4 pr-4 font-medium text-foreground">{kpi.metric}</td>
                      <td className="py-4 pr-4 text-muted-foreground">{kpi.baseline}</td>
                      <td className="py-4 pr-4 font-medium text-foreground">{kpi.target}</td>
                      <td className="py-4 text-muted-foreground">{kpi.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
