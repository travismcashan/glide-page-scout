import { Badge } from '@/components/ui/badge';
import { CardTabs } from '@/components/CardTabs';
import { Shield, ShieldCheck, ShieldAlert, Lock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

type Endpoint = {
  ipAddress: string;
  serverName?: string;
  grade: string;
  gradeTrustIgnored?: string;
  hasWarnings?: boolean;
  isExceptional?: boolean;
  protocols: { name: string; version: string }[];
  vulnerabilities: Record<string, any>;
  forwardSecrecy?: number;
  supportsAead?: boolean;
  supportsAlpn?: boolean;
  ocspStapling?: boolean;
  hstsPolicy?: { status?: string; maxAge?: number; includeSubDomains?: boolean; preload?: boolean } | null;
  certChains?: any[];
  serverSignature?: string | null;
  httpStatusCode?: number;
};

type Cert = {
  subject?: string;
  issuerSubject?: string;
  notBefore?: number;
  notAfter?: number;
  sigAlg?: string;
  keyAlg?: string;
  keySize?: number;
  sha256Hash?: string;
};

type SslLabsData = {
  host?: string;
  grade?: string;
  endpoints?: Endpoint[];
  certs?: Cert[];
  testTime?: number;
};

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-600 dark:text-green-400';
  if (grade === 'B') return 'text-yellow-600 dark:text-yellow-400';
  if (grade === 'C' || grade === 'D') return 'text-orange-600 dark:text-orange-400';
  return 'text-destructive';
}

function gradeBg(grade: string): string {
  if (grade.startsWith('A')) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
  if (grade === 'B') return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
  if (grade === 'C' || grade === 'D') return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
  return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
}

function VulnItem({ label, value }: { label: string; value: any }) {
  const isVuln = value === true || (typeof value === 'number' && value >= 2);
  const isOk = value === false || value === 1 || value === 0;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-sm">{label}</span>
      {isVuln ? (
        <Badge variant="destructive" className="text-[10px]"><XCircle className="h-3 w-3 mr-0.5" /> Vulnerable</Badge>
      ) : isOk ? (
        <Badge variant="outline" className="text-[10px] text-green-600 border-green-300"><CheckCircle2 className="h-3 w-3 mr-0.5" /> Safe</Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">Unknown</Badge>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: SslLabsData }) {
  const ep = data.endpoints?.[0];
  const grade = ep?.grade || data.grade || '?';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className={`rounded-xl border-2 p-4 flex flex-col items-center min-w-[80px] ${gradeBg(grade)}`}>
          <span className={`text-3xl font-bold ${gradeColor(grade)}`}>{grade}</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">SSL Grade</span>
        </div>
        <div className="space-y-1.5">
          {ep?.isExceptional && (
            <div className="flex items-center gap-1.5 text-sm text-green-600"><ShieldCheck className="h-4 w-4" /> Exceptional configuration</div>
          )}
          {ep?.hasWarnings && (
            <div className="flex items-center gap-1.5 text-sm text-yellow-600"><AlertTriangle className="h-4 w-4" /> Has warnings</div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {ep?.supportsAead && <Badge variant="outline" className="text-[10px]">AEAD</Badge>}
            {ep?.supportsAlpn && <Badge variant="outline" className="text-[10px]">ALPN</Badge>}
            {ep?.ocspStapling && <Badge variant="outline" className="text-[10px]">OCSP Stapling</Badge>}
            {(ep?.forwardSecrecy ?? 0) >= 2 && <Badge variant="outline" className="text-[10px]">Forward Secrecy</Badge>}
          </div>
          {ep?.serverSignature && (
            <p className="text-xs text-muted-foreground">Server: {ep.serverSignature}</p>
          )}
          {data.testTime && (
            <p className="text-xs text-muted-foreground">Tested: {new Date(data.testTime).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* HSTS */}
      {ep?.hstsPolicy && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-medium mb-1.5">HSTS Policy</p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Max-Age: <strong className="text-foreground text-sm">{ep.hstsPolicy.maxAge != null ? `${Math.round(ep.hstsPolicy.maxAge / 86400)}d` : '—'}</strong></span>
            <span>Subdomains: <strong className="text-foreground text-sm">{ep.hstsPolicy.includeSubDomains ? 'Yes' : 'No'}</strong></span>
            <span>Preload: <strong className="text-foreground text-sm">{ep.hstsPolicy.preload ? 'Yes' : 'No'}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

function ProtocolsTab({ endpoints }: { endpoints: Endpoint[] }) {
  const ep = endpoints[0];
  if (!ep) return <p className="text-sm text-muted-foreground">No endpoint data</p>;
  return (
    <div className="space-y-1">
      {ep.protocols.map((p, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
          <span className="text-sm font-medium">{p.name} {p.version}</span>
          {(p.name === 'TLS' && parseFloat(p.version) >= 1.2) ? (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">Secure</Badge>
          ) : (p.name === 'TLS' && parseFloat(p.version) < 1.2) ? (
            <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">Deprecated</Badge>
          ) : (
            <Badge variant="destructive" className="text-[10px]">Insecure</Badge>
          )}
        </div>
      ))}
      {ep.protocols.length === 0 && <p className="text-sm text-muted-foreground">No protocol data available</p>}
    </div>
  );
}

function VulnerabilitiesTab({ endpoints }: { endpoints: Endpoint[] }) {
  const ep = endpoints[0];
  if (!ep) return null;
  const v = ep.vulnerabilities;
  return (
    <div>
      <VulnItem label="Heartbleed" value={v.heartbleed} />
      <VulnItem label="POODLE" value={v.poodle} />
      <VulnItem label="FREAK" value={v.freak} />
      <VulnItem label="Logjam" value={v.logjam} />
      <VulnItem label="DROWN" value={v.drownVulnerable} />
      <VulnItem label="BEAST" value={v.beast} />
      <VulnItem label="OpenSSL CCS (CVE-2014-0224)" value={v.openSslCcs} />
      <VulnItem label="Ticketbleed" value={v.ticketbleed} />
      <VulnItem label="ROBOT" value={v.bleichenbacher} />
      <VulnItem label="Zombie POODLE" value={v.zombiePoodle} />
      <VulnItem label="GOLDENDOODLE" value={v.goldenDoodle} />
    </div>
  );
}

function CertificatesTab({ certs }: { certs: Cert[] }) {
  if (!certs?.length) return <p className="text-sm text-muted-foreground">No certificate data</p>;
  return (
    <div className="space-y-3">
      {certs.map((cert, i) => (
        <div key={i} className="rounded-lg border border-border p-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-medium truncate">{cert.subject}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Issuer</span><span className="text-foreground truncate">{cert.issuerSubject || '—'}</span>
            <span>Algorithm</span><span className="text-foreground">{cert.sigAlg || '—'}</span>
            <span>Key</span><span className="text-foreground">{cert.keyAlg} {cert.keySize ? `(${cert.keySize}-bit)` : ''}</span>
            {cert.notBefore && <><span>Valid From</span><span className="text-foreground">{new Date(cert.notBefore).toLocaleDateString()}</span></>}
            {cert.notAfter && <><span>Expires</span><span className="text-foreground">{new Date(cert.notAfter).toLocaleDateString()}</span></>}
          </div>
        </div>
      ))}
    </div>
  );
}

function EndpointsTab({ endpoints }: { endpoints: Endpoint[] }) {
  if (endpoints.length <= 1) return <p className="text-sm text-muted-foreground">Single endpoint — see Overview tab</p>;
  return (
    <div className="space-y-2">
      {endpoints.map((ep, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
          <div>
            <p className="text-sm font-mono">{ep.ipAddress}</p>
            {ep.serverName && <p className="text-xs text-muted-foreground">{ep.serverName}</p>}
          </div>
          <span className={`text-lg font-bold ${gradeColor(ep.grade)}`}>{ep.grade}</span>
        </div>
      ))}
    </div>
  );
}

export default function SslLabsCard({ data }: { data: SslLabsData }) {
  const endpoints = data.endpoints || [];
  const certs = data.certs || [];

  const tabs = [
    { value: 'overview', label: 'Overview', content: <OverviewTab data={data} /> },
    { value: 'protocols', label: 'Protocols', content: <ProtocolsTab endpoints={endpoints} /> },
    { value: 'vulns', label: 'Vulnerabilities', content: <VulnerabilitiesTab endpoints={endpoints} /> },
    { value: 'certs', label: 'Certificates', content: <CertificatesTab certs={certs} /> },
    { value: 'endpoints', label: 'Endpoints', content: <EndpointsTab endpoints={endpoints} />, visible: endpoints.length > 1 },
  ];

  return <CardTabs tabs={tabs} defaultValue="overview" />;
}
