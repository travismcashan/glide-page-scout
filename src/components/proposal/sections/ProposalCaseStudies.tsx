const CASE_STUDIES = [
  {
    company: "AllerVie Health",
    industry: "Healthcare",
    stat: "+299%",
    statLabel: "Organic Traffic",
    extras: ["+272% appointment forms", "+121% conversion rate"],
    description: "Transformed a fragmented multi-location healthcare brand into a unified digital presence with SEO, paid media, and conversion-focused design.",
  },
  {
    company: "eClinical Solutions",
    industry: "Health Tech",
    stat: "+34%",
    statLabel: "Organic Traffic",
    extras: ["+54% keywords on page 1"],
    description: "Rebuilt the digital foundation for a clinical data management platform, driving organic visibility and qualified leads for enterprise sales.",
  },
  {
    company: "Smile Doctors",
    industry: "Healthcare",
    stat: "+98%",
    statLabel: "Conversion Rate",
    extras: ["Multi-location rollout"],
    description: "Designed and launched a scalable website platform across 100+ orthodontic locations, optimizing for local search and patient conversion.",
  },
  {
    company: "Traffix",
    industry: "Transportation",
    stat: "+862%",
    statLabel: "Organic Search Growth",
    extras: ["From zero organic presence"],
    description: "Built an SEO engine from scratch for a fleet management company, creating category-defining content that dominates search.",
  },
  {
    company: "Rand McNally",
    industry: "Technology",
    stat: "10+ years",
    statLabel: "Partnership",
    extras: ["Sole digital partner"],
    description: "Long-standing digital partnership spanning website redesigns, ecommerce optimization, and ongoing digital strategy for an iconic American brand.",
  },
];

export default function ProposalCaseStudies() {
  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Proof</span>{" "}
              <span className="font-light">of Performance</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              Select case studies that demonstrate GLIDE's ability to deliver measurable results for companies at similar stages and in related industries.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {CASE_STUDIES.map((cs, idx) => (
                <div key={idx} className="rounded-xl border border-border p-6 hover:shadow-lg transition-shadow space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{cs.company}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{cs.industry}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-primary">{cs.stat}</span>
                    <p className="text-sm text-muted-foreground">{cs.statLabel}</p>
                  </div>
                  {cs.extras.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {cs.extras.map((e, i) => (
                        <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">{e}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{cs.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
