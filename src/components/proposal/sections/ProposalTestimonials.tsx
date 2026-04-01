const TESTIMONIALS = [
  {
    quote: "GLIDE has been a fantastic partner. They really care about understanding your business and delivering work that makes a real impact. Their team is responsive, creative, and genuinely invested in our success.",
    author: "VP of Marketing",
    company: "eClinical Solutions",
  },
  {
    quote: "The GLIDE team became an extension of our marketing team. They didn't just build us a website, they built us a growth engine. The results speak for themselves.",
    author: "Director of Digital Marketing",
    company: "AllerVie Health",
  },
  {
    quote: "What sets GLIDE apart is their ability to translate complex ideas into beautiful, functional digital experiences. They think strategically and execute flawlessly.",
    author: "Chief Marketing Officer",
    company: "Agiloft",
  },
  {
    quote: "GLIDE delivers every time. They are thoughtful, thorough, and always pushing to make things better. I wouldn't trust our digital presence with anyone else.",
    author: "Head of Brand",
    company: "Aptive Index",
  },
];

export default function ProposalTestimonials() {
  return (
    <section className="py-20 px-8 lg:px-16 bg-muted/30 dark:bg-muted/10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Client</span>{" "}
              <span className="font-light">Testimonials</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 space-y-8">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="border-l-2 border-primary/30 pl-6">
                <blockquote className="text-base text-muted-foreground italic leading-relaxed mb-3">
                  "{t.quote}"
                </blockquote>
                <p className="text-sm font-semibold text-foreground">{t.author}</p>
                <p className="text-xs text-muted-foreground">{t.company}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
