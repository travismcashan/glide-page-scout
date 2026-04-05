import { useEffect, useRef, useState } from 'react';
import { type OverallScore, type CategoryScore, gradeToColor } from '@/lib/siteScore';
import { Shield, Search, Accessibility, FileText, Zap, Link, Layers, Code } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="h-3.5 w-3.5" />,
  seo: <Search className="h-3.5 w-3.5" />,
  accessibility: <Accessibility className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  'content-ux': <FileText className="h-3.5 w-3.5" />,
  'url-health': <Link className="h-3.5 w-3.5" />,
};

// Map category keys to section IDs in the DOM
const CATEGORY_TO_SECTION: Record<string, string> = {
  'performance': 'section-performance',
  'seo': 'section-seo',
  'content-ux': 'section-content-analysis',
  'accessibility': 'section-ux-accessibility',
  'security': 'section-security',
  'url-health': 'section-url-analysis',
};

// Unscored sections
const UNSCORED_SECTIONS = [
  { key: 'design', label: 'Design', sectionId: 'section-design-analysis', icon: <Layers className="h-3.5 w-3.5" /> },
  { key: 'tech', label: 'Technology', sectionId: 'section-tech-detection', icon: <Code className="h-3.5 w-3.5" /> },
];

type Props = {
  overallScore: OverallScore | null;
  analyzing?: boolean;
};

export function CategoryQuickNav({ overallScore, analyzing }: Props) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track which section is in viewport
  useEffect(() => {
    const allSectionIds = [
      ...Object.values(CATEGORY_TO_SECTION),
      ...UNSCORED_SECTIONS.map(s => s.sectionId),
    ];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // Find the button element's closest collapsible section
            const el = entry.target as HTMLElement;
            const sectionId = allSectionIds.find(id => {
              const sectionEl = document.querySelector(`[class*="${id}"]`) || el;
              return sectionEl === el;
            });
            if (sectionId) setActiveSection(sectionId);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    // Observe section headings by looking for CollapsibleSection buttons
    const headings = document.querySelectorAll('button:has(> h2)');
    headings.forEach(h => observerRef.current?.observe(h));

    return () => observerRef.current?.disconnect();
  }, [overallScore]);

  const scrollToSection = (sectionId: string) => {
    // Find the heading button for this section
    const headings = document.querySelectorAll('button:has(> h2)');
    for (const h of headings) {
      const parent = h.closest('div');
      if (parent) {
        // Check if this section's collapse toggle matches
        const heading = h.querySelector('h2');
        if (heading) {
          const text = heading.textContent || '';
          const matchMap: Record<string, string[]> = {
            'section-performance': ['Performance'],
            'section-seo': ['SEO'],
            'section-content-analysis': ['Content'],
            'section-ux-accessibility': ['Accessibility', 'UX'],
            'section-security': ['Security'],
            'section-url-analysis': ['URL Analysis'],
            'section-design-analysis': ['Design'],
            'section-tech-detection': ['Technology'],
          };
          const patterns = matchMap[sectionId] || [];
          if (patterns.some(p => text.includes(p))) {
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(sectionId);
            return;
          }
        }
      }
    }
  };

  const categories = overallScore?.categories || [];

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 -mx-6 px-6 py-2 mb-6">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {categories.map((cat) => {
          const sectionId = CATEGORY_TO_SECTION[cat.key];
          const isActive = activeSection === sectionId;
          return (
            <button
              key={cat.key}
              onClick={() => scrollToSection(sectionId)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0
                ${isActive
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                }`}
            >
              <span className="text-muted-foreground">{CATEGORY_ICONS[cat.key]}</span>
              <span>{cat.label}</span>
              <span className={`font-bold ${gradeToColor(cat.grade)}`}>{cat.grade}</span>
            </button>
          );
        })}

        {categories.length > 0 && UNSCORED_SECTIONS.length > 0 && (
          <div className="w-px h-4 bg-border/50 mx-1 shrink-0" />
        )}

        {UNSCORED_SECTIONS.map((sec) => (
          <button
            key={sec.key}
            onClick={() => scrollToSection(sec.sectionId)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0
              ${activeSection === sec.sectionId
                ? 'bg-muted text-foreground border border-border'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 border border-transparent'
              }`}
          >
            <span>{sec.icon}</span>
            <span>{sec.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
