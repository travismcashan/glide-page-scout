import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const GLIDE_FAQS = [
  {
    question: "Who are you?",
    answer: `We're GLIDE\u00AE\u2014a strategic web studio for brands where trust drives million-dollar decisions. Since 2003, we've paired elite design with engineering, SEO, and analytics to help organizations signal top-tier stature, move fast on mobile, and turn first impressions into booked consults.`,
    hasTeamPhoto: true,
    teamCaption: [
      { row: "Front Row (left to right)", names: "Drew Lyon \u2013 Creative Director \u00B7 Jessica McDaniel \u2013 Director of UX \u00B7 Paola Cardenas \u2013 People Ops Manager & Sr. PM \u00B7 Jeff King \u2013 CI Team Lead & PM" },
      { row: "Back Row (left to right)", names: "Kimberly Yount \u2013 Director of Client Services & Sr. PM \u00B7 Dan Raini \u2013 Sr. Digital Marketing Manager \u00B7 Marian Brchan \u2013 Design Lead & Sr. UX Designer \u00B7 Travis McAshan \u2013 Founder & CEO \u00B7 Brooke Miceli \u2013 Vice President" },
    ],
  },
  {
    question: "How soon can we get started?",
    answer: "GLIDE typically has a production schedule lead time of 1\u20132 weeks. This is contingent upon 1) you signing our service agreement and 2) making your initial payment. We understand that payment can take time to process.",
  },
  {
    question: "Can we meet our project team?",
    answer: `100% yes. Our #1 core value is "Build Meaningful Relationships" and we know how important it is for new teams to have chemistry. We can tap specific folks if you're interested in Design, Content, or Development, or we can curate more holistically as you see fit.`,
    teamRoles: [
      { role: "Dedicated Project Manager", desc: "Ensures seamless communication and timely execution." },
      { role: "Creative Director", desc: "Guides the creative process for stunning digital experiences." },
      { role: "Sr. UX Designer", desc: "Creates intuitive and enjoyable interfaces." },
      { role: "UX Architect / Content Strategist", desc: "Develops content strategies to engage and convert." },
      { role: "Development Lead", desc: "Builds robust, secure, and scalable websites." },
      { role: "Front & Backend Developers", desc: "Create seamless, responsive, and user-friendly websites." },
      { role: "Sr. SEO Specialist", desc: "Boosts search engine rankings and online exposure." },
    ],
  },
  {
    question: "Where are the terms & conditions?",
    answer: "Great question. We have a master service agreement (MSA) and a statement of work (SOW). Interestingly, neither of those are in this document. We're happy to provide a copy of our MSA and of course, the SOW for this project once you select an option.",
  },
  {
    question: "The GLIDE Ethos?",
    answer: "Two words. Beauty, and results. Beauty: At GLIDE, we elevate your brand's essence, crafting a compelling story with a timeless, user-centered design approach. Emphasizing simplicity and usability, our award-winning work caters to stakeholders' needs, creating delightful digital experiences. Results: Our focus on results is backed by our commitment to delivering your business objectives. Prioritizing user needs and data-driven insights, we ensure best-practice web development and on-page search optimization.",
  },
  {
    question: "The \u2764\uFE0F of GLIDE?",
    answer: "We believe in the power of purpose to inspire change and encourage action\u2014and we know that beautiful design can make an even more significant impact when paired with a great story.",
    values: [
      "Build meaningful relationships",
      "Love what you do",
      "Get better every day",
      "Deliver faithfully",
      "Enjoy the Journey",
    ],
  },
  {
    question: "Can you tell us about data security and privacy at GLIDE?",
    answer: "At GLIDE, we prioritize data security and adhere to the highest industry standards to protect your data. We are SOC2 compliant and aligning with the US standard for ISO27001.",
    securityBullets: [
      "Regular security training for all personnel",
      "Separate logins for shared and personal devices",
      "Strong, unique passwords for all systems",
      "Secure, encrypted data transfer",
      "Immediate reporting of any data compromises",
    ],
  },
  {
    question: "I have a question or concern about XYZ?",
    answer: "I love questions. And there's a good chance I've answered yours hundreds of times and will have a thoughtful answer that will help you make a better decision. Send me an email, schedule a Zoom call, or just make a comment directly on this document.",
  },
];

interface ProposalFAQProps {
  faqs: { question: string; answer: string }[];
  teamPhotoUrl?: string;
}

export default function ProposalFAQ({ faqs, teamPhotoUrl }: ProposalFAQProps) {
  // Merge AI-generated client-specific FAQs with hardcoded GLIDE FAQs
  const allFaqs = [
    ...(faqs || []).map((f) => ({ ...f, isAI: true })),
    ...GLIDE_FAQS.map((f) => ({ ...f, isAI: false })),
  ];

  if (!allFaqs.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight">
              <span className="font-bold">Common</span>{" "}
              <span className="font-light">Questions</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2">
            <Accordion type="single" collapsible className="w-full">
              {allFaqs.map((faq, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`} className="border-b border-border/40 py-1">
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-muted-foreground/50">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>

                    {/* Team photo for "Who are you?" */}
                    {"hasTeamPhoto" in faq && (faq as any).hasTeamPhoto && (
                      <div className="space-y-3 pt-2">
                        {teamPhotoUrl && (
                          <img
                            src={teamPhotoUrl}
                            alt="The GLIDE Team"
                            className="rounded-lg w-full max-w-lg"
                          />
                        )}
                        <div className="space-y-1">
                          {(faq as any).teamCaption?.map((row: any, i: number) => (
                            <div key={i}>
                              <p className="text-xs font-semibold text-foreground">{row.row}</p>
                              <p className="text-xs text-muted-foreground">{row.names}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team roles for "Can we meet our project team?" */}
                    {"teamRoles" in faq && (faq as any).teamRoles && (
                      <ul className="space-y-2 pt-1">
                        {(faq as any).teamRoles.map((r: any, i: number) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            <strong className="text-foreground">{r.role}:</strong> {r.desc}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Values for "Heart of GLIDE" */}
                    {"values" in faq && (faq as any).values && (
                      <div className="pt-1">
                        <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Our Values</p>
                        <ul className="space-y-1">
                          {(faq as any).values.map((v: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">{v}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Security bullets */}
                    {"securityBullets" in faq && (faq as any).securityBullets && (
                      <ul className="space-y-1 pt-1">
                        {(faq as any).securityBullets.map((b: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
}
