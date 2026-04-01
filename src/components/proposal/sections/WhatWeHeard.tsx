interface WhatWeHeardProps {
  insights: { title: string; quote: string; author: string }[];
}

export default function WhatWeHeard({ insights }: WhatWeHeardProps) {
  if (!insights?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">What</span>{" "}
              <span className="font-light">We Heard</span>
            </h2>
            <p className="text-base text-muted-foreground max-w-3xl">
              A synthesis of our discovery sessions, reflecting key themes, priorities, and goals that define this engagement.
            </p>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="lg:col-span-3">
            <div className="grid md:grid-cols-3 gap-6">
              {insights.map((insight, idx) => (
                <div key={idx} className="p-6 rounded-xl border border-border hover:shadow-lg transition-shadow">
                  <h3 className="text-xl font-bold text-foreground mb-8 leading-snug">{insight.title}</h3>
                  <blockquote className="text-lg text-muted-foreground italic mb-4">
                    "{insight.quote}"
                  </blockquote>
                  {insight.author && (
                    <p className="text-base font-bold text-foreground">- {insight.author}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
