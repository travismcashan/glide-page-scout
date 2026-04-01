interface StrategicFoundationProps {
  categories: { category: string; points: string[] }[];
}

export default function StrategicFoundation({ categories }: StrategicFoundationProps) {
  if (!categories?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
              <span className="font-bold">The</span>{" "}
              <span className="font-light">Playing Field</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
              {categories.map((cat, idx) => (
                <div key={idx}>
                  <h3 className="text-base font-bold text-foreground mb-4">{cat.category}</h3>
                  <ul className="space-y-2">
                    {cat.points.slice(0, 5).map((point, i) => (
                      <li key={i} className="text-sm text-muted-foreground leading-snug">
                        {point}
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
