import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2 } from 'lucide-react';
import CleanupStepper, { type PhaseStatus } from '@/components/company/cleanup/CleanupStepper';
import { useCleanupAnalysis } from '@/components/company/cleanup/useCleanupAnalysis';
import { BrandLoader } from '@/components/BrandLoader';
import Phase2Deduplicate from '@/components/company/cleanup/Phase2Deduplicate';
import Phase4Validate from '@/components/company/cleanup/Phase4Validate';
import Phase5Enrich from '@/components/company/cleanup/Phase5Enrich';

export default function CompanyCleanupPage() {
  const navigate = useNavigate();
  const analysis = useCleanupAnalysis();
  const [activePhase, setActivePhase] = useState(0);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([
    'active', 'pending', 'pending',
  ]);

  const completePhase = (phase: number) => {
    setPhaseStatuses(prev => {
      const next = [...prev];
      next[phase] = 'complete';
      if (phase + 1 < next.length) next[phase + 1] = 'active';
      return next;
    });
    if (phase + 1 < 3) setActivePhase(phase + 1);
  };

  const skipPhase = (phase: number) => {
    setPhaseStatuses(prev => {
      const next = [...prev];
      next[phase] = 'skipped';
      if (phase + 1 < next.length) next[phase + 1] = 'active';
      return next;
    });
    if (phase + 1 < 3) setActivePhase(phase + 1);
  };

  const phaseCounts = [
    analysis.duplicates.length,
    analysis.missingDomain.length,
    analysis.urlAsName.length + analysis.missingEnrichment.length,
  ];

  if (analysis.loading) {
    return (
      <div>
        <main className="px-4 sm:px-6 py-6">
          <div className="flex items-center justify-center py-20">
            <BrandLoader size={48} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <main className="px-4 sm:px-6 py-6">
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
              Deduplicate, validate, and enrich your company data.
            </p>
          </div>
        </div>

        <Card className="p-4 mb-6">
          <div className="flex items-center gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{analysis.stats.total}</span>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-muted-foreground">Duplicates: <span className="text-amber-500 font-medium">{analysis.stats.duplicateGroups}</span></span>
            <span className="text-muted-foreground">URL-as-name: <span className="text-amber-500 font-medium">{analysis.stats.urlAsNameCount}</span></span>
          </div>
        </Card>

        <CleanupStepper
          activePhase={activePhase}
          phaseStatuses={phaseStatuses}
          phaseCounts={phaseCounts}
          onPhaseClick={setActivePhase}
        />

        <div className="min-h-[400px]">
          {activePhase === 0 && (
            <Phase2Deduplicate
              duplicates={analysis.duplicates}
              onComplete={() => completePhase(0)}
              onSkip={() => skipPhase(0)}
              onRefetch={analysis.refetch}
            />
          )}
          {activePhase === 1 && (
            <Phase4Validate
              companies={analysis.companies}
              onComplete={() => completePhase(1)}
              onSkip={() => skipPhase(1)}
              onRefetch={analysis.refetch}
            />
          )}
          {activePhase === 2 && (
            <Phase5Enrich
              companies={analysis.companies}
              urlAsName={analysis.urlAsName}
              onComplete={() => completePhase(2)}
              onSkip={() => skipPhase(2)}
              onRefetch={analysis.refetch}
            />
          )}
        </div>
      </main>
    </div>
  );
}
