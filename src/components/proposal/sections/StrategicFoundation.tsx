const ICONS: Record<string, string> = {
  Climate: "🌍",
  Competition: "⚔️",
  Customers: "👥",
  Company: "🏢",
  Culture: "🧬",
};

interface StrategicFoundationProps {
  categories: { category: string; points: string[] }[];
}

export default function StrategicFoundation({ categories }: StrategicFoundationProps) {
  if (!categories?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">The</span>{" "}
              <span className="font-light">Playing Field</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              A 5C strategic diagnostic of the landscape: Climate, Competition, Customers, Company, and Culture.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3">
            <div className="grid md:grid-cols-5 gap-6">
              {categories.map((cat, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ICONS[cat.category] || "📊"}</span>
                    <h3 className="text-lg font-bold text-foreground">{cat.category}</h3>
                  </div>
                  <ul className="space-y-2">
                    {cat.points.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
