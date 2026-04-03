import { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, Check, X, ArrowRight, Loader2, Link2 } from 'lucide-react';
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

type FileType = 'summary' | 'transactions';
type UploadedFile = { name: string; rows: ParsedRow[]; headers: string[]; fileType: FileType };

export default function Phase0Import({ companies, onComplete, onSkip, onRefetch }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileMappings, setFileMappings] = useState<Map<string, ColumnMapping>>(new Map());
  const [matches, setMatches] = useState<MatchedQBClient[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewCount, setPreviewCount] = useState(10);

  // Derived: unified mapping (first non-empty value per field across all file mappings)
  const mapping: ColumnMapping = (() => {
    const unified: any = { clientName: '' };
    const fields = ['clientName', 'invoiceTotal', 'invoiceCount', 'date', 'transactionType', 'memo', 'amount', 'productService', 'salesPrice'] as const;
    for (const field of fields) {
      for (const [, fm] of fileMappings) {
        if ((fm as any)[field]) { unified[field] = (fm as any)[field]; break; }
      }
    }
    return unified;
  })();

  const parseCSV = useCallback((text: string) => {
    if (text.length < 10) { toast.error('CSV file appears empty'); return; }

    // Full CSV parser that handles multi-line quoted fields (QuickBooks exports
    // memo fields with newlines inside quotes)
    const parseAllRows = (csv: string): string[][] => {
      const rows: string[][] = [];
      let current = '';
      let inQuotes = false;
      let row: string[] = [];

      for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
          continue;
        }
        if ((ch === '\n' || ch === '\r') && !inQuotes) {
          if (ch === '\r' && csv[i + 1] === '\n') i++; // skip \r\n
          row.push(current.trim());
          current = '';
          if (row.some(v => v)) rows.push(row);
          row = [];
          continue;
        }
        // Inside quotes, replace newlines with spaces for cleaner display
        if ((ch === '\n' || ch === '\r') && inQuotes) {
          if (ch === '\r' && csv[i + 1] === '\n') i++;
          current += ' ';
          continue;
        }
        current += ch;
      }
      // Last row
      row.push(current.trim());
      if (row.some(v => v)) rows.push(row);
      return rows;
    };

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

    const allRows = parseAllRows(text);
    if (allRows.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }

    // Detect header row: first row with 2+ non-empty values that looks like column labels
    let headerIdx = 0;
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      const row = allRows[i];
      const nonEmpty = row.filter(v => v);
      if (nonEmpty.length >= 2) {
        const emptyCount = row.filter(v => !v).length;
        if (emptyCount < row.length - 1) {
          headerIdx = i;
          break;
        }
      }
    }

    const hdrs = [...allRows[headerIdx]];
    // If first header is empty (QuickBooks puts client name in col 0 with no label), name it
    if (!hdrs[0]) hdrs[0] = 'Client Name';

    // QuickBooks grouped format: client name appears alone on a row,
    // then subsequent rows with empty first column are that client's transactions.
    // We need to carry the client name forward into each transaction row.
    let currentClient = '';
    const rows: ParsedRow[] = [];
    for (const vals of allRows.slice(headerIdx + 1)) {
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

      // Auto-detect file type: summary (1 row per client) vs transactions (many rows per client)
      // Summary files have columns like "Income", "Expenses", "Net income"
      // Transaction files have columns like "Date", "Transaction type", "Memo"
      const headerLower = parsed.headers.map(h => h.toLowerCase());
      const isSummary = headerLower.some(h => h.includes('income') || h.includes('expenses') || h.includes('net income'))
        && !headerLower.some(h => h.includes('date') || h.includes('transaction type'));
      (parsed as UploadedFile).fileType = isSummary ? 'summary' : 'transactions';

      setUploadedFiles(prev => {
        const next = [...prev, parsed as UploadedFile];

        // Combine all headers across files
        const allHeaders = new Set<string>();
        for (const f of next) f.headers.forEach(h => allHeaders.add(h));
        const mergedHeaders = Array.from(allHeaders);

        // Merge rows across files using composite key: Client Name + Num (invoice number)
        // This joins Transaction List and Sales by Client Detail on invoice number within each client.
        // Rows without a Num get kept as-is (tagged with source).
        const clientCol = 'Client Name';
        const numCol = 'Num';
        const hasNum = next.some(f => f.headers.includes(numCol));

        let allRows: ParsedRow[];

        if (hasNum && next.length > 1) {
          // Build a map keyed by "clientName|num" for merging
          const mergedMap = new Map<string, ParsedRow>();
          const unmatchedRows: ParsedRow[] = [];

          for (const f of next) {
            for (const row of f.rows) {
              const client = row[clientCol] || '';
              const num = row[numCol] || '';

              if (client && num) {
                const key = `${client}|${num}`;
                const existing = mergedMap.get(key) || {};
                // Merge: existing values take priority, fill in blanks from new row
                const merged: ParsedRow = {};
                for (const h of mergedHeaders) {
                  merged[h] = existing[h] || row[h] || '';
                }
                merged['__source__'] = existing['__source__']
                  ? (existing['__source__'].includes(f.name) ? existing['__source__'] : `${existing['__source__']} + ${f.name}`)
                  : f.name;
                mergedMap.set(key, merged);
              } else if (client) {
                // Row without invoice number (e.g. summary row or payment)
                const fullRow: ParsedRow = {};
                for (const h of mergedHeaders) fullRow[h] = row[h] || '';
                fullRow['__source__'] = f.name;
                unmatchedRows.push(fullRow);
              }
            }
          }

          allRows = [...Array.from(mergedMap.values()), ...unmatchedRows];
          const mergedCount = Array.from(mergedMap.values()).filter(r => r['__source__']?.includes('+')).length;
          if (mergedCount > 0) {
            toast.success(`Merged ${mergedCount.toLocaleString()} rows on invoice number`);
          }
        } else {
          // Single file or no Num column - just stack rows
          allRows = [];
          for (const f of next) {
            for (const row of f.rows) {
              const fullRow: ParsedRow = {};
              for (const h of mergedHeaders) fullRow[h] = row[h] || '';
              fullRow['__source__'] = f.name;
              allRows.push(fullRow);
            }
          }
        }

        setHeaders(mergedHeaders);
        setRawData(allRows);
        // Auto-map per file
        setFileMappings(prev => {
          const next = new Map(prev);
          if (!next.has(parsed.name)) {
            next.set(parsed.name, autoMapColumns(parsed.headers));
          }
          return next;
        });
        return next;
      });

      const typeLabel = (parsed as UploadedFile).fileType === 'summary' ? 'Summary' : 'Transactions';
      toast.success(`Added "${fileName}" — ${typeLabel} (${parsed.rows.length} rows)`);
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
    // Validate: at least one file has clientName mapped
    const hasClientName = Array.from(fileMappings.values()).some(fm => fm.clientName);
    if (!hasClientName) { toast.error('Please map the Client Name column in at least one file'); return; }

    // Helper: get the mapped column value for a row, using its source file's mapping
    const getField = (row: ParsedRow, field: keyof ColumnMapping): string => {
      // Row might come from merged sources (e.g. "file1.csv + file2.csv")
      const sources = (row['__source__'] || '').split(' + ');
      for (const src of sources) {
        const fm = fileMappings.get(src.trim());
        if (fm && (fm as any)[field]) {
          const val = row[(fm as any)[field]];
          if (val) return val;
        }
      }
      // Fallback: try unified mapping
      if ((mapping as any)[field]) return row[(mapping as any)[field]] || '';
      return '';
    };

    // Build invoice summary per client
    const invoiceData = new Map<string, any>();
    const clientNames = new Set<string>();

    for (const row of rawData) {
      const name = getField(row, 'clientName');
      if (!name) continue;
      clientNames.add(name);

      const existing = invoiceData.get(name) || { total: 0, count: 0, transactionTypes: {}, sampleMemos: [] };
      const invoiceTotal = getField(row, 'invoiceTotal');
      if (invoiceTotal) {
        const val = parseFloat(invoiceTotal.replace(/[$,]/g, '') || '0');
        if (!isNaN(val)) existing.total += val;
      }
      const amount = getField(row, 'amount');
      if (amount && !invoiceTotal) {
        const val = parseFloat(amount.replace(/[$,]/g, '') || '0');
        if (!isNaN(val)) existing.total += val;
      }
      existing.count++;
      const dateVal = getField(row, 'date');
      if (dateVal) {
        if (!existing.firstDate || dateVal < existing.firstDate) existing.firstDate = dateVal;
        if (!existing.lastDate || dateVal > existing.lastDate) existing.lastDate = dateVal;
      }
      const txType = getField(row, 'transactionType');
      if (txType) {
        existing.transactionTypes[txType] = (existing.transactionTypes[txType] || 0) + 1;
        if (txType.toLowerCase().includes('time charge')) existing.hasSupportTickets = true;
      }
      const memo = getField(row, 'memo');
      if (memo && existing.sampleMemos.length < 5) {
        const trimmed = memo.trim();
        if (trimmed && !existing.sampleMemos.includes(trimmed)) existing.sampleMemos.push(trimmed);
      }
      const svc = getField(row, 'productService');
      if (svc) {
        if (!existing.services) existing.services = {};
        if (!existing.services[svc]) existing.services[svc] = { count: 0, total: 0 };
        existing.services[svc].count++;
        const price = getField(row, 'salesPrice');
        if (price) {
          const val = parseFloat(price.replace(/[$,]/g, '') || '0');
          if (!isNaN(val)) existing.services[svc].total += val;
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
                <span className="text-sm font-medium truncate">{f.name}</span>
                <Badge variant="outline" className={`text-[10px] py-0 ${
                  f.fileType === 'summary' ? 'text-blue-600 border-blue-500/30 bg-blue-500/10' : 'text-purple-600 border-purple-500/30 bg-purple-500/10'
                }`}>{f.fileType === 'summary' ? 'Summary' : 'Transactions'}</Badge>
                <Badge variant="outline" className="text-[10px] py-0">{f.rows.length} rows</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {rawData.length.toLocaleString()} total rows across {headers.length} columns
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
          {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} loaded. Map each file's columns to the unified fields below. Files will be merged on invoice number (Num) and aggregated per client.
        </p>

        {uploadedFiles.map((file, fi) => {
          const fm = fileMappings.get(file.name) || { clientName: '' };
          const updateFileMapping = (field: string, value: string | undefined) => {
            setFileMappings(prev => {
              const next = new Map(prev);
              next.set(file.name, { ...fm, [field]: value } as ColumnMapping);
              return next;
            });
          };

          const FIELDS = ['clientName', 'invoiceTotal', 'invoiceCount', 'date', 'transactionType', 'memo', 'amount', 'productService', 'salesPrice'] as const;
          const LABELS: Record<string, string> = {
            clientName: 'Client Name *', invoiceTotal: 'Invoice Total', invoiceCount: 'Invoice Count',
            date: 'Date', transactionType: 'Transaction Type', memo: 'Memo / Description',
            amount: 'Amount', productService: 'Product / Service', salesPrice: 'Sales Price',
          };

          return (
            <div key={fi} className="mb-6 p-4 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{file.name}</span>
                <Badge variant="outline" className={`text-[10px] py-0 ${
                  file.fileType === 'summary' ? 'text-blue-600 border-blue-500/30 bg-blue-500/10' : 'text-purple-600 border-purple-500/30 bg-purple-500/10'
                }`}>{file.fileType === 'summary' ? 'Summary' : 'Transactions'}</Badge>
                <span className="text-[10px] text-muted-foreground">{file.headers.length} columns, {file.rows.length.toLocaleString()} rows</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {FIELDS.map(field => (
                  <div key={field}>
                    <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{LABELS[field]}</label>
                    <Select
                      value={(fm as any)[field] || '__none__'}
                      onValueChange={(v) => updateFileMapping(field, v === '__none__' ? undefined : v)}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Not mapped --</SelectItem>
                        {file.headers.filter(h => h).map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Merged preview when multiple files */}
        {uploadedFiles.length > 1 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Link2 className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-semibold">Merged View</span>
              <Badge variant="outline" className="text-[10px] py-0 text-green-600 border-green-500/30 bg-green-500/10">
                {rawData.filter(r => r['__source__']?.includes('+')).length.toLocaleString()} rows merged on invoice #
              </Badge>
              <span className="text-[10px] text-muted-foreground">{rawData.length.toLocaleString()} total rows</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-green-500/20">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(() => {
                      const mapped = headers.filter(h => h && Object.values(mapping).includes(h));
                      const unmapped = headers.filter(h => h && !Object.values(mapping).includes(h));
                      return [...mapped, ...unmapped].map(h => (
                        <TableHead key={h} className={`text-xs whitespace-nowrap ${mapped.includes(h) ? 'bg-green-500/10 text-green-700 font-semibold' : 'text-muted-foreground'}`}>{h}</TableHead>
                      ));
                    })()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    // Show only merged rows (from both files)
                    const mergedRows = rawData.filter(r => r['__source__']?.includes('+'));
                    const source = mergedRows.length > 0 ? mergedRows : rawData;
                    const step = Math.max(1, Math.floor(source.length / previewCount));
                    const sampled: ParsedRow[] = [];
                    for (let i = 0; i < source.length && sampled.length < previewCount; i += step) {
                      sampled.push(source[i]);
                    }
                    const mapped = headers.filter(h => h && Object.values(mapping).includes(h));
                    const unmapped = headers.filter(h => h && !Object.values(mapping).includes(h));
                    const orderedCols = [...mapped, ...unmapped];
                    return sampled.map((row, ri) => (
                      <TableRow key={ri}>
                        {orderedCols.map(h => (
                          <TableCell key={h} className={`text-xs py-2 max-w-[250px] truncate ${mapped.includes(h) ? 'bg-green-500/5 font-medium' : 'text-muted-foreground'}`}>{row[h]}</TableCell>
                        ))}
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Preview per file */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Preview — sampled rows per file, mapped columns highlighted
            </p>
            <Select value={String(previewCount)} onValueChange={(v) => setPreviewCount(Number(v))}>
              <SelectTrigger className="w-[130px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per file</SelectItem>
                <SelectItem value="10">10 per file</SelectItem>
                <SelectItem value="25">25 per file</SelectItem>
                <SelectItem value="50">50 per file</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {uploadedFiles.map((file, fi) => {
            const mappedKeys = Object.values(mapping).filter(v => v && v !== '__none__') as string[];
            const clientCol = mapping.clientName;
            // Filter to meaningful rows from this file
            const fileRows = rawData.filter(r => r['__source__'] === file.name);
            const meaningful = fileRows.filter(row => {
              if (!clientCol || !row[clientCol]) return false;
              const otherMapped = mappedKeys.filter(k => k !== clientCol && row[k]);
              return otherMapped.length > 0;
            });
            const source = meaningful.length > 0 ? meaningful : fileRows;
            const step = Math.max(1, Math.floor(source.length / previewCount));
            const sampled: ParsedRow[] = [];
            for (let i = 0; i < source.length && sampled.length < previewCount; i += step) {
              sampled.push(source[i]);
            }
            // Only show columns that this file actually has data for
            const fileCols = file.headers.filter(h => h);
            const mapped = fileCols.filter(h => Object.values(mapping).includes(h));
            const unmapped = fileCols.filter(h => !Object.values(mapping).includes(h));
            const orderedCols = [...mapped, ...unmapped];

            return (
              <div key={fi}>
                <div className="flex items-center gap-2 mb-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{file.name}</span>
                  <Badge variant="outline" className={`text-[10px] py-0 ${
                    file.fileType === 'summary' ? 'text-blue-600 border-blue-500/30 bg-blue-500/10' : 'text-purple-600 border-purple-500/30 bg-purple-500/10'
                  }`}>{file.fileType === 'summary' ? 'Summary' : 'Transactions'}</Badge>
                  <span className="text-[10px] text-muted-foreground">{source.length.toLocaleString()} rows with data</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {orderedCols.map(h => {
                          const isMapped = mapped.includes(h);
                          return (
                            <TableHead key={h} className={`text-xs whitespace-nowrap ${isMapped ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'}`}>{h}</TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sampled.map((row, ri) => (
                        <TableRow key={ri}>
                          {orderedCols.map(h => {
                            const isMapped = mapped.includes(h);
                            return (
                              <TableCell key={h} className={`text-xs py-2 max-w-[250px] truncate ${isMapped ? 'bg-primary/5 font-medium' : 'text-muted-foreground'}`}>{row[h]}</TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
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
