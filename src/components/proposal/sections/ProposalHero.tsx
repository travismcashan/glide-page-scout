interface ProposalHeroProps {
  domain?: string;
  companyName: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
}

export default function ProposalHero({ domain, companyName, contactName, contactTitle, contactEmail }: ProposalHeroProps) {
  const today = new Date();
  const expires = new Date(today);
  expires.setDate(expires.getDate() + 30);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="px-8 py-20 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Metadata row */}
          <div className="text-base tracking-wide">
            <span className="font-semibold text-foreground">GLIDE® Proposal</span>
          </div>
          <div className="flex items-center gap-2 text-base tracking-wide">
            <span className="font-semibold text-foreground">Created</span>
            <span className="px-3 py-1 bg-muted rounded-full text-muted-foreground text-sm">{fmt(today)}</span>
          </div>
          <div className="flex items-center gap-2 text-base tracking-wide">
            <span className="font-semibold text-foreground">Expires</span>
            <span className="px-3 py-1 bg-muted rounded-full text-muted-foreground text-sm">{fmt(expires)}</span>
          </div>

          {/* Title */}
          <div className="lg:col-span-3 mt-8">
            <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
              GLIDE® Proposal
            </h1>
            <h2 className="text-5xl md:text-7xl font-light text-foreground mt-2 leading-[1.1] tracking-tight uppercase">
              {companyName || domain || "Client"}
            </h2>
          </div>

          {/* Contact info */}
          <div className="hidden lg:block lg:col-span-1" />
          <div className="mt-8">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Prepared by</p>
            <p className="text-lg font-medium text-foreground">Travis McAshan</p>
            <p className="text-base text-muted-foreground">Founder & CEO</p>
            <p className="text-base text-muted-foreground">GLIDE®</p>
            <a href="mailto:travis@glidedesign.com" className="text-base text-foreground hover:underline mt-2 inline-block">
              travis@glidedesign.com
            </a>
            <p className="text-base text-muted-foreground">512-215-4992</p>
          </div>
          {contactName && (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Prepared for</p>
              <p className="text-lg font-medium text-foreground">{contactName}</p>
              {contactTitle && <p className="text-base text-muted-foreground">{contactTitle}</p>}
              <p className="text-base text-muted-foreground">{companyName}</p>
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="text-base text-foreground hover:underline mt-2 inline-block">
                  {contactEmail}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
