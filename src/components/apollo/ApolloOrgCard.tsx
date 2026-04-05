import { Badge } from '@/components/ui/badge';
import { CardTabs } from '@/components/CardTabs';
import { Building2, Globe, MapPin, Users, Calendar, DollarSign, ExternalLink, Tag, TrendingUp, TrendingDown, Minus, Cpu, Phone, Linkedin, Twitter, Facebook, BarChart3 } from 'lucide-react';

export type ApolloOrgData = {
  organizationId?: string;
  organizationName?: string;
  organizationDescription?: string;
  organizationLogo?: string;
  organizationDomain?: string;
  organizationWebsite?: string;
  organizationIndustry?: string;
  organizationIndustries?: string[];
  organizationSecondaryIndustries?: string[];
  organizationSize?: number;
  organizationFounded?: number;
  organizationRevenue?: string;
  organizationRevenueRaw?: number;
  organizationCity?: string;
  organizationState?: string;
  organizationCountry?: string;
  organizationPostalCode?: string;
  organizationStreetAddress?: string;
  organizationRawAddress?: string;
  organizationPhone?: string;
  organizationLinkedin?: string;
  organizationTwitter?: string;
  organizationFacebook?: string;
  organizationBlogUrl?: string;
  organizationCrunchbaseUrl?: string;
  organizationAngellistUrl?: string;
  organizationKeywords?: string[];
  organizationTechnologies?: string[];
  organizationSicCodes?: string[];
  organizationNaicsCodes?: string[];
  organizationLanguages?: string[];
  organizationAlexaRanking?: number;
  organizationRetailLocationCount?: number;
  organizationPubliclyTradedSymbol?: string;
  organizationPubliclyTradedExchange?: string;
  organizationHeadcountGrowth6mo?: number;
  organizationHeadcountGrowth12mo?: number;
  organizationHeadcountGrowth24mo?: number;
};

/** Extract org-level fields from a full apollo_data response (which includes person data too) */
export function extractOrgFields(data: Record<string, any>): ApolloOrgData | null {
  const orgKeys = Object.keys(data).filter(k => k.startsWith('organization'));
  if (orgKeys.length === 0) return null;
  const org: Record<string, any> = {};
  for (const k of orgKeys) org[k] = data[k];
  return org as ApolloOrgData;
}

function formatRevenue(raw?: number, label?: string): string | null {
  if (label) return label;
  if (!raw) return null;
  if (raw >= 1_000_000_000) return `$${(raw / 1_000_000_000).toFixed(1)}B`;
  if (raw >= 1_000_000) return `$${(raw / 1_000_000).toFixed(1)}M`;
  if (raw >= 1_000) return `$${(raw / 1_000).toFixed(0)}K`;
  return `$${raw.toLocaleString()}`;
}

function GrowthIndicator({ value, label }: { value?: number; label: string }) {
  if (value == null) return null;
  const pct = (value * 100).toFixed(1);
  const isPositive = value > 0;
  const isZero = value === 0;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {isZero ? <Minus className="h-3 w-3 text-muted-foreground" /> : isPositive ? <TrendingUp className="h-3 w-3 text-green-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
      <span className={isZero ? 'text-muted-foreground' : isPositive ? 'text-green-400' : 'text-red-400'}>
        {isPositive ? '+' : ''}{pct}%
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value?: string | number | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <span className="text-muted-foreground shrink-0">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
          {value} <ExternalLink className="inline h-3 w-3" />
        </a>
      ) : (
        <span className="text-foreground truncate">{String(value)}</span>
      )}
    </div>
  );
}

function OverviewTab({ data }: { data: ApolloOrgData }) {
  const revenue = formatRevenue(data.organizationRevenueRaw, data.organizationRevenue);
  const location = [data.organizationCity, data.organizationState, data.organizationCountry].filter(Boolean).join(', ');
  const address = data.organizationStreetAddress
    ? [data.organizationStreetAddress, data.organizationCity, data.organizationState, data.organizationPostalCode].filter(Boolean).join(', ')
    : location;

  return (
    <div className="space-y-2.5">
      <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Industry" value={data.organizationIndustry} />
      <InfoRow icon={<Users className="h-3.5 w-3.5" />} label="Employees" value={data.organizationSize?.toLocaleString()} />
      <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Revenue" value={revenue} />
      <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Founded" value={data.organizationFounded} />
      <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={address} />
      <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={data.organizationPhone} />
      {data.organizationAlexaRanking && (
        <InfoRow icon={<BarChart3 className="h-3.5 w-3.5" />} label="Alexa Rank" value={`#${data.organizationAlexaRanking.toLocaleString()}`} />
      )}
      {data.organizationPubliclyTradedSymbol && (
        <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Ticker" value={`${data.organizationPubliclyTradedExchange || ''}:${data.organizationPubliclyTradedSymbol}`} />
      )}
      {data.organizationRetailLocationCount && data.organizationRetailLocationCount > 0 && (
        <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Retail Locations" value={data.organizationRetailLocationCount.toLocaleString()} />
      )}

      {/* Headcount Growth */}
      {(data.organizationHeadcountGrowth6mo != null || data.organizationHeadcountGrowth12mo != null || data.organizationHeadcountGrowth24mo != null) && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Headcount Growth</p>
          <div className="space-y-1">
            <GrowthIndicator value={data.organizationHeadcountGrowth6mo} label="6 months" />
            <GrowthIndicator value={data.organizationHeadcountGrowth12mo} label="12 months" />
            <GrowthIndicator value={data.organizationHeadcountGrowth24mo} label="24 months" />
          </div>
        </div>
      )}

      {/* Social Links */}
      {(data.organizationLinkedin || data.organizationTwitter || data.organizationFacebook) && (
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          {data.organizationLinkedin && (
            <a href={data.organizationLinkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <Linkedin className="h-4 w-4" />
            </a>
          )}
          {data.organizationTwitter && (
            <a href={data.organizationTwitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <Twitter className="h-4 w-4" />
            </a>
          )}
          {data.organizationFacebook && (
            <a href={data.organizationFacebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
              <Facebook className="h-4 w-4" />
            </a>
          )}
          {data.organizationCrunchbaseUrl && (
            <a href={data.organizationCrunchbaseUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
              Crunchbase <ExternalLink className="inline h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function IndustriesTab({ data }: { data: ApolloOrgData }) {
  const primary = data.organizationIndustries || [];
  const secondary = data.organizationSecondaryIndustries || [];
  const sic = data.organizationSicCodes || [];
  const naics = data.organizationNaicsCodes || [];

  return (
    <div className="space-y-3">
      {primary.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Primary Industries</p>
          <div className="flex flex-wrap gap-1.5">
            {primary.map(i => <Badge key={i} variant="outline" className="text-xs px-2 py-0.5 capitalize">{i}</Badge>)}
          </div>
        </div>
      )}
      {secondary.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Secondary Industries</p>
          <div className="flex flex-wrap gap-1.5">
            {secondary.map(i => <Badge key={i} variant="outline" className="text-xs px-2 py-0.5 capitalize">{i}</Badge>)}
          </div>
        </div>
      )}
      {(sic.length > 0 || naics.length > 0) && (
        <div className="pt-2 border-t border-border">
          {sic.length > 0 && <p className="text-xs text-muted-foreground">SIC: {sic.join(', ')}</p>}
          {naics.length > 0 && <p className="text-xs text-muted-foreground mt-1">NAICS: {naics.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

function TechTab({ technologies }: { technologies: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {technologies.map(t => (
        <Badge key={t} variant="outline" className="text-xs px-2 py-0.5">{t}</Badge>
      ))}
    </div>
  );
}

function KeywordsTab({ keywords }: { keywords: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map(k => (
        <Badge key={k} variant="secondary" className="text-xs px-2 py-0.5">{k}</Badge>
      ))}
    </div>
  );
}

export function ApolloOrgCard({ data }: { data: ApolloOrgData }) {
  if (!data.organizationName && !data.organizationDomain) return null;

  const hasIndustries = (data.organizationIndustries?.length ?? 0) > 0 || (data.organizationSecondaryIndustries?.length ?? 0) > 0;
  const hasTech = (data.organizationTechnologies?.length ?? 0) > 0;
  const hasKeywords = (data.organizationKeywords?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {data.organizationLogo && (
          <img src={data.organizationLogo} alt="" className="h-10 w-10 rounded object-contain bg-muted p-0.5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {data.organizationName && <p className="font-medium text-sm">{data.organizationName}</p>}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-purple-400 border-purple-400/30">Apollo</Badge>
          </div>
          {data.organizationDescription && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{data.organizationDescription}</p>
          )}
        </div>
      </div>

      <CardTabs
        defaultValue="overview"
        tabs={[
          { value: 'overview', label: 'Overview', content: <OverviewTab data={data} /> },
          { value: 'industries', label: 'Industries', visible: hasIndustries, content: hasIndustries ? <IndustriesTab data={data} /> : null },
          { value: 'tech', label: 'Tech Stack', icon: <Cpu className="h-3.5 w-3.5" />, visible: hasTech, content: hasTech ? <TechTab technologies={data.organizationTechnologies!} /> : null },
          { value: 'keywords', label: 'Keywords', icon: <Tag className="h-3.5 w-3.5" />, visible: hasKeywords, content: hasKeywords ? <KeywordsTab keywords={data.organizationKeywords!} /> : null },
        ]}
      />
    </div>
  );
}
