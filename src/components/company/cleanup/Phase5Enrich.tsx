import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Check, Loader2, FileEdit, Globe, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { type CompanyRecord, looksLikeDomain, normalizeDomain } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  urlAsName: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocean-enrich`;
const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export default function Phase5Enrich({ companies, urlAsName, onComplete, onSkip, onRefetch }: Props) {
  const [step, setStep] = useState<'overview' | 'fixing' | 'enriching' | 'normalizing' | 'done'>('overview');
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  // Companies that can have their name fixed from existing enrichment data
  const fixableFromData = useMemo(() => {
    return urlAsName.filter(c => {
      const apolloName = c.enrichment_data?.apollo_org?.organizationName;
      const oceanName = c.enrichment_data?.ocean?.companyName;
      return apolloName || oceanName;
    });
  }, [urlAsName]);

  const needsOceanForName = useMemo(() => {
    return urlAsName.filter(c => {
      const apolloName = c.enrichment_data?.apollo_org?.organizationName;
      const oceanName = c.enrichment_data?.ocean?.companyName;
      return !apolloName && !oceanName;
    });
  }, [urlAsName]);

  // Companies that need Ocean.io enrichment (non-archived, have domain, no ocean data)
  const needsEnrichment = useMemo(() => {
    return companies.filter(c =>
      c.status !== 'archived' &&
      normalizeDomain(c.domain) &&
      (!c.enrichment_data?.ocean)
    );
  }, [companies]);

  // Companies with un-normalized domains
  const needsNormalization = useMemo(() => {
    return companies.filter(c => {
      if (!c.domain) return false;
      const norm = normalizeDomain(c.domain);
      return norm && norm !== c.domain;
    });
  }, [companies]);

  const fixUrlNames = async () => {
    setStep('fixing');
    setProgressTotal(fixableFromData.length);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let fixed = 0;
      for (const c of fixableFromData) {
        const newName = c.enrichment_data?.apollo_org?.organizationName ||
                        c.enrichment_data?.ocean?.companyName;
        if (newName && newName !== c.name) {
          await supabase.from('companies').update({ name: newName }).eq('id', c.id);

          await supabase.from('company_cleanup_log').insert({
            user_id: user.id,
            phase: 'enrich',
            action: 'fix_url_name',
            target_id: c.id,
            details: { oldName: c.name, newName },
          });
          fixed++;
        }
        setProgress(prev => prev + 1);
        setProgressLabel(`Fixed ${fixed} of ${fixableFromData.length} names`);
      }

      toast.success(`Fixed ${fixed} company names from existing enrichment data`);
      onRefetch();
      setStep('overview');
    } catch (err: any) {
      toast.error(`Fix failed: ${err.message}`);
      setStep('overview');
    }
  };

  const normalizeDomains = async () => {
    setStep('normalizing');
    setProgressTotal(needsNormalization.length);
    setProgress(0);

    try {
      let fixed = 0;
      for (const c of needsNormalization) {
        const norm = normalizeDomain(c.domain)!;
        await supabase.from('companies').update({
          domain: norm,
          website_url: norm,
        }).eq('id', c.id);
        fixed++;
        setProgress(prev => prev + 1);
        setProgressLabel(`Normalized ${fixed} of ${needsNormalization.length} domains`);
      }

      toast.success(`Normalized ${fixed} domains`);
      onRefetch();
      setStep('overview');
    } catch (err: any) {
      toast.error(`Normalize failed: ${err.message}`);
      setStep('overview');
    }
  };

  const bulkEnrich = async () => {
    setStep('enriching');
    const batch = needsEnrichment.slice(0, 50); // Cap at 50 to control costs
    setProgressTotal(batch.length);
    setProgress(0);

    try {
      let enriched = 0;
      let failed = 0;

      for (const c of batch) {
        const domain = normalizeDomain(c.domain);
        if (!domain) { setProgress(p => p + 1); continue; }

        try {
          const res = await fetch(API_URL, {
            method: 'POST',
            headers: apiHeaders,
            body: JSON.stringify({ domain }),
          });
          const data = await res.json();

          if (data.success) {
            const oceanData = {
              companyName: data.companyName,
              companySize: data.companySize,
              revenue: data.revenue,
              yearFounded: data.yearFounded,
              industries: data.industries,
              technologies: data.technologies,
              departmentSizes: data.departmentSizes,
              webTraffic: data.webTraffic,
              locations: data.locations,
              keywords: data.keywords,
            };

            const existing = c.enrichment_data || {};
            await supabase.from('companies').update({
              enrichment_data: { ...existing, ocean: oceanData },
              ...(looksLikeDomain(c.name) && data.companyName ? { name: data.companyName } : {}),
            }).eq('id', c.id);
            enriched++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        setProgress(p => p + 1);
        setProgressLabel(`Enriched ${enriched}, failed ${failed} of ${batch.length}`);

        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 200));
      }

      toast.success(`Enriched ${enriched} companies (${failed} failed)`);
      onRefetch();
      setStep('overview');
    } catch (err: any) {
      toast.error(`Enrichment failed: ${err.message}`);
      setStep('overview');
    }
  };

  if (step === 'done') {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">Enrichment Complete</h2>
        <p className="text-sm text-muted-foreground mb-6">Your company data is clean and enriched.</p>
        <Button onClick={onComplete}>Finish Cleanup</Button>
      </Card>
    );
  }

  if (step !== 'overview') {
    return (
      <Card className="p-8">
        <h2 className="text-lg font-semibold mb-2">
          {step === 'fixing' ? 'Fixing URL Names...' :
           step === 'enriching' ? 'Enriching with Ocean.io...' :
           'Normalizing Domains...'}
        </h2>
        <Progress value={progressTotal > 0 ? (progress / progressTotal) * 100 : 0} className="mb-3" />
        <p className="text-sm text-muted-foreground">{progressLabel || `${progress} of ${progressTotal}`}</p>
      </Card>
    );
  }

  // Overview
  const estimatedCost = Math.ceil(needsEnrichment.length * 0.08); // ~$0.08 per lookup

  return (
    <Card className="p-8">
      <h2 className="text-lg font-semibold mb-1">Enrich & Normalize</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Clean up company names, normalize domains, and enrich with Ocean.io data.
      </p>

      <div className="space-y-4 mb-6">
        {/* Fix URL-as-name */}
        <Card className="p-4 border-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileEdit className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Fix URL-as-Name Companies</span>
                <Badge variant="outline" className="text-[10px] py-0 text-amber-500 border-amber-500/30">{urlAsName.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {fixableFromData.length} can be fixed from existing enrichment data.
                {needsOceanForName.length > 0 && ` ${needsOceanForName.length} need Ocean.io lookup.`}
              </p>
            </div>
            <Button size="sm" onClick={fixUrlNames} disabled={fixableFromData.length === 0}>
              Fix {fixableFromData.length} Names
            </Button>
          </div>
        </Card>

        {/* Normalize domains */}
        <Card className="p-4 border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Normalize Domains</span>
                <Badge variant="outline" className="text-[10px] py-0 text-blue-500 border-blue-500/30">{needsNormalization.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Strip www, lowercase, remove trailing slashes.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={normalizeDomains} disabled={needsNormalization.length === 0}>
              Normalize
            </Button>
          </div>
        </Card>

        {/* Bulk Ocean.io enrichment */}
        <Card className="p-4 border-cyan-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium">Bulk Ocean.io Enrichment</span>
                <Badge variant="outline" className="text-[10px] py-0 text-cyan-500 border-cyan-500/30">{needsEnrichment.length}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {needsEnrichment.length} companies need Ocean.io data. Estimated cost: ~${estimatedCost}.
                {needsEnrichment.length > 50 && ' Will process first 50.'}
              </p>
            </div>
            <Button size="sm" onClick={bulkEnrich} disabled={needsEnrichment.length === 0}>
              Enrich {Math.min(needsEnrichment.length, 50)}
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => setStep('done')}>
          <Check className="h-4 w-4 mr-1" />
          Finish Cleanup
        </Button>
        <Button variant="outline" onClick={onSkip}>Skip</Button>
      </div>
    </Card>
  );
}
