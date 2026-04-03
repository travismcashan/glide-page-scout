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
  date?: string;
  transactionType?: string;
  memo?: string;
  amount?: string;
  productService?: string;
  salesPrice?: string;
};

type MatchedQBClient = {
  qbName: string;
  invoiceSummary: {
    total?: number;
    count?: number;
    firstDate?: string;
    lastDate?: string;
    transactionTypes?: Record<string, number>;
    hasSupportTickets?: boolean;
    sampleMemos?: string[];
    services?: Record<string, { count: number; total: number }>;
  };
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  score: number;
};

const AUTO_MAP_HINTS: Record<keyof ColumnMapping, string[]> = {
  clientName: ['client name', 'customer', 'client', 'company', 'name', 'customer name', 'company name'],
  invoiceTotal: ['income', 'total', 'revenue', 'sum', 'invoice total', 'total amount', 'net income'],
  invoiceCount: ['count', 'invoices', 'qty', 'quantity', 'invoice count', 'num invoices', 'number'],
  date: ['date', 'invoice date', 'transaction date', 'created'],
  transactionType: ['transaction type', 'type', 'trans type'],
  memo: ['memo', 'description', 'notes', 'detail', 'memo/description'],
  amount: ['amount', 'debit', 'credit'],
  productService: ['product/service', 'product service', 'product/service full name', 'item', 'service', 'product'],
  salesPrice: ['sales price', 'price', 'rate', 'unit price'],
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

type UploadedFile = { name: string; rows: ParsedRow[]; headers: string[] };

export default function Phase0Import({ companies, onComplete, onSkip, onRefetch }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({ clientName: '' });
  const [matches, setMatches] = useState<MatchedQBClient[]>([]);
  const [saving, setSaving] = useState(false);

  const parseCSV = useCallback((text: string) => {
    const allLines = text.split('\n');
    if (allLines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

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

    // QuickBooks CSVs have metadata rows before the actual headers.
    // Detect header row: first row with 2+ non-empty comma-separated values
    // that looks like column labels (not a report title or company name).
    let headerIdx = 0;
    const lines = allLines.filter(l => l.trim());
    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const parsed = parseLine(lines[i]);
      const nonEmpty = parsed.filter(v => v);
      // Header row has multiple non-empty values and at least one looks like a label
      // (contains letters, not just a company name on its own)
      if (nonEmpty.length >= 2) {
        // Check if this looks like data vs. a report title
        // QuickBooks headers: ",Income,Expenses,Net income" or ",Date,Transaction type,..."
        // Report titles: "Income by Client Summary,,," (mostly empty after first col)
        const emptyCount = parsed.filter(v => !v).length;
        if (emptyCount < parsed.length - 1) {
          headerIdx = i;
          break;
        }
      }
    }

    const hdrs = parseLine(lines[headerIdx]);
    // If first header is empty (QuickBooks puts client name in col 0 with no label), name it
    if (!hdrs[0]) hdrs[0] = 'Client Name';

    // QuickBooks grouped format: client name appears alone on a row,
    // then subsequent rows with empty first column are that client's transactions.
    // We need to carry the client name forward into each transaction row.
    let currentClient = '';
    const rows: ParsedRow[] = [];
    for (const line of lines.slice(headerIdx + 1)) {
      const vals = parseLine(line);
      const row: ParsedRow = {};
      hdrs.forEach((h, i) => { row[h] = vals[i] || ''; });

      const firstCol = hdrs[0] || 'Client Name';
      const firstVal = (row[firstCol] || '').trim();
      const otherVals = hdrs.slice(1).map(h => row[h] || '').filter(v => v);

      // Skip empty rows and total/summary rows
      if (!firstVal && otherVals.length === 0) continue;
      const lower = firstVal.toLowerCase();
      if (lower === 'total' || lower.startsWith('total ')) continue;

      // If first column has a value but other columns are empty, it's a client name header
      if (firstVal && otherVals.length === 0) {
        currentClient = firstVal;
        continue;
      }

      // If first column is empty but we have a current client, fill it in
      if (!firstVal && currentClient) {
        row[firstCol] = currentClient;
      }

      // If first column has value AND other columns too, it's a flat row (like Income Summary)
      if (firstVal) {
        currentClient = firstVal;
      }

      rows.push(row);
    }

    // Filter out empty headers and remap rows to clean headers only
    const cleanHeaders = hdrs.filter(h => h);
    const cleanRows = rows.map(row => {
      const clean: ParsedRow = {};
      for (const h of cleanHeaders) clean[h] = row[h] || '';
      return clean;
    });
    return { name: '', rows: cleanRows, headers: cleanHeaders };
  }, []);

  const addParsedFile = useCallback((fileName: string, text: string) => {
    try {
      const parsed = parseCSV(text);
      if (!parsed) return;
      parsed.name = fileName;

      setUploadedFiles(prev => {
        const next = [...prev, parsed];
        // Merge all files: combine headers, merge rows by client name
        const allHeaders = new Set<string>();
        for (const f of next) f.headers.forEach(h => allHeaders.add(h));
        const mergedHeaders = Array.from(allHeaders);

        // Merge rows: for each file, index by the first column (client name)
        const byClient = new Map<string, ParsedRow>();
        for (const f of next) {
          for (const row of f.rows) {
            const clientKey = row[f.headers[0]] || '';
            if (!clientKey) continue;
            const existing = byClient.get(clientKey) || {};
            byClient.set(clientKey, { ...existing, ...row });
          }
        }

        const mergedRows = Array.from(byClient.values());
        setHeaders(mergedHeaders);
        setRawData(mergedRows);
        setMapping(autoMapColumns(mergedHeaders));
        return next;
      });

      toast.success(`Added "${fileName}" (${text.split('\n').length} lines)`);
    } catch (err: any) {
      toast.error(`Failed to parse ${fileName}: ${err.message}`);
    }
  }, [parseCSV]);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { toast.error('Please upload a CSV file'); return; }
    const reader = new FileReader();
    reader.onload = (e) => addParsedFile(file.name, e.target?.result as string);
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsText(file);
  }, [addParsedFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) handleFile(file);
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

      const existing = invoiceData.get(name) || { total: 0, count: 0, transactionTypes: {}, sampleMemos: [] };
      if (mapping.invoiceTotal) {
        const val = parseFloat(row[mapping.invoiceTotal]?.replace(/[$,]/g, '') || '0');
        if (!isNaN(val)) existing.total += val;
      }
      if (mapping.amount) {
        const val = parseFloat(row[mapping.amount]?.replace(/[$,]/g, '') || '0');
        if (!isNaN(val)) existing.total += val;
      }
      existing.count++;
      if (mapping.date && row[mapping.date]) {
        const dateVal = row[mapping.date];
        if (!existing.firstDate || dateVal < existing.firstDate) {
          existing.firstDate = dateVal;
        }
        if (!existing.lastDate || dateVal > existing.lastDate) {
          existing.lastDate = dateVal;
        }
      }
      if (mapping.transactionType && row[mapping.transactionType]) {
        const txType = row[mapping.transactionType];
        existing.transactionTypes[txType] = (existing.transactionTypes[txType] || 0) + 1;
        if (txType.toLowerCase().includes('time charge')) {
          existing.hasSupportTickets = true;
        }
      }
      if (mapping.memo && row[mapping.memo] && existing.sampleMemos.length < 5) {
        const memo = row[mapping.memo].trim();
        if (memo && !existing.sampleMemos.includes(memo)) {
          existing.sampleMemos.push(memo);
        }
      }
      if (mapping.productService && row[mapping.productService]) {
        const svc = row[mapping.productService].trim();
        if (svc) {
          if (!existing.services) existing.services = {};
          if (!existing.services[svc]) existing.services[svc] = { count: 0, total: 0 };
          existing.services[svc].count++;
          if (mapping.salesPrice) {
            const price = parseFloat(row[mapping.salesPrice]?.replace(/[$,]/g, '') || '0');
            if (!isNaN(price)) existing.services[svc].total += price;
          }
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
          <p className="text-sm font-medium mb-1">Drop CSV files here or click to browse</p>
          <p className="text-xs text-muted-foreground">Upload one or multiple QuickBooks exports. They'll be merged by client name.</p>
          <input ref={fileRef} type="file" accept=".csv" multiple className="hidden" onChange={(e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) handleFile(file);
          }} />
        </div>

        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{f.name}</span>
                <Badge variant="outline" className="text-[10px] py-0">{f.rows.length} rows</Badge>
                <Badge variant="outline" className="text-[10px] py-0">{f.headers.length} columns</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Merged: {rawData.length} unique clients across {headers.length} columns
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          {uploadedFiles.length > 0 && (
            <Button onClick={() => setStep('map')}>
              <ArrowRight className="h-4 w-4 mr-1" />
              Continue to Column Mapping
            </Button>
          )}
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
          {(['clientName', 'invoiceTotal', 'invoiceCount', 'date', 'transactionType', 'memo', 'amount', 'productService', 'salesPrice'] as const).map(field => (
            <div key={field}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {field === 'clientName' ? 'Client Name *' :
                 field === 'invoiceTotal' ? 'Invoice Total (summary reports)' :
                 field === 'invoiceCount' ? 'Invoice Count (summary reports)' :
                 field === 'date' ? 'Date (oldest/newest inferred)' :
                 field === 'transactionType' ? 'Transaction Type' :
                 field === 'memo' ? 'Memo / Description' :
                 field === 'amount' ? 'Amount (per-transaction)' :
                 field === 'productService' ? 'Product / Service' :
                 'Sales Price'}
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
                  {headers.filter(h => h).map(h => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {/* Preview first 5 rows */}
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows) — mapped columns highlighted</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.filter(h => h).map(h => {
                    const isMapped = Object.values(mapping).includes(h);
                    return (
                      <TableHead key={h} className={`text-xs whitespace-nowrap ${isMapped ? 'bg-primary/10 text-primary font-semibold' : ''}`}>{h}</TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawData.slice(0, 5).map((row, i) => (
                  <TableRow key={i}>
                    {headers.filter(h => h).map(h => {
                      const isMapped = Object.values(mapping).includes(h);
                      return (
                        <TableCell key={h} className={`text-xs py-2 ${isMapped ? 'bg-primary/5 font-medium' : ''}`}>{row[h]}</TableCell>
                      );
                    })}
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
                <TableHead className="text-xs w-[22%]">QuickBooks Client</TableHead>
                <TableHead className="text-xs w-[22%]">Matched Company</TableHead>
                <TableHead className="text-xs text-right">Txns</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Date Range</TableHead>
                <TableHead className="text-xs">Types</TableHead>
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
                  <TableCell className="text-xs text-muted-foreground py-2 whitespace-nowrap">
                    {m.invoiceSummary.firstDate && m.invoiceSummary.lastDate
                      ? `${m.invoiceSummary.firstDate} — ${m.invoiceSummary.lastDate}`
                      : m.invoiceSummary.firstDate || '-'}
                  </TableCell>
                  <TableCell className="py-2">
                    <div className="flex flex-wrap gap-0.5">
                      {m.invoiceSummary.transactionTypes && Object.entries(m.invoiceSummary.transactionTypes).slice(0, 3).map(([type, count]) => (
                        <Badge key={type} variant="outline" className={`text-[9px] py-0 ${
                          type.toLowerCase().includes('time charge') ? 'text-purple-600 border-purple-500/30 bg-purple-500/10' :
                          type.toLowerCase().includes('invoice') ? 'text-blue-600 border-blue-500/30 bg-blue-500/10' :
                          type.toLowerCase().includes('payment') ? 'text-green-600 border-green-500/30 bg-green-500/10' :
                          'text-muted-foreground'
                        }`}>
                          {type} ({count})
                        </Badge>
                      ))}
                      {m.invoiceSummary.hasSupportTickets && (
                        <Badge variant="outline" className="text-[9px] py-0 text-amber-600 border-amber-500/30 bg-amber-500/10">
                          Support
                        </Badge>
                      )}
                    </div>
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
