import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Headphones, Check, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCompanyName, normalizeDomain, computeSimilarity, type CompanyRecord } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type FDCompany = {
  id: number;
  name: string;
  domain: string | null;
  domains: string[];
};

type FDMatch = {
  fd: FDCompany;
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
  alreadyLinked: boolean;
};

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/freshdesk-lookup`;
const apiHeaders = {
  'Content-Type': 'application/json',
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

export default function Phase1Freshdesk({ companies, onComplete, onSkip, onRefetch }: Props) {
  const [step, setStep] = useState<'idle' | 'fetching' | 'review' | 'saving' | 'done'>('idle');
  const [fdCompanies, setFdCompanies] = useState<FDCompany[]>([]);
  const [matches, setMatches] = useState<FDMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAndMatch = async () => {
    setStep('fetching');
    setError(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ action: 'companies' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch Freshdesk companies');

      const fds: FDCompany[] = data.companies || [];
      setFdCompanies(fds);

      // Already-linked Freshdesk IDs
      const linkedFDIds = new Set(companies.filter(c => c.freshdesk_company_id).map(c => c.freshdesk_company_id));

      // Match each FD company against existing companies
      const results: FDMatch[] = fds.map(fd => {
        const alreadyLinked = linkedFDIds.has(String(fd.id));
        if (alreadyLinked) {
          const linked = companies.find(c => c.freshdesk_company_id === String(fd.id));
          return {
            fd,
            matchedCompanyId: linked?.id || null,
            matchedCompanyName: linked?.name || null,
            confidence: 'high' as const,
            score: 1,
            alreadyLinked: true,
          };
        }

        // Try domain match
        const fdDomain = normalizeDomain(fd.domain);
        if (fdDomain) {
          const domainMatch = companies.find(c => normalizeDomain(c.domain) === fdDomain);
          if (domainMatch) {
            return { fd, matchedCompanyId: domainMatch.id, matchedCompanyName: domainMatch.name, confidence: 'high' as const, score: 1, alreadyLinked: false };
          }
        }

        // Try name match
        const normFD = normalizeCompanyName(fd.name);
        let best: { id: string; name: string; score: number } | null = null;
        for (const c of companies) {
          const score = computeSimilarity(normFD, normalizeCompanyName(c.name));
          if (score >= 0.75 && (!best || score > best.score)) {
            best = { id: c.id, name: c.name, score };
          }
        }

        return {
          fd,
          matchedCompanyId: best?.id || null,
          matchedCompanyName: best?.name || null,
          confidence: best ? (best.score >= 0.92 ? 'high' : best.score >= 0.82 ? 'medium' : 'low') as any : 'none',
          score: best?.score || 0,
          alreadyLinked: false,
        };
      });

      results.sort((a, b) => {
        if (a.alreadyLinked !== b.alreadyLinked) return a.alreadyLinked ? 1 : -1;
        return b.score - a.score;
      });

      setMatches(results);
      setStep('review');
      toast.success(`Fetched ${fds.length} Freshdesk companies`);
    } catch (err: any) {
      setError(err.message);
      setStep('idle');
      toast.error(err.message);
    }
  };

  const saveMatches = async () => {
    setStep('saving');
    try {
      const toLink = matches.filter(m => !m.alreadyLinked && m.matchedCompanyId && m.confidence !== 'none');
      let linked = 0;

      for (const m of toLink) {
        await supabase
          .from('companies')
          .update({
            freshdesk_company_id: String(m.fd.id),
            freshdesk_company_name: m.fd.name,
          })
          .eq('id', m.matchedCompanyId!);
        linked++;
      }

      toast.success(`Linked ${linked} companies to Freshdesk`);
      setStep('done');
      onRefetch();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
      setStep('review');
    }
  };

  if (step === 'idle') {
    return (
      <Card className="p-8">
        <h2 className="text-lg font-semibold mb-2">Sync Freshdesk Companies</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Pull all companies from Freshdesk and match them against your existing company records. Companies with Freshdesk history are confirmed real clients.
        </p>
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive mb-4">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button onClick={fetchAndMatch}>
            <Headphones className="h-4 w-4 mr-1" />
            Fetch Freshdesk Companies
          </Button>
          <Button variant="outline" onClick={onSkip}>Skip</Button>
        </div>
      </Card>
    );
  }

  if (step === 'fetching') {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
        <p className="text-sm text-muted-foreground">Fetching companies from Freshdesk...</p>
      </Card>
    );
  }

  if (step === 'done') {
    return (
      <Card className="p-8 text-center">
        <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <h2 className="text-lg font-semibold mb-2">Freshdesk Sync Complete</h2>
        <p className="text-sm text-muted-foreground mb-6">{fdCompanies.length} Freshdesk companies processed.</p>
        <Button onClick={onComplete}>Continue to Next Phase</Button>
      </Card>
    );
  }

  // Review
  const newMatches = matches.filter(m => !m.alreadyLinked);
  const linkable = newMatches.filter(m => m.confidence !== 'none');
  const unmatched = newMatches.filter(m => m.confidence === 'none');
  const alreadyLinked = matches.filter(m => m.alreadyLinked);

  return (
    <Card className="p-8">
      <h2 className="text-lg font-semibold mb-2">Review Freshdesk Matches</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {fdCompanies.length} Freshdesk companies found.
        <span className="text-green-600 ml-2">{alreadyLinked.length} already linked</span>
        <span className="text-primary ml-2">{linkable.length} new matches</span>
        <span className="text-muted-foreground ml-2">{unmatched.length} unmatched</span>
      </p>

      <div className="overflow-y-auto max-h-[500px] rounded-lg border border-border mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-[30%]">Freshdesk Company</TableHead>
              <TableHead className="text-xs w-[30%]">Matched Company</TableHead>
              <TableHead className="text-xs">Domain</TableHead>
              <TableHead className="text-xs">Confidence</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {newMatches.map((m, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm font-medium py-2">{m.fd.name}</TableCell>
                <TableCell className="text-sm py-2">
                  {m.matchedCompanyName || <span className="text-muted-foreground italic">No match</span>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-2">{m.fd.domain || '-'}</TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className={`text-[10px] py-0 ${
                    m.confidence === 'high' ? 'text-green-600 border-green-500/30 bg-green-500/10' :
                    m.confidence === 'medium' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                    m.confidence === 'low' ? 'text-orange-500 border-orange-500/30 bg-orange-500/10' :
                    'text-muted-foreground'
                  }`}>
                    {m.confidence === 'none' ? 'unmatched' : `${Math.round(m.score * 100)}%`}
                  </Badge>
                </TableCell>
                <TableCell className="py-2">
                  <Badge variant="outline" className="text-[10px] py-0 text-primary border-primary/30">New</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={saveMatches} disabled={step === 'saving'}>
          {step === 'saving' ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Link {linkable.length} Matches
        </Button>
        <Button variant="outline" onClick={onSkip}>Skip</Button>
      </div>
    </Card>
  );
}
