interface StrategicFoundationProps {
  categories: { category: string; points: string[] }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  Climate: 'Climate',
  Competition: 'Competition',
  Customers: 'Customers',
  Company: 'Company',
  Culture: 'Culture',
};

/** Try to split "Climate: The Margin Protection Reality" into label + subtitle */
function parseCategory(raw: string): { label: string; subtitle: string } {
  // Check if the AI included a subtitle after the category name
  const colonMatch = raw.match(/^(Climate|Competition|Customers|Company|Culture)[:\s—–\-]+(.+)/i);
  if (colonMatch) {
    return { label: colonMatch[1], subtitle: colonMatch[2].trim() };
  }
  // Check if it's a known 5C category
  const known = Object.keys(CATEGORY_LABELS).find(k => raw.toLowerCase().startsWith(k.toLowerCase()));
  if (known) {
    const rest = raw.slice(known.length).replace(/^[:\s—–\-]+/, '').trim();
    return { label: known, subtitle: rest };
  }
  return { label: raw, subtitle: '' };
}

export default function StrategicFoundation({ categories }: StrategicFoundationProps) {
  if (!categories?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
          <span className="font-bold">The</span>{" "}
          <span className="font-light">Playing Field</span>
        </h2>
        <p className="text-base text-muted-foreground max-w-3xl mt-4">
          A 360-degree diagnostic of the market atmosphere and competitive landscape.
        </p>
        <hr className="border-t-2 border-foreground mt-8 mb-12" />

        <div className="max-w-3xl mx-auto space-y-10">
          {categories.map((cat, idx) => {
            const { label, subtitle } = parseCategory(cat.category);
            return (
              <div key={idx}>
                <h3 className="text-xl md:text-2xl text-foreground mb-4">
                  <span className="font-bold">{idx + 1}. {label}:</span>
                  {subtitle && <span className="font-normal"> {subtitle}</span>}
                </h3>
                <ul className="space-y-2 ml-6">
                  {cat.points.slice(0, 5).map((point, i) => (
                    <li key={i} className="text-base text-muted-foreground leading-relaxed list-disc">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
