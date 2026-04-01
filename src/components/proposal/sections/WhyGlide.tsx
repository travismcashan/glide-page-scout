interface WhyGlideProps {
  pillars: { number: string; title: string; subtitle: string; items: { label: string; text: string }[] }[];
  companyName: string;
}

export default function WhyGlide({ pillars, companyName }: WhyGlideProps) {
  // Fallback static pillars if AI didn't generate
  const data = pillars?.length ? pillars : [
    {
      number: "1",
      title: "22 Years of Design Excellence",
      subtitle: "GLIDE has been building award-winning digital experiences since 2004. We're not learning on your dime.",
      items: [
        { label: "Proven Process:", text: "Discovery, strategy, design, build, optimize. A mature, repeatable framework refined over hundreds of engagements." },
        { label: "Team Tenure:", text: "Our average team member has been with GLIDE for 8+ years. Low turnover means deep expertise and seamless delivery." },
        { label: "Awards & Recognition:", text: "2025 Inc. Best Workplace, Inspiring Workplace award, top-ranked on Clutch and WPEngine." },
      ],
    },
    {
      number: "2",
      title: "Your Growth Partner, Not Just a Vendor",
      subtitle: "We don't just build websites. We build digital growth engines that compound over time.",
      items: [
        { label: "Strategic Foundation:", text: "Every engagement starts with discovery and strategy. We understand your business before we touch a pixel." },
        { label: "Full-Stack Capability:", text: "Design, development, SEO, PPC, content, analytics, and ongoing support under one roof." },
        { label: "Long-Term Focus:", text: "Our best clients have been with us for 5-10+ years. We build for compounding returns, not quick wins." },
      ],
    },
    {
      number: "3",
      title: "Built for Companies Like Yours",
      subtitle: "We specialize in helping growth-stage companies punch above their weight online.",
      items: [
        { label: "Right-Sized Partnership:", text: "Big enough to deliver enterprise-quality work. Small enough to care deeply about your success." },
        { label: "Industry Fluency:", text: "Deep experience across healthcare, SaaS, manufacturing, and professional services." },
        { label: "AI-Forward:", text: "We're integrating AI into every layer of our work, from research to content to optimization, giving you a competitive edge." },
      ],
    },
  ];

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
              <span className="font-bold">Why</span>{" "}
              <span>GLIDE®?</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 space-y-12">
            {data.map((pillar, idx) => (
              <div key={idx}>
                <div className="mb-4">
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">{pillar.number}. {pillar.title}</h3>
                  {pillar.subtitle && (
                    <p className="text-sm text-muted-foreground italic">{pillar.subtitle}</p>
                  )}
                </div>
                <ul className="space-y-2">
                  {pillar.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{item.label}</strong> {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
