import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Check, X, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCompanyName, normalizeDomain, computeSimilarity, type CompanyRecord } from '@/lib/companyNormalization';

type Props = {
  companies: CompanyRecord[];
  onComplete: () => void;
  onSkip: () => void;
  onRefetch: () => void;
};

type ParsedRow = Record<string, string>;

type ColumnMapping = {
  clientName: string;
  invoiceTotal?: string;
  invoiceCount?: string;
  firstDate?: string;
  lastDate?: string;
};

type MatchedQBClient = {
  qbName: string;
  invoiceSummary: {
    total?: number;
    count?: number;
    firstDate?: string;
    lastDate?: string;
  };
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
};

const AUTO_MAP_HINTS: Record<keyof ColumnMapping, string[]> = {
  clientName: ['customer', 'client', 'company', 'name', 'client name', 'customer name', 'company name'],
  invoiceTotal: ['total', 'amount', 'revenue', 'sum', 'invoice total', 'total amount'],
  invoiceCount: ['count', 'invoices', 'qty', 'quantity', 'invoice count', 'num invoices', 'number'],
  firstDate: ['first', 'start', 'first date', 'earliest', 'from'],
  lastDate: ['last', 'end', 'last date', 'latest', 'to', 'most recent'],
};

function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: any = {};
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  for (const [field, hints] of Object.entries(AUTO_MAP_HINTS)) {
    for (const hint of hints) {
      const idx = lowerHeaders.findIndex(h => h === hint || h.includes(hint));
      if (idx >= 0 && !Object.values(mapping).includes(headers[idx])) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

function matchQBClients(qbNames: string[], invoiceData: Map<string, any>, companies: CompanyRecord[]): MatchedQBClient[] {
  return qbNames.map(qbName => {
    const normQB = normalizeCompanyName(qbName);
    let bestMatch: { id: string; name: string; score: number } | null = null;

    for (const c of companies) {
      const normC = normalizeCompanyName(c.name);
      if (normQB === normC) {
        bestMatch = { id: c.id, name: c.name, score: 1 };
        break;
      }
      const score = computeSimilarity(normQB, normC);
      if (score >= 0.75 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { id: c.id, name: c.name, score };
      }
    }

    const summary = invoiceData.get(qbName) || {};

    return {
      qbName,
      invoiceSummary: summary,
      matchedCompanyId: bestMatch?.id || null,
      matchedCompanyName: bestMatch?.name || null,
      confidence: bestMatch
        ? bestMatch.score >= 0.95 ? 'high' : bestMatch.score >= 0.82 ? 'medium' : 'low'
        : 'none',
      score: bestMatch?.score || 0,
    };
  });
}

export default function Phase0Import({ companies, onComplete, onSkip, onRefetch }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ clientName: '' });
  const [matches, setMatches] = useState<MatchedQBClient[]>([]);
  const [saving, setSaving] = useState(false);

  const parseCSV = useCallback((text: string) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

    // Simple CSV parser (handles quoted fields)
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
        current += ch;
      }
      result.push(current.trim());
      return result;
    };

    const hdrs = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const vals = parseLine(line);
      const row: ParsedRow = {};
      hdrs.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    }).filter(row => Object.values(row).some(v => v));

    setHeaders(hdrs);
    setRawData(rows);
    setMapping(autoMapColumns(hdrs));
    setStep('map');
    toast.success(`Parsed ${rows.length} rows with ${hdrs.length} columns`);
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { toast.error('Please upload a CSV file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target?.result as string);
    reader.readAsText(file);
  }, [parseCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const runMatching = () => {
    if (!mapping.clientName) { toast.error('Please map the client name column'); return; }

    // Build invoice summary per client
    const invoiceData = new Map<string, any>();
    const clientNames = new Set<string>();

    for (const row of rawData) {
      const name = row[mapping.clientName];
      if (!name) continue;
      clientNames.add(name);

      const existing = invoiceData.get(name) || { total: 0, count: 0 };
      if (mapping.invoiceTotal) {
        const val = parseFloat(row[mapping.invoiceTotal]?.replace(/[$,]/g, '') || '0');
        if (!isNaN(val)) existing.total += val;
      }
      existing.count++;
      if (mapping.firstDate && row[mapping.firstDate]) {
        if (!existing.firstDate || row[mapping.firstDate] < existing.firstDate) {
          existing.firstDate = row[mapping.firstDate];
        }
      }
      if (mapping.lastDate && row[mapping.lastDate]) {
        if (!existing.lastDate || row[mapping.lastDate] > existing.lastDate) {
          existing.lastDate = row[mapping.lastDate];
        }
      }
      invoiceData.set(name, existing);
    }

    const matched = matchQBClients(Array.from(clientNames), invoiceData, companies);
    matched.sort((a, b) => b.score - a.score);
    setMatches(matched);
    setStep('review');
  };

  const saveMatches = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let linked = 0;
      let created = 0;

      for (const m of matches) {
        if (m.matchedCompanyId && m.confidence !== 'none') {
          // Update existing company with QuickBooks data
          await supabase
            .from('companies')
            .update({
              quickbooks_client_name: m.qbName,
              quickbooks_invoice_summary: m.invoiceSummary,
            })
            .eq('id', m.matchedCompanyId);
          linked++;
        }
      }

      toast.success(`Linked ${linked} companies to QuickBooks data`);
      setStep('done');
      onRefetch();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Upload Step ──
  if (step === 'upload') {
    return (
      <Card className="p-8">
        <h2 className="text-lg font-semibold mb-2">Import QuickBooks History</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Export a CSV of all clients and invoices from QuickBooks Online. This establishes invoicing history as a "real client" signal for validation.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">Drop a CSV file here or click to browse</p>
          <p className="text-xs text-muted-foreground">QuickBooks export with client names and invoice data</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }} />
        </div>

        <div className="flex items-center gap-3 mt-6">
          <Button variant="outline" onClick={onSkip}>Skip this step</Button>
        </div>
      </Card>
    );
  }

  // ── Column Mapping Step ──
  if (step === 'map') {
    return (
      <Card className="p-8">
        <h2 className="text-lg font-semibold mb-2">Map Columns</h2>
        <p className="text-sm text-muted-foreground mb-6">
          We detected {headers.length} columns and {rawData.length} rows. Map the columns to the right fields.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {(['clientName', 'invoiceTotal', 'invoiceCount', 'firstDate', 'lastDate'] as const).map(field => (
            <div key={field}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {field === 'clientName' ? 'Client Name *' :
                 field === 'invoiceTotal' ? 'Invoice Total' :
                 field === 'invoiceCount' ? 'Invoice Count' :
                 field === 'firstDate' ? 'First Invoice Date' :
                 'Last Invoice Date'}
              </label>
              <Select
                value={(mapping as any)[field] || '__none__'}
                onValueChange={(v) => setMapping(prev => ({ ...prev, [field]: v === '__none__' ? undefined : v }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-- Not mapped --</SelectItem>
                  {headers.map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Preview first 5 rows */}
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows)</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 6).map(h => (
                    <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawData.slice(0, 5).map((row, i) => (
                  <TableRow key={i}>
                    {headers.slice(0, 6).map(h => (
                      <TableCell key={h} className="text-xs py-2">{row[h]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={runMatching} disabled={!mapping.clientName}>
            <ArrowRight className="h-4 w-4 mr-1" />
            Match Against Companies
          </Button>
          <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
          <Button variant="outline" onClick={onSkip}>Skip</Button>
        </div>
      </Card>
    );
  }

  // ── Review Matches Step ──
  if (step === 'review') {
    const highMatches = matches.filter(m => m.confidence === 'high');
    const medMatches = matches.filter(m => m.confidence === 'medium');
    const lowMatches = matches.filter(m => m.confidence === 'low');
    const noMatches = matches.filter(m => m.confidence === 'none');

    return (
      <Card className="p-8">
        <h2 className="text-lg font-semibold mb-2">Review Matches</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Found {matches.length} unique QuickBooks clients.
          <span className="text-green-600 ml-2">{highMatches.length} high</span>
          <span className="text-amber-500 ml-2">{medMatches.length} medium</span>
          <span className="text-orange-500 ml-2">{lowMatches.length} low</span>
          <span className="text-muted-foreground ml-2">{noMatches.length} unmatched</span>
        </p>

        <div className="overflow-y-auto max-h-[500px] rounded-lg border border-border mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-[30%]">QuickBooks Client</TableHead>
                <TableHead className="text-xs w-[30%]">Matched Company</TableHead>
                <TableHead className="text-xs text-right">Invoices</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium py-2">{m.qbName}</TableCell>
                  <TableCell className="text-sm py-2">
                    {m.matchedCompanyName || <span className="text-muted-foreground italic">No match</span>}
                  </TableCell>
                  <TableCell className="text-sm text-right py-2 tabular-nums">
                    {m.invoiceSummary.count || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-right py-2 tabular-nums">
                    {m.invoiceSummary.total
                      ? `$${m.invoiceSummary.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      : '-'}
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 ${
                        m.confidence === 'high' ? 'text-green-600 border-green-500/30 bg-green-500/10' :
                        m.confidence === 'medium' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' :
                        m.confidence === 'low' ? 'text-orange-500 border-orange-500/30 bg-orange-500/10' :
                        'text-muted-foreground'
                      }`}
                    >
                      {m.confidence === 'none' ? 'unmatched' : `${Math.round(m.score * 100)}%`}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveMatches} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Save {highMatches.length + medMatches.length} High/Medium Matches
          </Button>
          <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
          <Button variant="outline" onClick={onSkip}>Skip</Button>
        </div>
      </Card>
    );
  }

  // ── Done ──
  return (
    <Card className="p-8 text-center">
      <Check className="h-10 w-10 text-green-600 mx-auto mb-3" />
      <h2 className="text-lg font-semibold mb-2">QuickBooks Import Complete</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Invoice history has been linked to your companies.
      </p>
      <Button onClick={onComplete}>Continue to Next Phase</Button>
    </Card>
  );
}
