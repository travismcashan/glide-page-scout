import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle2, Circle, Plug, Search, BarChart3, ScrollText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanies } from '@/hooks/useCompanies';
import { useSessions } from '@/hooks/useCachedQueries';

const DISMISSED_KEY = 'onboarding-banner-dismissed';

const STEPS = [
  {
    key: 'hubspot',
    label: 'Connect HubSpot',
    description: 'Sync your CRM to populate companies, deals, and contacts',
    href: '/settings?tab=integrations',
    icon: Plug,
  },
  {
    key: 'crawl',
    label: 'Run your first crawl',
    description: 'Audit a website to see performance, SEO, and accessibility scores',
    href: '/crawls',
    icon: Search,
  },
  {
    key: 'pipeline',
    label: 'Explore your pipeline',
    description: 'View leads and deals flowing through your sales process',
    href: '/leads',
    icon: BarChart3,
  },
  {
    key: 'plans',
    label: 'Review plans',
    description: 'Browse the plan inventory for implementation ideas',
    href: '/plans',
    icon: ScrollText,
  },
];

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');
  const { companies, loading: companiesLoading } = useCompanies();
  const { sessions, loading: sessionsLoading } = useSessions();

  if (dismissed || companiesLoading || sessionsLoading) return null;

  // Only show when user has very little data
  const hasEnoughCompanies = companies.length >= 5;
  const hasCrawls = sessions.length > 0;
  if (hasEnoughCompanies && hasCrawls) return null;

  // Determine which steps are "done"
  const completed: Record<string, boolean> = {
    hubspot: hasEnoughCompanies,
    crawl: hasCrawls,
    pipeline: hasEnoughCompanies, // pipeline populated via HubSpot sync
    plans: false, // always available to explore
  };

  const completedCount = Object.values(completed).filter(Boolean).length;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="mx-4 mt-4 mb-2 rounded-lg border border-primary/20 bg-primary/5 p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Welcome to Ascend</h3>
        <span className="text-xs text-muted-foreground ml-auto mr-8">
          {completedCount}/{STEPS.length} complete
        </span>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Get started by completing these steps to unlock the full power of the platform.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STEPS.map((step) => {
          const done = completed[step.key];
          const Icon = step.icon;
          return (
            <Link
              key={step.key}
              to={step.href}
              className={`flex items-start gap-3 rounded-md border p-3 transition-colors text-left
                ${done
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border hover:border-primary/30 hover:bg-primary/5'
                }`}
            >
              <div className="mt-0.5 shrink-0">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>
                    {step.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
