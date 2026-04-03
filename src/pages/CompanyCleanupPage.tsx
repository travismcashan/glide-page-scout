import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2 } from 'lucide-react';
import AppHeader from '@/components/AppHeader';
import CleanupStepper, { type PhaseStatus } from '@/components/company/cleanup/CleanupStepper';
import { useCleanupAnalysis } from '@/components/company/cleanup/useCleanupAnalysis';
import { BrandLoader } from '@/components/BrandLoader';
import Phase0Map from '@/components/company/cleanup/Phase0Map';
import Phase2Deduplicate from '@/components/company/cleanup/Phase2Deduplicate';
import Phase4Validate from '@/components/company/cleanup/Phase4Validate';
import Phase5Enrich from '@/components/company/cleanup/Phase5Enrich';

export default function CompanyCleanupPage() {
  const navigate = useNavigate();
  const analysis = useCleanupAnalysis();
  const [activePhase, setActivePhase] = useState(0);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([
    'active', 'pending', 'pending', 'pending',
  ]);

  const completePhase = (phase: number) => {
    setPhaseStatuses(prev => {
      const next = [...prev];
      next[phase] = 'complete';
      if (phase + 1 < next.length) next[phase + 1] = 'active';
      return next;
    });
    if (phase + 1 < 4) setActivePhase(phase + 1);
  };

  const skipPhase = (phase: number) => {
    setPhaseStatuses(prev => {
      const next = [...prev];
      next[phase] = 'skipped';
      if (phase + 1 < next.length) next[phase + 1] = 'active';
      return next;
    });
    if (phase + 1 < 4) setActivePhase(phase + 1);
  };

  const phaseCounts = [
    analysis.unlinkedHarvest.length + analysis.unlinkedFreshdesk.length + analysis.unlinkedAsana.length, // Phase 0: Map
    analysis.duplicates.length, // Phase 1: Deduplicate
    analysis.missingDomain.length, // Phase 2: Validate
    analysis.urlAsName.length + analysis.missingEnrichment.length, // Phase 3: Enrich
  ];

  if (analysis.loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/companies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Company Cleanup</h1>
              <Badge variant="outline" className="text-xs">
                {analysis.stats.total} companies
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Map sources, deduplicate, validate, and enrich your company data.
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <Card className="p-4 mb-6">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{analysis.stats.total}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">HubSpot: <span className="text-foreground font-medium">{analysis.stats.withHubspot}</span></span>
            <span className="text-muted-foreground">Harvest: <span className="text-foreground font-medium">{analysis.stats.withHarvest}</span></span>
            <span className="text-muted-foreground">Freshdesk: <span className="text-foreground font-medium">{analysis.stats.withFreshdesk}</span></span>
            <span className="text-muted-foreground">QuickBooks: <span className="text-foreground font-medium">{analysis.stats.withQuickbooks}</span></span>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">Duplicates: <span className="text-amber-500 font-medium">{analysis.stats.duplicateGroups}</span></span>
            <span className="text-muted-foreground">URL-as-name: <span className="text-amber-500 font-medium">{analysis.stats.urlAsNameCount}</span></span>
          </div>
        </Card>

        {/* Stepper */}
        <CleanupStepper
          activePhase={activePhase}
          phaseStatuses={phaseStatuses}
          phaseCounts={phaseCounts}
          onPhaseClick={setActivePhase}
        />

        {/* Active Phase Content */}
        <div className="min-h-[400px]">
          {activePhase === 0 && (
            <Phase0Map
              companies={analysis.companies}
              onComplete={() => completePhase(0)}
              onSkip={() => skipPhase(0)}
              onRefetch={analysis.refetch}
            />
          )}
          {activePhase === 1 && (
            <Phase2Deduplicate
              duplicates={analysis.duplicates}
              onComplete={() => completePhase(1)}
              onSkip={() => skipPhase(1)}
              onRefetch={analysis.refetch}
            />
          )}
          {activePhase === 2 && (
            <Phase4Validate
              companies={analysis.companies}
              onComplete={() => completePhase(2)}
              onSkip={() => skipPhase(2)}
              onRefetch={analysis.refetch}
            />
          )}
          {activePhase === 3 && (
            <Phase5Enrich
              companies={analysis.companies}
              urlAsName={analysis.urlAsName}
              onComplete={() => completePhase(3)}
              onSkip={() => skipPhase(3)}
              onRefetch={analysis.refetch}
            />
          )}
        </div>
      </main>
    </div>
  );
}
