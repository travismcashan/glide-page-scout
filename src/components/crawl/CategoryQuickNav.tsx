import { useEffect, useRef, useState } from 'react';
import { type OverallScore, gradeToColor } from '@/lib/siteScore';
import { Shield, Search, Accessibility, FileText, Zap, Link, Code } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  performance: <Zap className="h-3.5 w-3.5" />,
  seo: <Search className="h-3.5 w-3.5" />,
  accessibility: <Accessibility className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  'content-ux': <FileText className="h-3.5 w-3.5" />,
  'url-health': <Link className="h-3.5 w-3.5" />,
};

// Map category keys to CollapsibleSection DOM ids
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
  { key: 'tech', label: 'Technology', sectionId: 'section-tech-detection', icon: <Code className="h-3.5 w-3.5" /> },
];

type Props = {
  overallScore: OverallScore | null;
  analyzing?: boolean;
};

export function CategoryQuickNav({ overallScore, analyzing }: Props) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // All section IDs for observation
  const allSectionIds = [
    ...Object.values(CATEGORY_TO_SECTION),
    ...UNSCORED_SECTIONS.map(s => s.sectionId),
  ];

  // Track which section is in viewport via IntersectionObserver on DOM ids
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -50% 0px', threshold: 0 }
    );

    // Observe each section by its DOM id
    for (const id of allSectionIds) {
      const el = document.getElementById(id);
      if (el) observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
  }, [overallScore]);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
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
