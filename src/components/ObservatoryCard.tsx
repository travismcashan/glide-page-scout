import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { ChevronDown, Shield, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, Lock, Cookie, FileText, CheckCircle2, XCircle } from 'lucide-react';

type TestResult = {
  pass: boolean;
  result: string;
  score_description: string;
  score_modifier: number;
  recommendation?: string;
};

type CookieInfo = {
  name: string;
  value: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string | null;
  path: string | null;
  domain: string | null;
  maxAge: number | null;
  expires: string | null;
};

type ObservatoryData = {
  grade: string | null;
  score: number | null;
  scannedAt: string | null;
  detailsUrl: string | null;
  tests: Record<string, TestResult> | null;
  rawHeaders?: Record<string, string> | null;
  cspRaw?: string | null;
  cspDirectives?: Record<string, string[]> | null;
  cookies?: CookieInfo[] | null;
};

function gradeVariant(grade: string | null): 'default' | 'secondary' | 'destructive' {
  if (!grade) return 'secondary';
  if (grade.startsWith('A')) return 'default';
  if (grade.startsWith('B') || grade.startsWith('C')) return 'secondary';
  return 'destructive';
}

function gradeIcon(grade: string | null) {
  if (!grade) return <Shield className="h-5 w-5 text-muted-foreground" />;
  if (grade.startsWith('A')) return <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />;
  if (grade.startsWith('B') || grade.startsWith('C')) return <ShieldAlert className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
  return <ShieldX className="h-5 w-5 text-destructive" />;
}

function testDisplayName(key: string): string {
  const names: Record<string, string> = {
    'content-security-policy': 'Content Security Policy (CSP)',
    'cookies': 'Cookies',
    'cross-origin-resource-sharing': 'CORS',
    'cross-origin-resource-policy': 'Cross-Origin Resource Policy',
    'redirection': 'Redirection (HTTPS)',
    'referrer-policy': 'Referrer Policy',
    'strict-transport-security': 'Strict Transport Security (HSTS)',
    'subresource-integrity': 'Subresource Integrity',
    'x-content-type-options': 'X-Content-Type-Options',
    'x-frame-options': 'X-Frame-Options',
  };
  return names[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* ── Tab: Overview ── */
function OverviewTab({ data }: { data: ObservatoryData }) {
  const tests = data.tests ? Object.entries(data.tests) : [];
  const passed = tests.filter(([, t]) => t.pass).length;
  const failed = tests.filter(([, t]) => !t.pass).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/30">
        {gradeIcon(data.grade)}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Security Grade</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{data.grade || '—'}</span>
            {data.score != null && (
              <span className="text-sm text-muted-foreground">({data.score}/100)</span>
            )}
          </div>
        </div>
        <div className="text-right space-y-0.5">
          {passed > 0 && <p className="text-xs text-green-600 dark:text-green-400">{passed} passed</p>}
          {failed > 0 && <p className="text-xs text-destructive">{failed} failed</p>}
        </div>
      </div>

      {data.scannedAt && (
        <p className="text-[11px] text-muted-foreground">
          Scanned: {new Date(data.scannedAt).toLocaleString()}
        </p>
      )}

      {data.detailsUrl && (
        <a href={data.detailsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
          <ExternalLink className="h-3 w-3" /> Full report on MDN Observatory
        </a>
      )}
    </div>
  );
}

/* ── Tab: Tests ── */
function TestsTab({ tests }: { tests: Record<string, TestResult> }) {
  const entries = Object.entries(tests);
  const failed = entries.filter(([, t]) => !t.pass);
  const passed = entries.filter(([, t]) => t.pass);
  const [showPassed, setShowPassed] = useState(false);

  return (
    <div className="space-y-3">
      {failed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-destructive flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> {failed.length} Failed
          </p>
          {failed.map(([key, test]) => (
            <div key={key} className="border border-destructive/20 rounded-lg px-3 py-2.5 space-y-1 bg-destructive/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{testDisplayName(key)}</span>
                <Badge variant="destructive" className="text-[10px]">
                  {test.score_modifier > 0 ? `+${test.score_modifier}` : test.score_modifier}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">{test.score_description}</p>
              {test.recommendation && (
                <p className="text-[11px] text-primary/80 italic">💡 {test.recommendation}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {passed.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPassed(!showPassed)}
            className="text-xs font-semibold flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {passed.length} Passed
            <ChevronDown className={`h-3 w-3 transition-transform ${showPassed ? 'rotate-180' : ''}`} />
          </button>
          {showPassed && passed.map(([key, test]) => (
            <div key={key} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5 last:border-0">
              <div className="flex-1">
                <span className="font-medium">{testDisplayName(key)}</span>
                <p className="text-[10px] text-muted-foreground">{test.score_description}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {test.score_modifier > 0 ? `+${test.score_modifier}` : test.score_modifier === 0 ? '0' : test.score_modifier}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab: CSP Analysis ── */
function CspTab({ cspRaw, cspDirectives }: { cspRaw: string; cspDirectives: Record<string, string[]> | null }) {
  const directiveEntries = cspDirectives ? Object.entries(cspDirectives) : [];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold mb-1.5">Raw Policy</p>
        <pre className="text-[11px] bg-muted/60 border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all font-mono text-foreground/80">
          {cspRaw}
        </pre>
      </div>

      {directiveEntries.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1.5">Directives</p>
          <div className="space-y-1.5">
            {directiveEntries.map(([name, values]) => (
              <div key={name} className="border border-border rounded-lg px-3 py-2">
                <span className="text-xs font-mono font-medium text-primary">{name}</span>
                {values.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {values.map((v, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">{v}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-0.5">(no values — boolean directive)</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tab: Cookies ── */
function CookiesTab({ cookies }: { cookies: CookieInfo[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{cookies.length} cookie{cookies.length !== 1 ? 's' : ''} detected</p>
      {cookies.map((c, i) => (
        <div key={i} className="border border-border rounded-lg px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Cookie className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono font-medium truncate">{c.name}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={c.secure ? 'default' : 'destructive'} className="text-[10px]">
              {c.secure ? '🔒 Secure' : '⚠ Not Secure'}
            </Badge>
            <Badge variant={c.httpOnly ? 'default' : 'secondary'} className="text-[10px]">
              {c.httpOnly ? 'HttpOnly' : 'Not HttpOnly'}
            </Badge>
            {c.sameSite && (
              <Badge variant="outline" className="text-[10px]">SameSite={c.sameSite}</Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            {c.domain && <p>Domain: <span className="font-mono">{c.domain}</span></p>}
            {c.path && <p>Path: <span className="font-mono">{c.path}</span></p>}
            {c.expires && <p>Expires: {c.expires}</p>}
            {c.maxAge != null && <p>Max-Age: {c.maxAge}s</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tab: Headers ── */
function HeadersTab({ headers }: { headers: Record<string, string> }) {
  const securityHeaders = ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-resource-policy', 'cross-origin-opener-policy', 'cross-origin-embedder-policy'];
  const entries = Object.entries(headers).sort(([a], [b]) => {
    const aIsSec = securityHeaders.includes(a);
    const bIsSec = securityHeaders.includes(b);
    if (aIsSec && !bIsSec) return -1;
    if (!aIsSec && bIsSec) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => {
        const isSec = securityHeaders.includes(key);
        return (
          <div key={key} className={`rounded px-2.5 py-1.5 ${isSec ? 'bg-primary/5 border border-primary/10' : 'border-b border-border/30'}`}>
            <span className={`text-[11px] font-mono font-medium ${isSec ? 'text-primary' : 'text-foreground/70'}`}>{key}</span>
            <p className="text-[10px] font-mono text-muted-foreground break-all">{value}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Card ── */
export function ObservatoryCard({ data, isLoading }: { data: ObservatoryData | null; isLoading: boolean }) {
  if (isLoading || !data) return null;

  const hasTests = data.tests && Object.keys(data.tests).length > 0;
  const hasCsp = !!data.cspRaw;
  const hasCookies = data.cookies && data.cookies.length > 0;
  const hasHeaders = data.rawHeaders && Object.keys(data.rawHeaders).length > 0;

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="w-full justify-start h-auto flex-wrap gap-1 bg-transparent p-0 border-b border-border rounded-none pb-2">
        <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-primary/10 rounded-md px-3 py-1.5">
          Overview
        </TabsTrigger>
        {hasTests && (
          <TabsTrigger value="tests" className="text-xs data-[state=active]:bg-primary/10 rounded-md px-3 py-1.5">
            Tests
          </TabsTrigger>
        )}
        {hasCsp && (
          <TabsTrigger value="csp" className="text-xs data-[state=active]:bg-primary/10 rounded-md px-3 py-1.5">
            <Lock className="h-3 w-3 mr-1" /> CSP
          </TabsTrigger>
        )}
        {hasCookies && (
          <TabsTrigger value="cookies" className="text-xs data-[state=active]:bg-primary/10 rounded-md px-3 py-1.5">
            <Cookie className="h-3 w-3 mr-1" /> Cookies
          </TabsTrigger>
        )}
        {hasHeaders && (
          <TabsTrigger value="headers" className="text-xs data-[state=active]:bg-primary/10 rounded-md px-3 py-1.5">
            <FileText className="h-3 w-3 mr-1" /> Headers
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview" className="mt-3">
        <OverviewTab data={data} />
      </TabsContent>

      {hasTests && (
        <TabsContent value="tests" className="mt-3">
          <TestsTab tests={data.tests!} />
        </TabsContent>
      )}

      {hasCsp && (
        <TabsContent value="csp" className="mt-3">
          <CspTab cspRaw={data.cspRaw!} cspDirectives={data.cspDirectives || null} />
        </TabsContent>
      )}

      {hasCookies && (
        <TabsContent value="cookies" className="mt-3">
          <CookiesTab cookies={data.cookies!} />
        </TabsContent>
      )}

      {hasHeaders && (
        <TabsContent value="headers" className="mt-3">
          <HeadersTab headers={data.rawHeaders!} />
        </TabsContent>
      )}
    </Tabs>
  );
}
