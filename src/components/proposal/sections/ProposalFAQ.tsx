import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ProposalFAQProps {
  faqs: { question: string; answer: string }[];
}

export default function ProposalFAQ({ faqs }: ProposalFAQProps) {
  if (!faqs?.length) return null;

  return (
    <section className="py-20 px-8 lg:px-16 bg-white dark:bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-3">
            <h2 className="text-4xl md:text-5xl text-foreground tracking-tight mb-4">
              <span className="font-bold">Common</span>{" "}
              <span className="font-light">Questions</span>
            </h2>
            <hr className="border-t-2 border-foreground mt-8" />
          </div>

          <div className="hidden lg:block lg:col-span-1" />
          <div className="lg:col-span-2">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, idx) => (
                <AccordionItem key={idx} value={`faq-${idx}`} className="border-b border-border/40 py-1">
                  <AccordionTrigger className="py-5 text-left text-base font-semibold text-foreground hover:no-underline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-muted-foreground/50">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5">
                    <p className="text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
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
