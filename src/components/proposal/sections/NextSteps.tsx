import { CheckSquare, Square, Mail, Calendar } from "lucide-react";

const completed = [
  "Discovery call",
  "Needs analysis",
  "Digital growth plan and estimate",
  "This proposal",
];

const nextItems = [
  "Review: Read through and compare options",
  "Feedback: Questions? Check the FAQ or email us",
  "Decision: Yes, No, or Let's Talk",
  "Onboarding: Sign agreement and kick off",
];

interface NextStepsProps {
  contactEmail?: string;
}

export default function NextSteps({ contactEmail }: NextStepsProps) {
  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
              <span className="font-bold">Next</span>{" "}
              <span className="font-light">Steps</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2 space-y-10">
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <h3 className="text-xl font-bold text-foreground mb-5">What's done?</h3>
                <ul className="space-y-3">
                  {completed.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckSquare className="w-5 h-5 text-green-600 shrink-0" />
                      <span className="text-muted-foreground line-through text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-5">What's next?</h3>
                <ul className="space-y-3">
                  {nextItems.map((item, i) => {
                    const colon = item.indexOf(":");
                    const label = colon !== -1 ? item.substring(0, colon) : "";
                    const rest = colon !== -1 ? item.substring(colon + 1) : item;
                    return (
                      <li key={i} className="flex items-start gap-3">
                        <Square className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">
                          {label && <strong className="text-foreground">{label}:</strong>}
                          {rest}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="pt-6">
              <p className="text-muted-foreground mb-6 text-base">
                Questions? Ready to move forward? Let's connect.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="mailto:travis@glidedesign.com"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-bold text-sm hover:bg-primary/90 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Send an Email
                </a>
                <a
                  href="https://info.glidedesign.com/meetings/travismcashan/follow-up"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-foreground text-foreground rounded-full font-bold text-sm hover:bg-foreground hover:text-background transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule a Call
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
